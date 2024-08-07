import fs from 'fs';
import { BinaryHandler } from '../binary-bliss.js'; // Make sure to use the correct path

const MACHO_MAGIC = {
  0xfeedface: 'MH_MAGIC',   // 32-bit
  0xcefaedfe: 'MH_CIGAM',   // 32-bit little-endian
  0xfeedfacf: 'MH_MAGIC_64', // 64-bit
  0xcffaedfe: 'MH_CIGAM_64', // 64-bit little-endian
};

const CPU_TYPE = {
  0x00000007: 'i386',
  0x01000007: 'x86_64',
  0x0000000c: 'ARM',
  0x0100000c: 'ARM64',
  0x00000012: 'PowerPC',
  0x01000012: 'PowerPC64',
};

const FILE_TYPE = {
  0x1: 'MH_OBJECT',
  0x2: 'MH_EXECUTE',
  0x3: 'MH_FVMLIB',
  0x4: 'MH_CORE',
  0x5: 'MH_PRELOAD',
  0x6: 'MH_DYLIB',
  0x7: 'MH_DYLINKER',
  0x8: 'MH_BUNDLE',
  0x9: 'MH_DYLIB_STUB',
  0xa: 'MH_DSYM',
  0xb: 'MH_KEXT_BUNDLE',
};

function readFileHeader(filePath) {
  const bh = new BinaryHandler();
  bh.openFile(filePath);

  // Read initial magic number to determine file type
  bh.jump(0).uint32('magic');
  const magic = bh.read().magic.value;

  if (magic === 0xfeedface || magic === 0xfeedfacf) {
    bh.setEndian('BE');
    return readMachOHeader(bh);
  } else if (magic === 0xcefaedfe || magic === 0xcffaedfe) {
    bh.setEndian('LE');
    return readMachOHeader(bh);
  } else if (magic === 0xcafebabe) {
    // Read the value at offset 4
    bh.jump(4).uint32('check_value');
    const check_value = bh.read().check_value.value;

    if (check_value <= 39) {
      // It's a Mach-O universal binary (number of architectures)
      bh.setEndian('BE');
      return readMachOUniversalHeader(bh);
    } else {
      // It's a Java class file (minor and major versions)
      bh.jump(4).uint16('minor_version')
        .jump(6).uint16('major_version');
      return readJavaClassHeader(bh);
    }
  } else if (magic === 0xcafed00d) {
    console.error('This is a JAR file compressed with Pack200.');
    bh.closeFile();
    return;
  } else if (magic === 0x504b0304) {
    console.error('This is a JAR file, not a Java class file.');
    bh.closeFile();
    return;
  } else {
    console.error('Unknown or unsupported file format. Magic number:', magic.toString(16));
    bh.closeFile();
    return;
  }
}

function readMachOHeader(bh) {
  // Read Mach-O header again with correct endianness
  bh.jump(0)
    .uint32('magic')         // Magic number
    .uint32('cputype')       // CPU type
    .uint32('cpusubtype')    // CPU subtype
    .uint32('filetype')      // File type
    .uint32('ncmds')         // Number of load commands
    .uint32('sizeofcmds')    // Size of load commands
    .uint32('flags');        // Flags

  // Close file
  bh.closeFile();

  // Retrieve and interpret header information
  const header = bh.read();
  return {
    type: 'Mach-O',
    magic: MACHO_MAGIC[header.magic.value] || `UNKNOWN (${header.magic.value.toString(16)})`,
    cputype: CPU_TYPE[header.cputype.value] || `UNKNOWN (${header.cputype.value})`,
    cpusubtype: header.cpusubtype.value,
    filetype: FILE_TYPE[header.filetype.value] || `UNKNOWN (${header.filetype.value})`,
    ncmds: header.ncmds.value,
    sizeofcmds: header.sizeofcmds.value,
    flags: header.flags.value,
  };
}

function readMachOUniversalHeader(bh) {
  bh.jump(0)
    .uint32('magic') // Magic number (CAFEBABE)
    .uint32('narch'); // Number of architectures

  const header = bh.read();
  const narch = header.narch.value;
  const architectures = [];

  for (let i = 0; i < narch; i++) {
    bh.uint32('cputype')
      .uint32('cpusubtype')
      .uint32('offset')
      .uint32('size')
      .uint32('align');
    const arch = bh.read();
    architectures.push({
      cputype: CPU_TYPE[arch.cputype.value] || `UNKNOWN (${arch.cputype.value})`,
      cpusubtype: arch.cpusubtype.value,
      offset: arch.offset.value,
      size: arch.size.value,
      align: arch.align.value,
    });
  }

  // Close file
  bh.closeFile();

  return {
    type: 'Mach-O Universal Binary',
    magic: 'CAFEBABE',
    narch,
    architectures,
  };
}

function readJavaClassHeader(bh) {
  // Read Java class file header
  bh.jump(0)
    .uint32('magic')         // Magic number
    .uint16('minor_version') // Minor version
    .uint16('major_version') // Major version
    .uint16('constant_pool_count'); // Constant pool count

  const header = bh.read();
  const constantPoolCount = header.constant_pool_count.value - 1; // The count includes an extra entry for historical reasons

  const constantPool = [];
  for (let i = 0; i < constantPoolCount; i++) {
    bh.uint8('tag'); // Constant pool entry tag
    const tag = bh.read().tag.value;

    switch (tag) {
      case 7: // CONSTANT_Class
        bh.uint16('name_index');
        constantPool.push({ tag, name_index: bh.read().name_index.value });
        break;
      case 1: // CONSTANT_Utf8
        bh.uint16('length').buffer('bytes', bh.read().length.value);
        constantPool.push({ tag, bytes: bh.read().bytes.value.toString('utf8') });
        break;
      case 3: // CONSTANT_Integer
      case 4: // CONSTANT_Float
        bh.uint32('bytes');
        constantPool.push({ tag, bytes: bh.read().bytes.value });
        break;
      case 5: // CONSTANT_Long
      case 6: // CONSTANT_Double
        bh.uint32('high_bytes').uint32('low_bytes');
        constantPool.push({ tag, high_bytes: bh.read().high_bytes.value, low_bytes: bh.read().low_bytes.value });
        break;
      case 9: // CONSTANT_Fieldref
      case 10: // CONSTANT_Methodref
      case 11: // CONSTANT_InterfaceMethodref
      case 12: // CONSTANT_NameAndType
        bh.uint16('class_index').uint16('name_and_type_index');
        constantPool.push({ tag, class_index: bh.read().class_index.value, name_and_type_index: bh.read().name_and_type_index.value });
        break;
      case 8: // CONSTANT_String
        bh.uint16('string_index');
        constantPool.push({ tag, string_index: bh.read().string_index.value });
        break;
      default:
        console.error(`Unsupported constant pool tag: ${tag}`);
        break;
    }
  }

  bh.uint16('access_flags') // Access flags
    .uint16('this_class') // This class
    .uint16('super_class'); // Super class

  const thisClassIndex = bh.read().this_class.value;
  const superClassIndex = bh.read().super_class.value;

  const thisClassName = constantPool[thisClassIndex - 1]?.name_index
    ? constantPool[constantPool[thisClassIndex - 1].name_index - 1].bytes
    : `Unknown (index ${thisClassIndex})`;
  const superClassName = constantPool[superClassIndex - 1]?.name_index
    ? constantPool[constantPool[superClassIndex - 1].name_index - 1].bytes
    : `Unknown (index ${superClassIndex})`;

  // Close file
  bh.closeFile();

  return {
    type: 'Java Class',
    magic: 'CAFEBABE',
    minor_version: header.minor_version.value,
    major_version: header.major_version.value,
    constant_pool_count: header.constant_pool_count.value,
    access_flags: bh.read().access_flags.value,
    this_class: thisClassName,
    super_class: superClassName,
  };
}

// Example usage
const filePath = process.argv[2];
if (!filePath || !fs.existsSync(filePath)) throw new Error(`File path ${filePath} does not exist`);
const headerInfo = readFileHeader(filePath);
if (headerInfo) {
  console.log(headerInfo);
}


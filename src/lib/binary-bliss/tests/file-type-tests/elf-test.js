import fs from 'fs';
import { BinaryHandler } from '../binary-bliss.js'; // Make sure to use the correct path

function readELFHeader(filePath) {
  const bh = new BinaryHandler();
  bh.openFile(filePath);

  // Read the ELF header
  bh.jump(0)
    .buffer('e_ident', 16) // ELF identification
    .uint16('e_type')      // Object file type
    .uint16('e_machine')   // Architecture
    .uint32('e_version')   // Object file version
    .uint32('e_entry')     // Entry point address
    .uint32('e_phoff')     // Program header table offset
    .uint32('e_shoff')     // Section header table offset
    .uint32('e_flags')     // Processor-specific flags
    .uint16('e_ehsize')    // ELF header size
    .uint16('e_phentsize') // Program header table entry size
    .uint16('e_phnum')     // Number of program header table entries
    .uint16('e_shentsize') // Section header table entry size
    .uint16('e_shnum')     // Number of section header table entries
    .uint16('e_shstrndx'); // Section header string table index

  bh.closeFile();

  const header = bh.read();
  return {
    type: 'ELF',
    e_ident: header.e_ident.value.toString('hex'),
    e_type: header.e_type.value,
    e_machine: header.e_machine.value,
    e_version: header.e_version.value,
    e_entry: header.e_entry.value,
    e_phoff: header.e_phoff.value,
    e_shoff: header.e_shoff.value,
    e_flags: header.e_flags.value,
    e_ehsize: header.e_ehsize.value,
    e_phentsize: header.e_phentsize.value,
    e_phnum: header.e_phnum.value,
    e_shentsize: header.e_shentsize.value,
    e_shnum: header.e_shnum.value,
    e_shstrndx: header.e_shstrndx.value,
  };
}

// Example usage
const filePath = process.argv[2];
if (!filePath || !fs.existsSync(filePath)) throw new Error(`File path ${filePath} does not exist`);
const headerInfo = readELFHeader(filePath);
if (headerInfo) {
  console.log(headerInfo);
}


import fs from 'fs';
import { BinaryHandler } from '../binary-bliss.js'; // Make sure to use the correct path

function readMachOHeader(filePath) {
  const bh = new BinaryHandler('BE'); // Most Mach-O files are big-endian, but some can be little-endian (use 'LE' if necessary)
  bh.openFile(filePath);

  // Read Mach-O header
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

  // Retrieve and return header information
  const header = bh.read();
  return {
    magic: header.magic.value,
    cputype: header.cputype.value,
    cpusubtype: header.cpusubtype.value,
    filetype: header.filetype.value,
    ncmds: header.ncmds.value,
    sizeofcmds: header.sizeofcmds.value,
    flags: header.flags.value,
  };
}

// Example usage
const filePath = process.argv[2];
if (!filePath || !fs.existsSync(filePath)) throw new Error(`File path ${filePath} does not exist`);
const headerInfo = readMachOHeader(filePath);
console.log(headerInfo);


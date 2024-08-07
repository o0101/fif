import fs from 'fs';
import { BinaryHandler } from '../binary-bliss.js'; // Make sure to use the correct path

function readBMPHeader(filePath) {
  const bh = new BinaryHandler('LE');
  bh.openFile(filePath);

  // Read BMP header
  bh.jump(0)
    .buffer('magic', 2)         // "BM"
    .uint32('fileSize')         // File size
    .uint16('reserved1')        // Reserved
    .uint16('reserved2')        // Reserved
    .uint32('offset')           // Offset to pixel data
    .uint32('headerSize')       // DIB header size
    .uint32('width')            // Width
    .uint32('height')           // Height
    .uint16('planes')           // Planes
    .uint16('bitCount')         // Bits per pixel
    .uint32('compression')      // Compression
    .uint32('imageSize')        // Image size
    .uint32('xPixelsPerMeter')  // X pixels per meter
    .uint32('yPixelsPerMeter')  // Y pixels per meter
    .uint32('colorsUsed')       // Colors used
    .uint32('importantColors'); // Important colors

  // Close file
  bh.closeFile();

  // Retrieve and return header information
  const header = bh.read();
  return {
    magic: header.magic.value.toString('utf8'),
    fileSize: header.fileSize.value,
    reserved1: header.reserved1.value,
    reserved2: header.reserved2.value,
    offset: header.offset.value,
    headerSize: header.headerSize.value,
    width: header.width.value,
    height: header.height.value,
    planes: header.planes.value,
    bitCount: header.bitCount.value,
    compression: header.compression.value,
    imageSize: header.imageSize.value,
    xPixelsPerMeter: header.xPixelsPerMeter.value,
    yPixelsPerMeter: header.yPixelsPerMeter.value,
    colorsUsed: header.colorsUsed.value,
    importantColors: header.importantColors.value,
  };
}

// Example usage
const filePath = process.argv[2];
if (!filePath || !fs.existsSync(filePath)) throw new Error(`File path ${filePath} does not exist`);
const headerInfo = readBMPHeader(filePath);
console.log(headerInfo);


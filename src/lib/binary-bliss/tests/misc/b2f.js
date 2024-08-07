import fs from 'fs';
import { BinaryHandler } from '../binary-bliss.js'; // Adjust the path as needed

function bigIntFromFileWithBinaryBliss(inputFilePath, outputFilePath) {
  // Create a new BinaryHandler
  const bh = new BinaryHandler();
  bh.openFile(inputFilePath);

  // Read the byte count, bit size, and BigInt
  bh.uint32('byteCount');
  bh.uint32('bitSize');
  const byteCount = bh.$('byteCount').value;
  const bitSize = bh.$('bitSize').value;
  bh.bit(bitSize, 'bigInt');
  const bigInt = bh.$('bigInt').value;

  bh.closeFile();

  // Convert the BigInt to a hex string
  let hexString = bigInt.toString(16);

  // Pad the hex string with leading zeros if necessary
  const hexLength = byteCount * 2;
  hexString = hexString.padStart(hexLength, '0');

  // Convert the hex string to a buffer
  const buffer = Buffer.from(hexString, 'hex');

  // Write the buffer to the output file
  fs.writeFileSync(outputFilePath, buffer);
}

// Example usage
bigIntFromFileWithBinaryBliss(process.argv[2], process.argv[2]+'.b2f');


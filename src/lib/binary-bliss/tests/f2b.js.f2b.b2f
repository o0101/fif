import fs from 'fs';
import { BinaryHandler } from '../binary-bliss.js'; // Adjust the path as needed

function fileToBigIntWithBinaryBliss(filePath, outputFilePath) {
  // Read the file into a buffer
  const buffer = fs.readFileSync(filePath);

  // Convert the buffer to a BigInt
  const bigInt = BigInt('0x' + buffer.toString('hex'));

  // Calculate the number of bits in the BigInt
  const bitSize = bigInt.toString(2).length;

  // Get the number of bytes in the original file
  const byteCount = buffer.length;

  // Create a new BinaryHandler
  const bh = new BinaryHandler();
  bh.openFile(outputFilePath);

  // Write the byte count, bit size, and BigInt using bitfields
  bh.uint32(byteCount); // Assuming the byte count fits in a uint32
  bh.uint32(bitSize); // Assuming the bit size fits in a uint32
  bh.bit(bitSize, bigInt); // Write the BigInt with the correct bit size

  bh.closeFile();
}

// Example usage
fileToBigIntWithBinaryBliss(process.argv[2], process.argv[2]+'.f2b');


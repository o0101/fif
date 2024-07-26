import { BinaryHandler } from '../binary-bliss.js'; // Adjust the path as needed
import fs from 'fs';

function reconstructBigIntFromFile(inputFilePath) {
  const bh = new BinaryHandler();
  bh.openFile(inputFilePath);

  bh.uint32('byteCount');
  const byteCount = bh.$('byteCount').value;

  bh.uint32('bitSize');
  const bitSize = bh.$('bitSize').value;

  bh.uint32('factorCount');
  const factorCount = bh.$('factorCount').value;

  let reconstructedBigInt = 1n;

  for (let i = 0; i < factorCount; i++) {
    bh.bit(5, 'bitSize');
    const factorBitSize = bh.$('bitSize').value;
    bh.bit(factorBitSize, 'factor');
    const factor = bh.$('factor').value;

    bh.bit(1, 'hasExponent');
    const hasExponent = bh.$('hasExponent').value === 1;
    let exponent = 1;

    if (hasExponent) {
      bh.uint8('exponent');
      exponent = bh.$('exponent').value;
    }

    reconstructedBigInt *= factor ** BigInt(exponent);
  }

  bh.uint32('remainderBitLength');
  const remainderBitLength = bh.$('remainderBitLength').value;
  bh.bit(remainderBitLength, 'remainder');
  const remainder = bh.$('remainder').value;

  reconstructedBigInt *= remainder;

  bh.closeFile();

  // Convert the BigInt back to a buffer
  let hexString = reconstructedBigInt.toString(16);
  hexString = hexString.padStart(byteCount * 2, '0'); // Pad with leading zeros
  const buffer = Buffer.from(hexString, 'hex');

  return buffer;
}

// Example usage
const buffer = reconstructBigIntFromFile(process.argv[2]);
fs.writeFileSync(process.argv[2]+'.bf2f', buffer);
console.log('File successfully reconstructed');


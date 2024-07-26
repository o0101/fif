import { BinaryHandler } from '../binary-bliss.js'; // Adjust the path as needed
import fs from 'fs';

// Convert a file to a BigInt, factorize it, and store using Binary Bliss
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

  // Write the byte count and bit size
  bh.uint32(byteCount); // Assuming the byte count fits in a uint32
  bh.uint32(bitSize); // Assuming the bit size fits in a uint32

  // Factorize the BigInt and store the factors and exponents
  const { factors, remainder } = factorizeBigInt(bigInt);

  // Placeholder for the number of factor fields
  const factorCountPosition = bh.cursor;
  bh.uint32(0); // Placeholder

  let factorCount = 0;

  factors.forEach(({ factor, exponent }) => {
    const bitSize = Math.min(factor.toString(2).length, 25); // Ensure bit size is within 25 bits

    while (exponent > 0) {
      const exp = Math.min(exponent, 255);
      exponent -= exp;

      bh.bit(5, bitSize); // Store the bit size in 5 bits
      bh.bit(bitSize, factor); // Store the factor with the bit size
      bh.bit(1, exp > 1 ? 1 : 0); // Indicate if the exponent is greater than 1
      if (exp > 1) {
        bh.uint8(exp); // Store the exponent if greater than 1
      }
      factorCount++;
    }
  });

  // Store the remainder length in bits and the remainder
  const remainderBitLength = remainder.toString(2).length;
  bh.uint32(remainderBitLength);
  bh.bit(remainderBitLength, remainder);

  // Save current position and bit offset
  const currentPosition = bh.cursor;
  const currentBitOffset = bh.bitCursor;

  // Write the number of factor fields at the beginning
  bh.jump(factorCountPosition);
  bh.uint32(factorCount);

  // Restore position and bit offset
  bh.jump(currentPosition);
  bh.bitCursor = currentBitOffset;

  bh.closeFile();
}

// Example usage
fileToBigIntWithBinaryBliss(process.argv[2], process.argv[2]+'.f2bf')

function factorizeBigInt(bigInt, limit = 20000000n) {
  const factors = [];
  let current = bigInt;

  for (let i = 2n; i <= limit; i++) {
    if (current % i === 0n) {
      let count = 0;
      while (current % i === 0n) {
        current /= i;
        count++;
      }
      factors.push({ factor: i, exponent: count });
    }
  }

  return { factors, remainder: current };
}



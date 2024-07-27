import { BinaryHandler } from '../binary-bliss.js'; // Adjust the path as needed
import fs from 'fs';

let savedFactors = [];

// Example usage
fileToBigIntWithBinaryBliss(process.argv[2], process.argv[2] + '.f2bf');


// main function
  async function fileToBigIntWithBinaryBliss(filePath, outputFilePath) {
    // Read the file into a buffer
    const buffer = fs.readFileSync(filePath);

    // Convert the buffer to a BigInt
    let bigInt = BigInt('0x' + buffer.toString('hex'));

    // Calculate the number of bits in the BigInt
    const bitSize = bigInt.toString(2).length;

    // Get the number of bytes in the original file
    const byteCount = buffer.length;

    let factors, remainder;
    let factorCount = 0;
    let fuzzTail = '';

    const timeLimit = 6000; // 5 seconds
    let first = true;

    while (factorCount <= 10) {
      const controller = new AbortController();
      const signal = controller.signal;

      try {
        savedFactors = [];
        ({ factors, remainder } = await Promise.race([
          factorizeBigInt(bigInt, 20000000n, signal, controller),
          throwAfter(timeLimit, controller)
        ]));
        factorCount = factors.length;
      } catch (error) {
        if (error.message === 'timeout') {
          // Append a random digit to the BigInt and continue
          const randomDigit = BigInt(Math.floor(Math.random() * 10));
          const smoothness = savedFactors.reduce((sum, {exponent}) => sum + exponent, 0);
          console.log(savedFactors, smoothness);
          if ( !first && smoothness >= 5 ) {
            // length looks good, try another digit
            console.log(`Timed out. Fuzzing to find smooth. Replacing: ${randomDigit}`);
            bigInt = bigInt - (bigInt % 10n) + randomDigit;
            fuzzTail = fuzzTail.slice(0,-1) + randomDigit;
          } else {
            console.log(`Timed out. Fuzzing to find smooth. Appending: ${randomDigit}`);
            bigInt = bigInt * 10n + randomDigit;
            fuzzTail += randomDigit.toString();
          }
        } else {
          throw error; // Rethrow unexpected errors
        }
      }
      first = false;
    }

    // Create a new BinaryHandler
    const bh = new BinaryHandler();
    bh.openFile(outputFilePath);

    // Write the byte count and bit size
    bh.uint32(byteCount); // Assuming the byte count fits in a uint32
    bh.uint32(bitSize); // Assuming the bit size fits in a uint32

    // Placeholder for the number of factor fields
    const factorCountPosition = bh.cursor;
    bh.uint32(0); // Placeholder

    factorCount = 0;

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

    // Store the fuzz tail length and fuzz tail
    bh.uint32(fuzzTail.length);
    for (const digit of fuzzTail) {
      bh.bit(4, parseInt(digit, 10)); // Store each digit in 4 bits
    }

    bh.closeFile();
  }

// helpers
  async function factorizeBigInt(bigInt, limit, signal, controller) {
    const factors = [];
    let smoothness = 0;
    let current = bigInt;
    let sleepAbove = 2n + 30n;

    for (let i = 2n; i <= limit;) {
      if (signal.aborted) {
        throw new Error('aborted');
      }

      if (current % i === 0n) {
        let count = 0;
        while (current % i === 0n) {
          current /= i;
          console.log('Factor found', i);
          count++;
          smoothness++;
          if ( controller && smoothness >= 10 ) {
            console.log(`Going with it. Not going to abort.`);
            controller.abort();
            controller = null;
          }
        }
        factors.push({ factor: i, exponent: count });
        savedFactors.push({ factor: i, exponent: count });
      }
      const r6 = i % 6n;
      switch (r6) {
        case 1n:
          i += 4n;
          break;
        case 5n:
          i += 2n;
          break;
        default:
          i++;
          break;
      }
      if ( i > sleepAbove ) {
        sleepAbove += 30n;
        await sleep(0);
      }
    }

    return { factors, remainder: current };
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Helper function to throw a timeout error after a specified duration and abort the operation
  function throwAfter(ms, controller) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        controller.abort();
        reject(new Error('timeout'));
      }, ms);
    });
  }


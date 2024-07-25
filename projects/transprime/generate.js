import fs from 'fs';
import path from 'path';
import { BinaryHandler } from 'binary-bliss';

const cache = [];

// Prime generation function
const isPrime = (num) => {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  const cacheTop = cache[cache.length - 1];
  const sqrt = Math.ceil(Math.sqrt(num));
  if ( sqrt**2 == num ) return false;
  if ( sqrt <= cacheTop ) {
    for( let prime of cache ) {
      if ( sqrt < prime ) break;
      if ( num % prime === 0 ) return false;
    }
  } else {
    for (let i = 5; i * i <= num; i += 6) {
      if (num % i === 0 || num % (i + 2) === 0) return false;
    }
  }
  return true;
};

const generateFirstPrimes = (limit) => {
  const primes = [];
  let num = 2;
  while (primes.length < limit) {
    if (isPrime(num)) {
      primes.push(num);
      if ( primes.length > cache.length ) {
        // extend cache with uniques
        cache.push(num);
      }
    }
    num++;
  }
  return primes;
};

// Split primes into uint16 and uint32 arrays
const splitPrimes = (primes) => {
  const primes16 = [];
  const primes32 = [];
  primes.forEach((prime) => {
    if (prime < 65536) {
      primes16.push(prime);
    } else {
      primes32.push(prime);
    }
  });
  return { primes16, primes32 };
};

// Save primes to binary file
const savePrimesToFile = (n, filePath) => {
  const primes = generateFirstPrimes(n);
  const { primes16, primes32 } = splitPrimes(primes);

  const handler = new BinaryHandler();
  handler.openFile(filePath);

  handler.uint32(primes16.length); // Save length of primes16 array
  primes16.forEach(prime => handler.uint16(prime));

  handler.uint32(primes32.length); // Save length of primes32 array
  primes32.forEach(prime => handler.uint32(prime));

  handler.closeFile();
};

// Read primes from binary file
const readPrimesFromFile = (filePath) => {
  const handler = new BinaryHandler();
  handler.openFile(filePath);

  const primes = [];

  const primes16Length = handler.uint32('primes16Length').last.value;
  for (let i = 0; i < primes16Length; i++) {
    primes.push(handler.uint16(`prime16_${i}`).last.value);
  }

  const primes32Length = handler.uint32('primes32Length').last.value;
  for (let i = 0; i < primes32Length; i++) {
    primes.push(handler.uint32(`prime32_${i}`).last.value);
  }

  handler.closeFile();

  return primes;
};

// Verify primes
const verifyPrimes = (n, primes) => {
  if (primes.length !== n) return false;
  const primesSet = new Set(primes);
  if (primesSet.size !== primes.length) return false;
  for (let prime of primes) {
    if (!isPrime(prime)) return false;
  }
  return true;
};

// Main execution
function main() {
  const n = process.argv[2] ? parseInt(process.argv[2]) : 65536;
  if ( Number.isNaN(n) ) {
    n = 65536;
  }
  const filePath = `primes${n}.bin`;
  savePrimesToFile(n, filePath);
  const readPrimes = readPrimesFromFile(filePath);
  const isVerified = verifyPrimes(n, readPrimes);

  if (isVerified) {
    console.log('All primes are verified successfully.');
    console.log('Primes read from file:', readPrimes);
    console.log(`Last prime (${readPrimes.length}th prime): ${readPrimes[readPrimes.length-1]}`);
  } else {
    console.error('Prime verification failed.');
    console.log(cache);
  }
}

main();

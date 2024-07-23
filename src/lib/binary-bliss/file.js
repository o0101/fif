import assert from 'assert';
import fs from 'fs';
import path from 'path';

// Function to write bits into a buffer
function writeBits(length, value) {
  if (typeof length !== 'number' || length <= 0 || !Number.isInteger(length)) {
    throw new Error('Length must be a positive integer');
  }

  value = BigInt(value);
  console.log(`\nWriting bits for length: ${length}, value: ${value.toString(2).padStart(length, '0')}`);

  const byteLength = Math.ceil(length / 8);
  const buffer = Buffer.alloc(byteLength);

  for (let i = 0; i < length; i++) {
    const bit = (value >> BigInt(length - 1 - i)) & 1n;
    const byteIndex = Math.floor(i / 8);
    const bitIndex = 7 - (i % 8);
    buffer[byteIndex] |= Number(bit) << bitIndex;
    console.log(`Bit ${i}: ${bit} (byteIndex: ${byteIndex}, bitIndex: ${bitIndex}, buffer[${byteIndex}]: ${buffer[byteIndex].toString(2).padStart(8, '0')})`);
  }

  console.log(`Final buffer: ${buffer.toString('hex')}`);
  return buffer;
}

// Function to read bits from a buffer
function readBits(length, buffer) {
  if (typeof length !== 'number' || length <= 0 || !Number.isInteger(length)) {
    throw new Error('Length must be a positive integer');
  }

  const byteLength = Math.ceil(length / 8);
  if (!Buffer.isBuffer(buffer) || buffer.length < byteLength) {
    throw new Error('Buffer is too small for the specified length');
  }

  let value = 0n;
  console.log(`\nReading bits for length: ${length}, buffer: ${buffer.toString('hex')}`);

  for (let i = 0; i < length; i++) {
    const byteIndex = Math.floor(i / 8);
    const bitIndex = 7 - (i % 8);
    const bit = (buffer[byteIndex] >> bitIndex) & 1;
    value = (value << 1n) | BigInt(bit);
    console.log(`Bit ${i}: ${bit} (byteIndex: ${byteIndex}, bitIndex: ${bitIndex}, value: ${value.toString(2).padStart(length, '0')})`);
  }

  console.log(`Final value: ${value.toString(2).padStart(length, '0')}`);
  return value;
}

// Function to write buffer to disk
function writeBufferToDisk(filePath, buffer) {
  fs.writeFileSync(filePath, buffer);
}

// Function to read buffer from disk
function readBufferFromDisk(filePath) {
  return fs.readFileSync(filePath);
}

// Test cases to ensure correctness
function runTests() {
  const testCases = [
    { value: 0x1234567890abcdef1234567890abcdefn }, // 128-bit value
    { value: 0x48d159e26af37bc048d159e26af37bc048d159e26af37bc048d159e26af37bc0n }, // 130-bit value
  ];

  for (const { value } of testCases) {
    const length = value.toString(2).length;
    const buffer = writeBits(length, value);
    const result = readBits(length, buffer);

    assert.strictEqual(result.toString(2).padStart(length, '0'), value.toString(2).padStart(length, '0'), `Failed for value: ${value.toString(2)} and length: ${length}`);

    // Write buffer to disk and read back
    const filePath = path.join(process.cwd(), `test_${length}_${value}.bin`);
    writeBufferToDisk(filePath, buffer);
    const readBuffer = readBufferFromDisk(filePath);
    const readResult = readBits(length, readBuffer);

    assert.strictEqual(readResult.toString(2).padStart(length, '0'), value.toString(2).padStart(length, '0'), `Disk read failed for value: ${value.toString(2)} and length: ${length}`);
    fs.unlinkSync(filePath);  // Clean up the test file
  }

  console.log('All tests passed!');
}

runTests();


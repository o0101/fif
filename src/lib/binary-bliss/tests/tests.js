import path from 'path';
import os from 'os'
import { statSync, unlinkSync, readFileSync, existsSync, writeFileSync, readdirSync } from 'fs';
import { BinaryHandler, BinaryTypes } from '../binary-bliss.js';
import * as eddsa from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
eddsa.etc.sha512Sync = (...m) => sha512(eddsa.etc.concatBytes(...m));

const LARGE = true;
const BIT_ONLY = false;
const greenCheck = '\x1b[32m✓\x1b[0m';
const redCross = '\x1b[31m✗\x1b[0m';

const privateKey = eddsa.utils.randomPrivateKey();
const publicKey = eddsa.getPublicKey(privateKey);

function saveKeys() {
  writeFileSync('private.key', Buffer.from(privateKey).toString('hex'), 'utf8');
  writeFileSync('public.key', Buffer.from(publicKey).toString('hex'), 'utf8');
}

saveKeys();

// helpers
  function cleanUp(filePath, actuallyDo = true) {
    if ( ! actuallyDo ) return;
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  function assertEqual(expected, actual, message) {
    if (expected != actual) {
      console.error(`${redCross} Test failed: ${message}\nExpected: ${expected}\nActual: ${actual}`);
    } else {
      console.log(`${greenCheck} Test passed: ${message}`);
    }
  }

  function assertNestedArrayEqual(expected, actual, message) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) {
      console.error(`${redCross} Test failed: ${message}\nExpected: ${expected}\nActual: ${actual}`);
      return;
    }

    if (expected.length !== actual.length) {
      console.error(`${redCross} Test failed: ${message}\nExpected length: ${expected.length}\nActual length: ${actual.length}`);
      return;
    }

    for (let i = 0; i < expected.length; i++) {
      if (Array.isArray(expected[i]) && Array.isArray(actual[i])) {
        assertNestedArrayEqual(expected[i], actual[i], `${message} (index ${i})`);
      } else if (expected[i] instanceof Date && actual[i] instanceof Date) {
        assertEqual(expected[i].toISOString(), actual[i].toISOString(), `${message} (index ${i})`);
      } else if (typeof expected[i] === 'object' && typeof actual[i] === 'object') {
        assertEqual(JSON.stringify(expected[i]), JSON.stringify(actual[i]), `${message} (index ${i})`);
      } else {
        assertEqual(expected[i], actual[i], `${message} (index ${i})`);
      }
    }
  }

  function assertBufferEqual(expected, actual, message) {
    if (!Buffer.isBuffer(expected)) {
      console.error(`${redCross} Test failed: ${message}\nExpected is not a buffer: ${expected}`);
      return;
    }
    if (!Buffer.isBuffer(actual)) {
      console.error(`${redCross} Test failed: ${message}\nActual is not a buffer: ${actual}`);
      return;
    }
    if (Buffer.compare(expected, actual) !== 0) {
      console.error(`${redCross} Test failed: ${message}\nExpected: ${expected.toString('hex')}\nActual: ${actual.toString('hex')}`);
    } else {
      console.log(`${greenCheck} Test passed: ${message}`);
    }
  }

function testColorType() {
  console.log('Testing Color Type');

  class Color {
    constructor(red, green, blue) {
      this.red = red;
      this.green = green;
      this.blue = blue;
    }
  }

  BinaryTypes.define('Color', [
    { name: 'red', type: 'uint8' },
    { name: 'green', type: 'uint8' },
    { name: 'blue', type: 'uint8' }
  ]);

  const color = new Color(255, 128, 64);
  const filePath = path.join(process.cwd(), 'color.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  BinaryTypes.write(handler, 'Color', color);
  handler.jump(0);
  const readColor = BinaryTypes.read(handler, 'Color');

  assertEqual(color.red, readColor.red.value, 'Color red');
  assertEqual(color.green, readColor.green.value, 'Color green');
  assertEqual(color.blue, readColor.blue.value, 'Color blue');

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testInterleavedBitFields() {
  console.log('Testing Interleaved Bit Fields');

  const filePath = path.join('interleaved_bit_fields.bin');
  const bh = new BinaryHandler();
  bh.openFile(filePath);

  // Writing interleaved bit fields and other types
  bh.bit(3, 5);    // 3 bits with value 5 (101 in binary)
  bh.uint32(1024); // 32-bit integer with value 1024
  bh.bit(5, 19);   // 5 bits with value 19 (10011 in binary)
  bh.uint16(65535);// 16-bit integer with value 65535 (111111111111111 in binary)
  bh.bit(7, 77);   // 7 bits with value 77 (1001101 in binary)
  bh.uint32(1111111);

  // Reset buffer for reading
  bh.jump(0);

  // Reading interleaved bit fields and other types
  bh.bit(3, 'bit3');
  bh.uint32('uint32');
  bh.bit(5, 'bit5');
  bh.uint16('uint16');
  bh.bit(7, 'bit7');
  bh.uint32('bit32 2');

  const result = bh.read();

  assertEqual(5, result.bit3.value, 'Interleaved Bit3 value');
  assertEqual(1024, result.uint32.value, 'Interleaved Uint32 value');
  assertEqual(19, result.bit5.value, 'Interleaved Bit5 value');
  assertEqual(65535, result.uint16.value, 'Interleaved Uint16 value');
  assertEqual(77, result.bit7.value, 'Interleaved Bit7 value');

  // Sign and verify the file
  bh.signFile('private.key');
  if (!bh.verifyFile('public.key')) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  bh.closeFile();
}

function testBitFields() {
  console.log('Testing Bit Fields');

  const filePath = path.join('bit_fields.bin');
  const bh = new BinaryHandler();
  bh.openFile(filePath);

  // Writing bit fields
  bh.bit(1, 1); // Write a single bit with value 1
  bh.bit(3, 5); // Write three bits with value 5 (101 in binary)
  bh.bit(4, 9); // Write four bits with value 9 (1001 in binary)
  bh.bit(8, 255); // Write eight bits with value 255 (11111111 in binary)
  bh.bit(8, 129); // Write eight bits with value 255 (11111111 in binary)
  bh.bit(8, 255); // Write eight bits with value 255 (11111111 in binary)
  bh.bit(8, 129); // Write eight bits with value 255 (11111111 in binary)
  bh.bit(200, 988888888888888347856348573468937253482675n);
  bh.bit(8, 129); // Write eight bits with value 255 (11111111 in binary)
  bh.uint32(9999);

  // Reset buffer for reading
  bh.jump(0);

  // Reading bit fields
  bh.bit(1, 'bit1');
  bh.bit(3, 'bit3');
  bh.bit(4, 'bit4');
  bh.bit(8, 'bit81');
  bh.bit(8, 'bit82');
  bh.bit(8, 'bit83');
  bh.bit(8, 'bit84');
  bh.bit(200, 'bit200');
  bh.bit(8, 'bit85');
  bh.uint32('val9999');

  const result = bh.read();
  assertEqual(1, result.bit1.value, 'Bit1 value');
  assertEqual(5, result.bit3.value, 'Bit3 value');
  assertEqual(9, result.bit4.value, 'Bit4 value');
  assertEqual(255, result.bit81.value, 'Bit81 value');
  assertEqual(129, result.bit82.value, 'Bit82 value');
  assertEqual(255, result.bit83.value, 'Bit83 value');
  assertEqual(129, result.bit84.value, 'Bit84 value');
  assertEqual(988888888888888347856348573468937253482675n, result.bit200.value, 'Bit200 value');
  assertEqual(129, result.bit85.value, 'Bit85 value');
  assertEqual(9999, result.val9999.value, 'Val 9999');

  bh.closeFile();
}

function testBitFieldCrossByteBoundary() {
  console.log('Testing Bit Fields Across Byte Boundaries');

  const filePath = path.join('bit_fields_cross_byte.bin');
  const bh = new BinaryHandler();
  bh.openFile(filePath);

  // Writing bit fields
  bh.bit(4, 15);  // Write four bits with value 15 (1111 in binary)
  bh.bit(8, 170); // Write eight bits with value 170 (10101010 in binary)
  bh.bit(12, 4095); // Write twelve bits with value 4095 (111111111111 in binary)

  // Reset buffer for reading
  bh.jump(0);

  // Reading bit fields
  bh.bit(4, 'bit4');
  bh.bit(8, 'bit8');
  bh.bit(12, 'bit12');

  const result = bh.read();
  assertEqual(15, result.bit4.value, 'Bit4 value');
  assertEqual(170, result.bit8.value, 'Bit8 value');
  assertEqual(4095, result.bit12.value, 'Bit12 value');

  // Sign and verify the file
  bh.signFile('private.key');
  if (!bh.verifyFile('public.key')) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  bh.closeFile();
}

function testBinarySerialization() {
  console.log('Testing Binary Serialization');

  const testData = {
    text: 'Hello, World!',
    number: 42,
    date: new Date('2024-07-24T10:00:00Z'),
    buffer: Buffer.from('binary data'),
    nested: {
      bool: true,
      bitField: 1234,
      complexBuffer: Buffer.from('complex binary data'),
    },
  };

  const filePath = 'test_binary_serialization.bin';
  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.pojo(testData);
  handler.jump(0);
  const readData = handler.pojo('testData').last.value;

  assertEqual(testData.text, readData.text, 'Text field');
  assertEqual(testData.number, readData.number, 'Number field');
  assertEqual(testData.date.toISOString(), readData.date.toISOString(), 'Date field');
  assertBufferEqual(testData.buffer, Buffer.from(readData.buffer), 'Buffer field');
  assertEqual(testData.nested.bool, readData.nested.bool, 'Nested Boolean field');
  assertEqual(testData.nested.bitField, readData.nested.bitField, 'Nested Bit Field');
  assertBufferEqual(testData.nested.complexBuffer, Buffer.from(readData.nested.complexBuffer), 'Nested Complex Buffer field');

  handler.signFile('private.key');
  if (!handler.verifyFile('public.key')) {
    console.error('✗ Test failed: File failed to verify.');
  } else {
    console.log('✓ Test passed: File signature successfully verified.');
  }

  handler.closeFile();
  cleanUp(filePath);
}

function enhancedBitFieldTests() {
  console.log('Enhanced Bit Field Tests');

  // Test Case 1: Write and Read single bits
  {
    const filePath = path.join('bit_fields_single_bit.bin');
    const bh = new BinaryHandler();
    bh.openFile(filePath);

    bh.bit(1, 1); // Write a single bit with value 1
    bh.bit(1, 0); // Write a single bit with value 0
    bh.jump(0);
    bh.bit(1, 'bit1');
    bh.bit(1, 'bit2');

    const result = bh.read();
    assertEqual(1, result.bit1.value, 'Single Bit 1');
    assertEqual(0, result.bit2.value, 'Single Bit 2');

    bh.closeFile();
  }

  // Test Case 2: Write and Read multi-bit values
  {
    const filePath = path.join('bit_fields_multi_bit.bin');
    const bh = new BinaryHandler();
    bh.openFile(filePath);

    bh.bit(3, 5); // Write three bits with value 5 (101 in binary)
    bh.bit(4, 9); // Write four bits with value 9 (1001 in binary)
    bh.jump(0);
    bh.bit(3, 'bit3');
    bh.bit(4, 'bit4');

    const result = bh.read();
    assertEqual(5, result.bit3.value, 'Multi Bit 3');
    assertEqual(9, result.bit4.value, 'Multi Bit 4');

    bh.closeFile();
  }

  // Test Case 3: Write and Read large bit values
  {
    const filePath = path.join('bit_fields_large_value.bin');
    const bh = new BinaryHandler();
    bh.openFile(filePath);

    bh.bit(64, 123456789123456789n); // Write 64 bits with a large value
    bh.jump(0);
    bh.bit(64, 'bit64');

    const result = bh.read();
    assertEqual(123456789123456789n, result.bit64.value, 'Large Bit Value');

    bh.closeFile();
  }

  // Test Case 4: Write and Read across byte boundaries
  {
    const filePath = path.join('bit_fields_cross_byte_boundary.bin');
    const bh = new BinaryHandler();
    bh.openFile(filePath);

    bh.bit(12, 4095); // Write twelve bits with value 4095 (111111111111 in binary)
    bh.jump(0);
    bh.bit(12, 'bit12');

    const result = bh.read();
    assertEqual(4095, result.bit12.value, 'Bit Value Across Byte Boundary');

    bh.closeFile();
  }

  // Test Case 5: Write and Read mixed bit values
  {
    const filePath = path.join('bit_fields_mixed_values.bin');
    const bh = new BinaryHandler();
    bh.openFile(filePath);

    bh.bit(5, 19); // Write five bits with value 19 (10011 in binary)
    bh.bit(7, 77); // Write seven bits with value 77 (1001101 in binary)
    bh.jump(0);
    bh.bit(5, 'bit5');
    bh.bit(7, 'bit7');

    const result = bh.read();
    assertEqual(19, result.bit5.value, 'Mixed Bit 5');
    assertEqual(77, result.bit7.value, 'Mixed Bit 7');

    bh.closeFile();
  }
}

function testMapType() {
  console.log('Testing Map Type');

  BinaryTypes.define('MapEntry', [
    { name: 'key', type: 'gets' },
    { name: 'value', type: 'gets' }
  ]);

  BinaryTypes.define('Map', [
    { name: 'length', type: 'uint32' },
    { name: 'entries', type: 'array', subtype: 'MapEntry' }
  ]);

  const map = new Map();
  map.set('abc', '123');
  map.set('def', '456');
  const filePath = path.join(process.cwd(), 'map.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.writeMagic('MAP');
  handler.map(map);
  handler.jump(0);
  handler.readMagic('MAP');
  const readMap = handler.map('map').last.value;

  assertEqual(map.size, readMap.size, 'Map size');
  for (const [key, value] of map.entries()) {
    assertEqual(value, readMap.get(key), `Map entry ${key}`);
  }

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testHeteroArray() {
  console.log('Testing Heterogeneous Array');

  const array = ['012', 345, new Date()];
  const filePath = path.join(process.cwd(), 'heteroArray.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.heteroArray(array);
  handler.jump(0);
  const readArray = handler.heteroArray('array').last.value;

  assertEqual(array[0], readArray[0], 'HeteroArray string');
  assertEqual(array[1], readArray[1], 'HeteroArray number');
  assertEqual(array[2].toISOString(), readArray[2].toISOString(), 'HeteroArray date');

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testNestedArray() {
  console.log('Testing Nested Array');

  const nestedArray = [[1, 2, 3], [4, 5, 6, [7, 8, 9]], 10, 'Hello', new Date()];
  const filePath = path.join(process.cwd(), 'nestedArray.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.heteroArray(nestedArray);
  handler.jump(0);
  const readNestedArray = handler.heteroArray('nestedArray').last.value;

  assertNestedArrayEqual(nestedArray, readNestedArray, 'Nested Array');

  handler.signFile('private.key');
  const isValid = handler.verifyFile('public.key');
  if (isValid) {
    console.log(`${greenCheck} File verification successful.`);
  } else {
    console.error(`${redCross} File verification failed.`);
  }

  handler.closeFile();
}

function testAlphabetSoup() {
  console.log('Testing Alphabet Soup of Bit Operations and Data Types');

  const filePath = path.join(process.cwd(), 'alphabetSoup.bin');
  const handler = new BinaryHandler();
  handler.openFile(filePath);

  const testDate = new Date('2024-07-24T10:00:00.000Z'); // Use a fixed date in Zulu time

  // Writing a mix of bit operations and various data types
  handler.bit(4, 15);  // Write 4 bits (1111)
  handler.uint32(123456789); // Write a 32-bit integer
  handler.bit(3, 5);   // Write 3 bits (101)
  handler.float(123.456); // Write a float
  handler.bit(5, 19);  // Write 5 bits (10011)
  handler.gzip({ data: 'compressed string data' }); // Write gzipped string
  handler.bit(7, 127); // Write 7 bits (1111111)
  handler.uint16(65535); // Write a 16-bit integer
  handler.bit(8, 255);  // Write 8 bits (11111111)
  handler.pojo({ key: 'value', nested: { num: 42, bool: true } }); // Write a POJO
  handler.bit(1, 1);   // Write 1 bit (1)
  handler.buffer(Buffer.from('binary data')); // Write a buffer
  handler.bit(10, 1023); // Write 10 bits (1111111111)
  handler.date(testDate); // Write the fixed date
  handler.bit(12, 4095); // Write 12 bits (111111111111)
  handler.heteroArray(['string', 789, testDate]); // Write a hetero array with the fixed date
  handler.bit(15, 32767); // Write 15 bits (111111111111111)
  handler.uint8(255); // Write an 8-bit integer
  handler.bool(true); // Write a boolean value
  handler.bool(false); // Write another boolean value
  handler.bit(200, 123456789123456789n); // Write 200 bits of a large value

  // Reset buffer for reading
  handler.jump(0);

  // Reading the mixed bit operations and various data types
  handler.bit(4, 'bit4');
  handler.uint32('uint32');
  handler.bit(3, 'bit3');
  handler.float('float');
  handler.bit(5, 'bit5');
  handler.gzip('gzipString');
  handler.bit(7, 'bit7');
  handler.uint16('uint16');
  handler.bit(8, 'bit8');
  handler.pojo('pojo');
  handler.bit(1, 'bit1');
  handler.buffer('buffer', Buffer.from('binary data').length);
  handler.bit(10, 'bit10');
  handler.date('date');
  handler.bit(12, 'bit12');
  handler.heteroArray('heteroArray');
  handler.bit(15, 'bit15');
  handler.uint8('uint8');
  handler.bool('bool1');
  handler.bool('bool2');
  handler.bit(200, 'bit200');

  const result = handler.read();

  // Validating the read data
  assertEqual(15, result.bit4.value, 'Alphabet Soup Bit4');
  assertEqual(123456789, result.uint32.value, 'Alphabet Soup Uint32');
  assertEqual(5, result.bit3.value, 'Alphabet Soup Bit3');
  assertEqual(123.456.toFixed(3), result.float.value.toFixed(3), 'Alphabet Soup Float');
  assertEqual(19, result.bit5.value, 'Alphabet Soup Bit5');
  assertEqual('compressed string data', result.gzipString.value, 'Alphabet Soup Gzip String');
  assertEqual(127, result.bit7.value, 'Alphabet Soup Bit7');
  assertEqual(65535, result.uint16.value, 'Alphabet Soup Uint16');
  assertEqual(255, result.bit8.value, 'Alphabet Soup Bit8');
  assertEqual('value', result.pojo.value.key, 'Alphabet Soup POJO key');
  assertEqual(42, result.pojo.value.nested.num, 'Alphabet Soup POJO nested num');
  assertEqual(true, result.pojo.value.nested.bool, 'Alphabet Soup POJO nested bool');
  assertEqual(1, result.bit1.value, 'Alphabet Soup Bit1');
  assertBufferEqual(Buffer.from('binary data'), result.buffer.value, 'Alphabet Soup Buffer');
  assertEqual(1023, result.bit10.value, 'Alphabet Soup Bit10');
  assertEqual(testDate.toISOString(), result.date.value.toISOString(), 'Alphabet Soup Date');
  assertEqual(4095, result.bit12.value, 'Alphabet Soup Bit12');
  assertEqual('string', result.heteroArray.value[0], 'Alphabet Soup HeteroArray string');
  assertEqual(789, result.heteroArray.value[1], 'Alphabet Soup HeteroArray number');
  assertEqual(testDate.toISOString(), result.heteroArray.value[2].toISOString(), 'Alphabet Soup HeteroArray date');
  assertEqual(32767, result.bit15.value, 'Alphabet Soup Bit15');
  assertEqual(255, result.uint8.value, 'Alphabet Soup Uint8');
  assertEqual(true, result.bool1.value, 'Alphabet Soup Bool1');
  assertEqual(false, result.bool2.value, 'Alphabet Soup Bool2');
  assertEqual(123456789123456789n, result.bit200.value, 'Alphabet Soup Bit200');

  handler.signFile('private.key');
  if (!handler.verifyFile('public.key')) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testMixedTypeArray() {
  console.log('Testing Mixed Type Array');

  const array = ['hello', 123, new Date(), { foo: 'bar' }, [1, 2, 3]];
  const filePath = path.join(process.cwd(), 'mixedArray.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.heteroArray(array);
  handler.jump(0);
  const readArray = handler.heteroArray('array').last.value;

  assertEqual(array[0], readArray[0], 'MixedTypeArray string');
  assertEqual(array[1], readArray[1], 'MixedTypeArray number');
  assertEqual(array[2].toISOString(), readArray[2].toISOString(), 'MixedTypeArray date');
  assertEqual(array[3].foo, readArray[3].foo, 'MixedTypeArray object');
  assertEqual(array[4].toString(), readArray[4].toString(), 'MixedTypeArray array');

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testDateType() {
  console.log('Testing Date Type');

  const date = new Date();
  const filePath = path.join(process.cwd(), 'date.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.date(date);
  handler.jump(0);
  const readDate = handler.date('date').last.value;

  assertEqual(date.toISOString(), readDate.toISOString(), 'Date value');

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testFloatType() {
  console.log('Testing Float Type');

  const float = 123.456;
  const filePath = path.join(process.cwd(), 'float.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.float(float);
  handler.jump(0);
  const readFloat = handler.float('float').last.value;

  assertEqual(float.toFixed(3), readFloat.toFixed(3), 'Float value');

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testBufferType() {
  console.log('Testing Buffer Type');

  const buffer = readFileSync('color.bin');
  const filePath = path.join(process.cwd(), 'buffer.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.buffer(buffer);  // Writing buffer
  handler.jump(0);
  handler.buffer('buffer', buffer.length); // Reading buffer with specified length

  assertBufferEqual(buffer, handler.$('buffer').value, 'Buffer value');

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }


  handler.closeFile();
}

function testMagicNumber() {
  console.log('Testing Magic Number');

  const magicNumber = 513;
  const filePath = path.join(process.cwd(), 'magic_number.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.writeMagic(magicNumber);   // Writing magic number
  handler.jump(0);
  handler.readMagic(magicNumber);    // Reading magic number

  assertEqual(magicNumber, handler.last.value, 'Magic number');

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testMagicString() {
  console.log('Testing Magic String');

  const magicString = "GIF4";
  const filePath = path.join(process.cwd(), 'magic_string.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.writeMagic(magicString);   // Writing magic string
  handler.jump(0);
  handler.readMagic(magicString);    // Reading magic string

  assertEqual(magicString, handler.last.value, 'Magic string');

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testMagicBuffer() {
  console.log('Testing Magic Buffer');

  const magicBuffer = Buffer.from("GIF4", 'utf8');
  const filePath = path.join(process.cwd(), 'magic_buffer.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.writeMagic(magicBuffer);   // Writing magic buffer
  handler.jump(0);
  handler.readMagic(magicBuffer);    // Reading magic buffer

  assertBufferEqual(magicBuffer, handler.$('magic').value, 'Magic buffer');

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testPojoType() {
  console.log('Testing POJO Type');

  const pojo = {
    name: 'Test',
    age: 30,
    nested: {
      key: 'value',
      array: [1, 'two', new Date()]
    }
  };
  const filePath = path.join(process.cwd(), 'pojo.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.pojo(pojo);
  handler.jump(0);
  const readPojo = handler.pojo('pojo').last.value;

  assertEqual(pojo.name, readPojo.name, 'POJO name');
  assertEqual(pojo.age, readPojo.age, 'POJO age');
  assertEqual(pojo.nested.key, readPojo.nested.key, 'POJO nested key');
  assertEqual(pojo.nested.array[0], readPojo.nested.array[0], 'POJO nested array number');
  assertEqual(pojo.nested.array[1], readPojo.nested.array[1], 'POJO nested array string');
  assertEqual(pojo.nested.array[2].toISOString(), readPojo.nested.array[2].toISOString(), 'POJO nested array date');

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testComplexNonLatinObject() {
  console.log('Testing Complex Object with Non-Latin Characters');

  const complexObject = {
    greeting: "‰Ω†Â•Ω",
    farewell: "ŸÖÿπ ÿßŸÑÿ≥ŸÑÿßŸÖÿ©",
    mixed: "Hello, ‰Ω†Â•Ω, ŸÖÿ±ÿ≠ÿ®ÿß!",
    nested: {
      question: "‰Ω†Â•ΩÂêóÔºü",
      answer: "ÿßŸÑÿ≠ŸÖÿØ ŸÑŸÑŸá"
    }
  };
  const filePath = path.join(process.cwd(), 'complex_non_latin_object.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.pojo(complexObject);
  handler.jump(0);
  const readObject = handler.pojo('complexObject').last.value;

  assertEqual(complexObject.greeting, readObject.greeting, 'Complex object greeting');
  assertEqual(complexObject.farewell, readObject.farewell, 'Complex object farewell');
  assertEqual(complexObject.mixed, readObject.mixed, 'Complex object mixed');
  assertEqual(complexObject.nested.question, readObject.nested.question, 'Complex object nested question');
  assertEqual(complexObject.nested.answer, readObject.nested.answer, 'Complex object nested answer');

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testMapWithPojo() {
  console.log('Testing Map with POJO Value');

  const mapWithPojo = new Map();
  mapWithPojo.set('key1', 'value1');
  mapWithPojo.set('key2', { name: 'Test', greeting: "‰Ω†Â•Ω" });

  const filePath = path.join(process.cwd(), 'map_with_pojo.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.map(mapWithPojo);
  handler.jump(0);
  const readMap = handler.map('mapWithPojo').last.value;

  assertEqual(mapWithPojo.size, readMap.size, 'Map with POJO size');
  assertEqual(mapWithPojo.get('key1'), readMap.get('key1'), 'Map with POJO key1 value');
  assertEqual(mapWithPojo.get('key2').name, readMap.get('key2').name, 'Map with POJO key2 name');
  assertEqual(mapWithPojo.get('key2').greeting, readMap.get('key2').greeting, 'Map with POJO key2 greeting');

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testPojoWithMap() {
  console.log('Testing POJO with Map Value');

  const pojoWithMap = {
    name: 'Test POJO',
    details: new Map([
      ['language', 'JavaScript'],
      ['greeting', '‰Ω†Â•Ω']
    ])
  };

  const filePath = path.join(process.cwd(), 'pojo_with_map.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.pojo(pojoWithMap);
  handler.jump(0);
  const readPojo = handler.pojo('pojoWithMap').last.value;

  assertEqual(pojoWithMap.name, readPojo.name, 'POJO with Map name');
  assertEqual(pojoWithMap.details.size, readPojo.details.size, 'POJO with Map details size');
  assertEqual(pojoWithMap.details.get('language'), readPojo.details.get('language'), 'POJO with Map details language');
  assertEqual(pojoWithMap.details.get('greeting'), readPojo.details.get('greeting'), 'POJO with Map details greeting');

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testSetType() {
  console.log('Testing Set Type');

  const set = new Set([1, 'two', new Date()]);
  const filePath = path.join(process.cwd(), 'set.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.set(set);
  handler.jump(0);
  const readSet = handler.set('set').last.value;

  const setArray = Array.from(set);
  const readSetArray = Array.from(readSet);

  assertEqual(setArray.length, readSetArray.length, 'Set length');
  for (let i = 0; i < setArray.length; i++) {
    if (setArray[i] instanceof Date) {
      assertEqual(setArray[i].toISOString(), readSetArray[i].toISOString(), `Set element ${i}`);
    } else {
      assertEqual(setArray[i], readSetArray[i], `Set element ${i}`);
    }
  }

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testPojoWithSet() {
  console.log('Testing POJO with Set Value');

  const pojoWithSet = {
    name: 'Test POJO',
    details: new Set(['JavaScript', '‰Ω†Â•Ω'])
  };

  const filePath = path.join(process.cwd(), 'pojo_with_set.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.pojo(pojoWithSet);
  handler.jump(0);
  const readPojo = handler.pojo('pojoWithSet').last.value;

  assertEqual(pojoWithSet.name, readPojo.name, 'POJO with Set name');
  assertEqual(pojoWithSet.details.size, readPojo.details.size, 'POJO with Set details size');

  const detailsArray = Array.from(pojoWithSet.details);
  const readDetailsArray = Array.from(readPojo.details);
  for (let i = 0; i < detailsArray.length; i++) {
    assertEqual(detailsArray[i], readDetailsArray[i], `POJO with Set details element ${i}`);
  }

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testSetWithPojo() {
  console.log('Testing Set with POJO Value');

  const setWithPojo = new Set([
    { language: 'JavaScript', greeting: '‰Ω†Â•Ω' },
    { language: 'Python', greeting: 'ŸÖÿ±ÿ≠ÿ®ÿß' }
  ]);

  const filePath = path.join(process.cwd(), 'set_with_pojo.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.set(setWithPojo);
  handler.jump(0);
  const readSet = handler.set('setWithPojo').last.value;

  const setArray = Array.from(setWithPojo);
  const readSetArray = Array.from(readSet);

  assertEqual(setArray.length, readSetArray.length, 'Set with POJO length');
  for (let i = 0; i < setArray.length; i++) {
    assertEqual(setArray[i].language, readSetArray[i].language, `Set with POJO element ${i} language`);
    assertEqual(setArray[i].greeting, readSetArray[i].greeting, `Set with POJO element ${i} greeting`);
  }

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testGzipString() {
  console.log('Testing Gzip String');

  const originalString = 'Hello, this is a test string for gzip compression!';
  const filePath = path.join(process.cwd(), 'gzip_string.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.gzip({ data: originalString }); // Writing gzipped string
  handler.jump(0);
  handler.gzip('gzipString'); // Reading gzipped string

  const readString = handler.$('gzipString').value;
  assertEqual(originalString, readString, 'Gzip string value');

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testGzipBuffer() {
  console.log('Testing Gzip Buffer');

  const originalBuffer = Buffer.from('Hello, this is a test buffer for gzip compression!', 'utf8');
  const filePath = path.join(process.cwd(), 'gzip_buffer.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.gzip({ data: originalBuffer }); // Writing gzipped buffer
  handler.jump(0);
  handler.gzip('gzipBuffer'); // Reading gzipped buffer

  const readBuffer = handler.$('gzipBuffer').value;
  assertBufferEqual(originalBuffer, readBuffer, 'Gzip buffer value');

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testGzipMixedContent() {
  const filePath = path.join(process.cwd(), 'gzip_mixed_content.bin');

  console.log('Testing Gzip Mixed Content');

  const originalString = 'This is a string';
  const originalBuffer = Buffer.from('This is a buffer', 'utf8');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.gzip({ data: originalString }); // Writing gzipped string
  handler.gzip({ data: originalBuffer }); // Writing gzipped buffer
  handler.jump(0);
  handler.gzip('gzipString'); // Reading gzipped string
  handler.gzip('gzipBuffer'); // Reading gzipped buffer

  const readString = handler.$('gzipString').value;
  const readBuffer = handler.$('gzipBuffer').value;
  assertEqual(originalString, readString, 'Gzip mixed content string value');
  assertBufferEqual(originalBuffer, readBuffer, 'Gzip mixed content buffer value');

  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function runGzipTests() {
  testGzipString();
  testGzipBuffer();
  testGzipMixedContent();
}

function testFailVerify() {
  const filePath = path.join(process.cwd(), 'fail_verify.bin');

  console.log('Testing Fail Verify');

  // Step 1: Generate a random numeric array binary file
  const handler = new BinaryHandler();
  handler.openFile(filePath);

  const randomArray = Array.from({ length: 100 }, () => Math.floor(Math.random() * 256));
  handler.array(randomArray, randomArray.length, 'uint8');

  // Step 2: Sign the file
  handler.signFile('private.key');

  // Step 3: Modify a part of the file
  const fileContent = readFileSync(filePath);
  fileContent[10] = fileContent[10] ^ 0xFF; // Modify the 11th byte to introduce an error
  writeFileSync(filePath, fileContent);

  // Step 4: Try to verify the file, expecting it to fail
  const isValid = handler.verifyFile('public.key');

  if (!isValid) {
    console.log(`${greenCheck} Test passed: File verification after modification failed as expected.`);
  } else {
    console.error(`${redCross} Test failed: File verification succeeded unexpectedly.`);
  }

  handler.closeFile();
}

function testRandomizedData() {
  console.log('Testing Randomized Data');

  function getRandomInt(max) {
    return Math.floor(Math.random() * max);
  }

  function getRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(getRandomInt(chars.length));
    }
    return result;
  }

  const randomData = {
    randomString: getRandomString(1000),
    randomNumber: getRandomInt(1000000),
    randomArray: Array.from({ length: 100 }, () => getRandomInt(1000)),
    randomBuffer: Buffer.alloc(100, getRandomInt(256)),
    nested: {
      nestedString: getRandomString(500),
      nestedNumber: getRandomInt(100000),
      nestedDate: new Date()
    }
  };
  const filePath = path.join(process.cwd(), 'randomizedData.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.pojo(randomData);
  handler.jump(0);
  const readRandomData = handler.pojo('randomData').last.value;

  assertEqual(randomData.randomString, readRandomData.randomString, 'Random Data randomString');
  assertEqual(randomData.randomNumber, readRandomData.randomNumber, 'Random Data randomNumber');
  assertNestedArrayEqual(randomData.randomArray, readRandomData.randomArray, 'Random Data randomArray');
  assertBufferEqual(randomData.randomBuffer, readRandomData.randomBuffer, 'Random Data randomBuffer');
  assertEqual(randomData.nested.nestedString, readRandomData.nested.nestedString, 'Random Data nestedString');
  assertEqual(randomData.nested.nestedNumber, readRandomData.nested.nestedNumber, 'Random Data nestedNumber');
  assertEqual(randomData.nested.nestedDate.toISOString(), readRandomData.nested.nestedDate.toISOString(), 'Random Data nestedDate');

  handler.signFile('private.key');
  if (!handler.verifyFile('public.key')) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testLargeDataSet() {
  console.log('Testing Large Data Set');

  const largeData = {
    largeString: 'A'.repeat(1000000), // 1 million 'A' characters
    largeArray: Array.from({ length: 10000 }, (_, i) => i), // Array with 10,000 integers
    largeBuffer: Buffer.alloc(1000000, 'B'), // Buffer with 1 million 'B' characters
    nested: {
      nestedString: 'C'.repeat(500000),
      nestedBuffer: Buffer.alloc(500000, 'D')
    }
  };
  const filePath = path.join(process.cwd(), 'largeDataSet.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.pojo(largeData);
  handler.jump(0);
  const readLargeData = handler.pojo('largeData').last.value;

  assertEqual(largeData.largeString, readLargeData.largeString, 'Large Data largeString');
  assertNestedArrayEqual(largeData.largeArray, readLargeData.largeArray, 'Large Data largeArray');
  assertBufferEqual(largeData.largeBuffer, readLargeData.largeBuffer, 'Large Data largeBuffer');
  assertEqual(largeData.nested.nestedString, readLargeData.nested.nestedString, 'Large Data nestedString');
  assertBufferEqual(largeData.nested.nestedBuffer, readLargeData.nested.nestedBuffer, 'Large Data nestedBuffer');

  handler.signFile('private.key');
  if (!handler.verifyFile('public.key')) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
  cleanUp(filePath, true);
}

function testComplexNestedStructures() {
  console.log('Testing Complex Nested Structures');

  const complexNested = {
    level1: {
      string: 'hello',
      number: 12345,
      date: new Date(),
      nestedArray: [1, 'two', { three: 3 }],
      nestedPojo: {
        key: 'value',
        array: [4, 5, 6],
        nestedSet: new Set([7, 8, 9])
      }
    },
    level2: new Map([
      ['first', 'value1'],
      ['second', { key: 'value2', nestedDate: new Date() }]
    ]),
    level3: new Set([
      { key: 'value3', nestedBuffer: Buffer.from('nested buffer') },
      'simpleString',
      new Date()
    ])
  };
  const filePath = path.join(process.cwd(), 'complexNestedStructures.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.pojo(complexNested);
  handler.jump(0);
  const readComplexNested = handler.pojo('complexNested').last.value;

  assertEqual(complexNested.level1.string, readComplexNested.level1.string, 'Complex Nested string');
  assertEqual(complexNested.level1.number, readComplexNested.level1.number, 'Complex Nested number');
  assertEqual(complexNested.level1.date.toISOString(), readComplexNested.level1.date.toISOString(), 'Complex Nested date');
  assertNestedArrayEqual(complexNested.level1.nestedArray, readComplexNested.level1.nestedArray, 'Complex Nested nestedArray');
  assertEqual(complexNested.level1.nestedPojo.key, readComplexNested.level1.nestedPojo.key, 'Complex Nested nestedPojo key');
  assertNestedArrayEqual(complexNested.level1.nestedPojo.array, readComplexNested.level1.nestedPojo.array, 'Complex Nested nestedPojo array');
  assertEqual(complexNested.level1.nestedPojo.nestedSet.size, readComplexNested.level1.nestedPojo.nestedSet.size, 'Complex Nested nestedPojo nestedSet size');

  assertEqual(complexNested.level2.size, readComplexNested.level2.size, 'Complex Nested Map size');
  assertEqual(complexNested.level2.get('first'), readComplexNested.level2.get('first'), 'Complex Nested Map first value');
  assertEqual(complexNested.level2.get('second').key, readComplexNested.level2.get('second').key, 'Complex Nested Map second key');
  assertEqual(complexNested.level2.get('second').nestedDate.toISOString(), readComplexNested.level2.get('second').nestedDate.toISOString(), 'Complex Nested Map second nestedDate');

  assertEqual(complexNested.level3.size, readComplexNested.level3.size, 'Complex Nested Set size');
  const originalSetArray = Array.from(complexNested.level3);
  const readSetArray = Array.from(readComplexNested.level3);
  for (let i = 0; i < originalSetArray.length; i++) {
    if (originalSetArray[i] instanceof Date) {
      assertEqual(originalSetArray[i].toISOString(), readSetArray[i].toISOString(), `Complex Nested Set element ${i}`);
    } else if (Buffer.isBuffer(originalSetArray[i])) {
      assertBufferEqual(originalSetArray[i], readSetArray[i], `Complex Nested Set element ${i}`);
    } else if (typeof originalSetArray[i] === 'object') {
      assertEqual(originalSetArray[i].key, readSetArray[i].key, `Complex Nested Set element ${i} key`);
      assertBufferEqual(originalSetArray[i].nestedBuffer, readSetArray[i].nestedBuffer, `Complex Nested Set element ${i} nestedBuffer`);
    } else {
      assertEqual(originalSetArray[i], readSetArray[i], `Complex Nested Set element ${i}`);
    }
  }

  handler.signFile('private.key');
  if (!handler.verifyFile('public.key')) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function bitTests() {
  testInterleavedBitFields(); // Run the interleaved bit fields tests
  testBitFields();
  testBitFieldCrossByteBoundary();
  enhancedBitFieldTests();
}

function testBigIntType() {
  console.log('Testing BigInt Type');

  const bigIntValue =  false ? 123456789123456789123456789123456789n : 32498573459823475984237593408275342908574239085742390854723590823475n;
  const filePath = path.join(process.cwd(), 'bigInt.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);

  // Writing BigInt
  handler.bigInt(bigIntValue);
  handler.jump(0);

  // Reading BigInt
  handler.bigInt('bigInt');
  const readBigInt = handler.$('bigInt').value;

  // Validate BigInt value
  assertEqual(bigIntValue.toString(), readBigInt.toString(), 'BigInt value');

  // Sign and verify the file
  handler.signFile('private.key');
  if (!handler.verifyFile('public.key')) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

function testBigIntInComplexStructures() {
  console.log('Testing BigInt in Complex Structures');

  const complexData = {
    id: 987654321987654321987654321987654321n,
    details: {
      name: 'BigInt Test',
      value: 123456789123456789123456789123456789n
    },
    happy: [
      {first: 32498573459823475984237593408275342908574239085742390854723590823475n, 'second': 'hello'},
      2345983753498574395834759834000034999912309944958734593487593408753490857349058342759824375n,
      {hi: true},
      {'nice': [1,2,3], 'big': 7395873425934759342857234908572349085742395084723590842375908234759048237542398n },
      32498573459823475984237593408275342908574239085742390854723590823475n,
    ]
  };
  const filePath = path.join(process.cwd(), 'bigIntComplex.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);

  // Writing complex data with BigInt
  handler.pojo(complexData);
  handler.jump(0);

  // Reading complex data with BigInt
  handler.pojo('complexData');
  const readData = handler.$('complexData').value;

  // Validate complex data with BigInt
  assertEqual(complexData.id.toString(), readData.id.toString(), 'Complex BigInt ID');
  assertEqual(complexData.details.name, readData.details.name, 'Complex BigInt Details Name');
  assertEqual(complexData.details.value.toString(), readData.details.value.toString(), 'Complex BigInt Details Value');
  assertEqual(complexData.happy[0].first.toString(), readData.happy[0].first.toString(), 'Complex BigInt Happy First');
  assertEqual(complexData.happy[0].second, readData.happy[0].second, 'Complex BigInt Happy Second');
  assertEqual(complexData.happy[1].toString(), readData.happy[1].toString(), 'Complex BigInt Happy Array:1(BigInt)');
  assertEqual(complexData.happy[2].hi, readData.happy[2].hi, 'Complex BigInt Happy Hi');
  assertEqual(complexData.happy[3].nice.toString(), readData.happy[3].nice.toString(), 'Complex BigInt Happy Nice Array:3(Array)');
  assertEqual(complexData.happy[3].big.toString(), readData.happy[3].big.toString(), 'Complex BigInt Happy Big Array:4(BigInt)');
  assertEqual(complexData.happy[4].toString(), readData.happy[4].toString(), 'Complex BigInt Happy Array:4(BigInt)');

  // Sign and verify the file
  handler.signFile('private.key');
  if (!handler.verifyFile('public.key')) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
  cleanUp(filePath);
}

function testJumpEnd() {
  console.log('Testing Jump End');

  const filePath = path.join(process.cwd(), 'jump_end_test.bin');

  // Step 1: Create and write initial data to the file
  const initialData = 'Hello, World!';
  const handler = new BinaryHandler();
  handler.openFile(filePath, { append: false });
  handler.buffer(Buffer.from(initialData)); // Write initial data
  handler.closeFile();

  // Step 2: Reopen the file in append mode and jump to the end
  handler.openFile(filePath, { append: true });
  // if append is true and the file was able to be opened for appending, 
  // then openFile will automatically jump to end

  // Step 3: Write additional data
  const additionalData = ' More data here!';
  handler.buffer(Buffer.from(additionalData));
  handler.closeFile();


  // Step 4: Verify the file content
  const expectedContent = initialData + additionalData;
  handler.openFile(filePath);
  const buf1 = handler.buffer().last.value;
  const buf2 = handler.buffer().last.value;
  const actual = Buffer.concat([buf1, buf2]);
  const actualContent = actual.toString();
  assertEqual(expectedContent, actualContent, 'Jump to end and append data');
}

async function testHardenedPojo() {
  console.log('Testing HPOJO Type');

  const handler = new BinaryHandler();
  await handler.setPublicKey(path.resolve(os.homedir(), '.ssh/id_rsa.pub'));
  await handler.setPrivateKey(path.resolve(os.homedir(), '.ssh/id_rsa'));
  const pojo = {
    name: 'Test',
    age: 30,
    nested: {
      key: 'value',
      array: [1, 'two', new Date()]
    }
  };
  const filePath = path.join(process.cwd(), 'hpojo.bin');

  handler.openFile(filePath);
  pojo[BinaryHandler.hard] = true;
  handler.hpojo(pojo);
  handler.jump(0);

  const readPojo = handler.hpojo().last.value;

  assertEqual(pojo.name, readPojo.name, 'HPOJO name');
  assertEqual(pojo.age, readPojo.age, 'HPOJO age');
  assertEqual(pojo.nested.key, readPojo.nested.key, 'HPOJO nested key');
  assertEqual(pojo.nested.array[0], readPojo.nested.array[0], 'HPOJO nested array number');
  assertEqual(pojo.nested.array[1], readPojo.nested.array[1], 'HPOJO nested array string');
  assertEqual(pojo.nested.array[2].toISOString(), readPojo.nested.array[2].toISOString(), 'HPOJO nested array date');


  handler.signFile('private.key');
  if ( ! handler.verifyFile('public.key') ) {
    console.error(`${redCross} Test failed: File failed to verify.`);
  } else {
    console.log(`${greenCheck} Test passed: File signature successfully verified.`);
  }

  handler.closeFile();
}

async function runTests() {
  readdirSync('.').forEach(name => name.endsWith('.bin') && cleanUp(name, true));

  if (BIT_ONLY) {
    bitTests();
  } else {
    await testHardenedPojo();
    testColorType();
    bitTests();
    testBufferType();
    testMagicNumber();
    testMagicString();
    testMagicBuffer();
    testHeteroArray();
    testNestedArray();
    testDateType();
    testFloatType();
    testPojoType();
    testMixedTypeArray();
    testComplexNonLatinObject();
    testMapWithPojo();
    testPojoWithMap();
    testMapType();
    testSetType();
    testSetWithPojo();
    testPojoWithSet();
    runGzipTests();
    testFailVerify();
    testComplexNestedStructures();
    LARGE && testLargeDataSet();
    testBinarySerialization();
    testRandomizedData();
    testAlphabetSoup();
    testBigIntType();
    testBigIntInComplexStructures();
    testJumpEnd();
  }

  cleanUp('private.key', true);
  cleanUp('public.key', true);
}

//runTests();
testHardenedPojo();



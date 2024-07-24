import path from 'path';
import { unlinkSync, readFileSync, existsSync, writeFileSync, readdirSync } from 'fs';
import { BinaryHandler } from '../bits.js';

const greenCheck = '\x1b[32m✓\x1b[0m';
const redCross = '\x1b[31m✗\x1b[0m';

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

function assertBufferEqual(expected, actual, message) {
  if (Buffer.compare(expected, actual) !== 0) {
    console.error(`${redCross} Test failed: ${message}\nExpected: ${expected.toString('hex')}\nActual: ${actual.toString('hex')}`);
  } else {
    console.log(`${greenCheck} Test passed: ${message}`);
  }
}

function testInterleavedBitFields() {
  console.log('Testing Interleaved Bit Fields');

  const filePath = path.join('interleaved_bit_fields.bin');
  const bh = new BinaryHandler();
  bh.openFile(filePath);

  // Writing interleaved bit fields and other types
  bh.bit(3, 5);    // 3 bits with value 5 (101 in binary)
  bh.bit(5, 19);   // 5 bits with value 19 (10011 in binary)
  bh.bit(7, 77);   // 7 bits with value 77 (1001101 in binary)

  // Reset buffer for reading
  bh.jump(0);

  // Reading interleaved bit fields and other types
  bh.bit(3, 'bit3');
  bh.bit(5, 'bit5');
  bh.bit(7, 'bit7');

  const result = bh.read();

  assertEqual(5, result.bit3.value, 'Interleaved Bit3 value');
  assertEqual(19, result.bit5.value, 'Interleaved Bit5 value');
  assertEqual(77, result.bit7.value, 'Interleaved Bit7 value');

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

  bh.closeFile();
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

function bitTests() {
  readdirSync('.').forEach(name => name.endsWith('.bin') && cleanUp(name, true));

  testInterleavedBitFields(); // Run the interleaved bit fields tests
  testBitFields();
  testBitFieldCrossByteBoundary();
  enhancedBitFieldTests();
}

bitTests();


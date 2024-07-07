import { BinaryHandler, BinaryTypes } from './binary-bliss.js';
import { unlinkSync, readFileSync, existsSync } from 'fs';
import path from 'path';

const greenCheck = '\x1b[32m✓\x1b[0m';
const redCross = '\x1b[31m✗\x1b[0m';

function cleanUp(filePath) {
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

function assertEqual(expected, actual, message) {
  if (expected !== actual) {
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
  handler.closeFile();

  assertEqual(color.red, readColor.red.value, 'Color red');
  assertEqual(color.green, readColor.green.value, 'Color green');
  assertEqual(color.blue, readColor.blue.value, 'Color blue');

  cleanUp(filePath);
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
  const readMap = handler.map('map').value.value;
  handler.closeFile();

  assertEqual(map.size, readMap.size, 'Map size');
  for (const [key, value] of map.entries()) {
    assertEqual(value, readMap.get(key), `Map entry ${key}`);
  }

  cleanUp(filePath);
}

function testHeteroArray() {
  console.log('Testing Heterogeneous Array');

  const array = ['012', 345, new Date()];
  const filePath = path.join(process.cwd(), 'heteroArray.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.heteroArray(array);
  handler.jump(0);
  const readArray = handler.heteroArray('array').value.value;
  handler.closeFile();

  assertEqual(array[0], readArray[0], 'HeteroArray string');
  assertEqual(array[1], readArray[1], 'HeteroArray number');
  assertEqual(array[2].toISOString(), readArray[2].toISOString(), 'HeteroArray date');

  cleanUp(filePath);
}

function testDateType() {
  console.log('Testing Date Type');

  const date = new Date();
  const filePath = path.join(process.cwd(), 'date.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.date(date);
  handler.jump(0);
  const readDate = handler.date('date').value.value;
  handler.closeFile();

  assertEqual(date.toISOString(), readDate.toISOString(), 'Date value');

  cleanUp(filePath);
}

function testFloatType() {
  console.log('Testing Float Type');

  const float = 123.456;
  const filePath = path.join(process.cwd(), 'float.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.float(float);
  handler.jump(0);
  const readFloat = handler.float('float').value.value;
  handler.closeFile();

  assertEqual(float.toFixed(3), readFloat.toFixed(3), 'Float value');

  cleanUp(filePath);
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
  handler.closeFile();

  assertBufferEqual(buffer, handler.$('buffer').value, 'Buffer value');

  cleanUp(filePath);
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
  handler.closeFile();

  assertEqual(magicNumber, handler.value.value, 'Magic number');

  cleanUp(filePath);
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
  handler.closeFile();

  assertEqual(magicString, handler.value.value, 'Magic string');

  cleanUp(filePath);
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
  handler.closeFile();

  assertBufferEqual(magicBuffer, handler.$('magic').value, 'Magic buffer');

  cleanUp(filePath);
}

function runTests() {
  testColorType();
  testBufferType();
  testMagicNumber();
  testMagicString();
  testMagicBuffer();
  testMapType();
  testHeteroArray();
  testDateType();
  testFloatType();
}

runTests();


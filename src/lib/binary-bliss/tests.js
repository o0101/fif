import { BinaryHandler, BinaryTypes } from './binary-bliss.js';
import { unlinkSync, readFileSync, existsSync } from 'fs';
import path from 'path';

const greenCheck = '\x1b[32m✓\x1b[0m';
const redCross = '\x1b[31m✗\x1b[0m';

function cleanUp(filePath) {
  return;
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

function testMixedTypeArray() {
  console.log('Testing Mixed Type Array');

  const array = ['hello', 123, new Date(), { foo: 'bar' }, [1, 2, 3]];
  const filePath = path.join(process.cwd(), 'mixedArray.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.heteroArray(array);
  handler.jump(0);
  const readArray = handler.heteroArray('array').value.value;
  handler.closeFile();

  assertEqual(array[0], readArray[0], 'MixedTypeArray string');
  assertEqual(array[1], readArray[1], 'MixedTypeArray number');
  assertEqual(array[2].toISOString(), readArray[2].toISOString(), 'MixedTypeArray date');
  assertEqual(array[3].foo, readArray[3].foo, 'MixedTypeArray object');
  assertEqual(array[4].toString(), readArray[4].toString(), 'MixedTypeArray array');

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
  const readPojo = handler.pojo('pojo').value.value;
  handler.closeFile();

  assertEqual(pojo.name, readPojo.name, 'POJO name');
  assertEqual(pojo.age, readPojo.age, 'POJO age');
  assertEqual(pojo.nested.key, readPojo.nested.key, 'POJO nested key');
  assertEqual(pojo.nested.array[0], readPojo.nested.array[0], 'POJO nested array number');
  assertEqual(pojo.nested.array[1], readPojo.nested.array[1], 'POJO nested array string');
  assertEqual(pojo.nested.array[2].toISOString(), readPojo.nested.array[2].toISOString(), 'POJO nested array date');

  cleanUp(filePath);
}

function testComplexNonLatinObject() {
  console.log('Testing Complex Object with Non-Latin Characters');

  const complexObject = {
    greeting: "你好",
    farewell: "مع السلامة",
    mixed: "Hello, 你好, مرحبا!",
    nested: {
      question: "你好吗？",
      answer: "الحمد لله"
    }
  };
  const filePath = path.join(process.cwd(), 'complex_non_latin_object.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.pojo(complexObject);
  handler.jump(0);
  const readObject = handler.pojo('complexObject').value.value;
  handler.closeFile();

  assertEqual(complexObject.greeting, readObject.greeting, 'Complex object greeting');
  assertEqual(complexObject.farewell, readObject.farewell, 'Complex object farewell');
  assertEqual(complexObject.mixed, readObject.mixed, 'Complex object mixed');
  assertEqual(complexObject.nested.question, readObject.nested.question, 'Complex object nested question');
  assertEqual(complexObject.nested.answer, readObject.nested.answer, 'Complex object nested answer');

  cleanUp(filePath);
}

function testMapWithPojo() {
  console.log('Testing Map with POJO Value');

  const mapWithPojo = new Map();
  mapWithPojo.set('key1', 'value1');
  mapWithPojo.set('key2', { name: 'Test', greeting: "你好" });

  const filePath = path.join(process.cwd(), 'map_with_pojo.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.map(mapWithPojo);
  handler.jump(0);
  const readMap = handler.map('mapWithPojo').value.value;
  handler.closeFile();

  assertEqual(mapWithPojo.size, readMap.size, 'Map with POJO size');
  assertEqual(mapWithPojo.get('key1'), readMap.get('key1'), 'Map with POJO key1 value');
  assertEqual(mapWithPojo.get('key2').name, readMap.get('key2').name, 'Map with POJO key2 name');
  assertEqual(mapWithPojo.get('key2').greeting, readMap.get('key2').greeting, 'Map with POJO key2 greeting');

  cleanUp(filePath);
}

function testPojoWithMap() {
  console.log('Testing POJO with Map Value');

  const pojoWithMap = {
    name: 'Test POJO',
    details: new Map([
      ['language', 'JavaScript'],
      ['greeting', '你好']
    ])
  };

  const filePath = path.join(process.cwd(), 'pojo_with_map.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.pojo(pojoWithMap);
  handler.jump(0);
  const readPojo = handler.pojo('pojoWithMap').value.value;
  handler.closeFile();

  assertEqual(pojoWithMap.name, readPojo.name, 'POJO with Map name');
  assertEqual(pojoWithMap.details.size, readPojo.details.size, 'POJO with Map details size');
  assertEqual(pojoWithMap.details.get('language'), readPojo.details.get('language'), 'POJO with Map details language');
  assertEqual(pojoWithMap.details.get('greeting'), readPojo.details.get('greeting'), 'POJO with Map details greeting');

  cleanUp(filePath);
}

function testSetType() {
  console.log('Testing Set Type');

  const set = new Set([1, 'two', new Date()]);
  const filePath = path.join(process.cwd(), 'set.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.set(set);
  handler.jump(0);
  const readSet = handler.set('set').value.value;
  handler.closeFile();

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

  cleanUp(filePath);
}

function testPojoWithSet() {
  console.log('Testing POJO with Set Value');

  const pojoWithSet = {
    name: 'Test POJO',
    details: new Set(['JavaScript', '你好'])
  };

  const filePath = path.join(process.cwd(), 'pojo_with_set.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.pojo(pojoWithSet);
  handler.jump(0);
  const readPojo = handler.pojo('pojoWithSet').value.value;
  handler.closeFile();

  assertEqual(pojoWithSet.name, readPojo.name, 'POJO with Set name');
  assertEqual(pojoWithSet.details.size, readPojo.details.size, 'POJO with Set details size');

  const detailsArray = Array.from(pojoWithSet.details);
  const readDetailsArray = Array.from(readPojo.details);
  for (let i = 0; i < detailsArray.length; i++) {
    assertEqual(detailsArray[i], readDetailsArray[i], `POJO with Set details element ${i}`);
  }

  cleanUp(filePath);
}

function testSetWithPojo() {
  console.log('Testing Set with POJO Value');

  const setWithPojo = new Set([
    { language: 'JavaScript', greeting: '你好' },
    { language: 'Python', greeting: 'مرحبا' }
  ]);

  const filePath = path.join(process.cwd(), 'set_with_pojo.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.set(setWithPojo);
  handler.jump(0);
  const readSet = handler.set('setWithPojo').value.value;
  handler.closeFile();

  const setArray = Array.from(setWithPojo);
  const readSetArray = Array.from(readSet);

  assertEqual(setArray.length, readSetArray.length, 'Set with POJO length');
  for (let i = 0; i < setArray.length; i++) {
    assertEqual(setArray[i].language, readSetArray[i].language, `Set with POJO element ${i} language`);
    assertEqual(setArray[i].greeting, readSetArray[i].greeting, `Set with POJO element ${i} greeting`);
  }

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
  testPojoType();
  testMixedTypeArray();
  testComplexNonLatinObject();
  testMapWithPojo();
  testPojoWithMap();
  testSetType();
  testSetWithPojo();
  testPojoWithSet();
}

runTests();


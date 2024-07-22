import { BinaryHandler, BinaryTypes } from '../binary-bliss.js';
import { unlinkSync, readFileSync, existsSync, writeFileSync, readdirSync } from 'fs';
import path from 'path';
import * as eddsa from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
eddsa.etc.sha512Sync = (...m) => sha512(eddsa.etc.concatBytes(...m));


const greenCheck = '\x1b[32m✓\x1b[0m';
const redCross = '\x1b[31m✗\x1b[0m';

const privateKey = eddsa.utils.randomPrivateKey();
const publicKey = eddsa.getPublicKey(privateKey);

function saveKeys() {
  writeFileSync('private.key', Buffer.from(privateKey).toString('hex'), 'utf8');
  writeFileSync('public.key', Buffer.from(publicKey).toString('hex'), 'utf8');
}

saveKeys();

function cleanUp(filePath, actuallyDo = true) {
  if ( ! actuallyDo ) return;
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

  // because we need color.bin for subserquent tests
  // cleanUp(filePath, false);
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

function runTests() {
  readdirSync('.').forEach(name => name.endsWith('.bin') && cleanUp(name, true));

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
  runGzipTests();
  testFailVerify();

  cleanUp('private.key', true);
  cleanUp('public.key', true);
}

runTests();


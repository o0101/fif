import { BinaryHandler, BinaryTypes } from './binary-bliss.js';
import { unlinkSync } from 'fs';
import path from 'path';

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

  console.log('Written Color:', color);
  console.log('Read Color:', readColor);

  //unlinkSync(filePath); // Clean up the file after test
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
  map.set('key1', 'value1');
  map.set('key2', 'value2');
  const filePath = path.join(process.cwd(), 'map.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  writeMap(handler, map);
  handler.jump(0);
  const readMap = readMapType(handler);
  handler.closeFile();

  console.log('Written Map:', Array.from(map.entries()));
  console.log('Read Map:', Array.from(readMap.entries()));

  //unlinkSync(filePath); // Clean up the file after test
}

function testHeteroArray() {
  console.log('Testing Heterogeneous Array');

  BinaryTypes.define('HeteroArrayElement', [
    { name: 'type', type: 'uint8' },
    { name: 'value', type: 'gets' }
  ]);

  const array = ['value1', 'value2'];
  const filePath = path.join(process.cwd(), 'heteroArray.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  writeHeteroArray(handler, array);
  handler.jump(0);
  const readArray = readHeteroArray(handler, array.length);
  handler.closeFile();

  console.log('Written Array:', array);
  console.log('Read Array:', readArray);

  //unlinkSync(filePath); // Clean up the file after test
}

function writeMap(handler, map) {
  handler.uint32(map.size);
  for (const [key, value] of map.entries()) {
    BinaryTypes.write(handler, 'MapEntry', { key, value });
  }
}

function readMapType(handler) {
  const map = new Map();
  handler.uint32('length');
  const length = handler.reading.find(f => f.key === 'length').value;

  for (let i = 0; i < length; i++) {
    const entry = BinaryTypes.read(handler, 'MapEntry');
    map.set(entry.key, entry.value);
  }
  return map;
}

function writeHeteroArray(handler, array) {
  handler.uint32(array.length);
  for (const element of array) {
    let type;
    if (typeof element === 'string') {
      type = 1;
    }
    // Handle other types
    BinaryTypes.write(handler, 'HeteroArrayElement', { type, value: element });
  }
}

function readHeteroArray(handler, length) {
  const array = [];
  for (let i = 0; i < length; i++) {
    const element = BinaryTypes.read(handler, 'HeteroArrayElement');
    switch (element.type) {
      case 1:
        array.push(element.value); // Assuming type 1 is string
        break;
      // Handle other types
    }
  }
  return array;
}

function runTests() {
  testColorType();
  testMapType();
  testHeteroArray();
}

runTests();


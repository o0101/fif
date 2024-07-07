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
  console.log('Most Recent Value:', handler.value);
  console.log('Value by Key (green):', handler.$('green'));

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

  console.log('Written Map:', map);
  console.log('Read Map:', readMap);
  console.log('Most Recent Value:', handler.value);
  console.log('Value by Key (key2):', handler.$('key2'));

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
  const readArray = readHeteroArray(handler);
  handler.closeFile();

  console.log('Written Array:', array);
  console.log('Read Array:', readArray);
  console.log('Most Recent Value:', handler.value);
  console.log('Value by Key (value_0):', handler.$('value_0'));

  //unlinkSync(filePath); // Clean up the file after test
}

function writeMap(handler, map) {
  handler.uint32(map.size);
  for (const [key, value] of map.entries()) {
    handler.puts(key);
    handler.puts(value);
  }
}

function readMapType(handler) {
  const map = new Map();
  handler.uint32('length');
  const length = handler.$('length').value;

  for (let i = 0; i < length; i++) {
    handler.gets('key');
    handler.gets('value');
    const key = handler.$('key').value;
    const value = handler.$('value').value;
    map.set(key, value);
  }
  return map;
}

function writeHeteroArray(handler, array) {
  handler.uint32(array.length);
  for (let i = 0; i < array.length; i++) {
    const element = array[i];
    let type;
    if (typeof element === 'string') {
      type = 1;
      handler.uint8(type);
      handler.puts(element);
    }
    // Handle other types similarly
  }
}

function readHeteroArray(handler) {
  const array = [];
  handler.uint32('length');
  const length = handler.$('length').value;
  for (let i = 0; i < length; i++) {
    handler.uint8(`type_${i}`);
    const type = handler.$(`type_${i}`).value;
    let value;
    switch (type) {
      case 1:
        handler.gets(`value_${i}`);
        value = handler.$(`value_${i}`).value;
        break;
      // Handle other types similarly
    }
    array.push(value);
  }
  return array;
}

function runTests() {
  testColorType();
  testMapType();
  testHeteroArray();
}

runTests();


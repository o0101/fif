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
  map.set('abc', '123');
  map.set('def', '456');
  const filePath = path.join(process.cwd(), 'map.bin');

  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.map(map);
  handler.jump(0);
  const readMap = handler.map('map').value.value;
  handler.closeFile();

  console.log('Written Map:', map);
  console.log('Read Map:', readMap);
  console.log('Most Recent Value:', handler.value);
  console.log('Value by Key (key1):', handler.$('key1'));

  //unlinkSync(filePath); // Clean up the file after test
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

  console.log('Written Array:', array);
  console.log('Read Array:', readArray);
  console.log('Most Recent Value:', handler.value);
  console.log('Value by Key (value_0):', handler.$('value_0'));

  //unlinkSync(filePath); // Clean up the file after test
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

  console.log('Written Date:', date);
  console.log('Read Date:', readDate);
  console.log('Most Recent Value:', handler.value);
  console.log('Value by Key (date):', handler.$('date'));

  //unlinkSync(filePath); // Clean up the file after test
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

  console.log('Written Float:', float);
  console.log('Read Float:', readFloat);
  console.log('Most Recent Value:', handler.value);
  console.log('Value by Key (float):', handler.$('float'));

  //unlinkSync(filePath); // Clean up the file after test
}

function runTests() {
  testColorType();
  testMapType();
  testHeteroArray();
  testDateType();
  testFloatType();
}

runTests();


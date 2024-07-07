import { BinaryHandler, BinaryTypes, BinaryUtils, BinaryTests } from './binary-bliss.js';

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

async function readColor(stream) {
  const handler = new BinaryHandler(stream);
  const data = await BinaryTypes.read(handler, 'Color');
  console.log(data.red, data.green, data.blue);
}

async function writeColor(stream, color) {
  const handler = new BinaryHandler(stream, 'write');
  await BinaryTypes.write(handler, 'Color', color);
  await handler.write();
}

// Utility functions
const paddedBits = BinaryUtils.padBits([1, 0, 1], 8);
const choppedBits = BinaryUtils.chopBits([1, 0, 1, 1, 0, 0, 1, 1], 4);

// Run tests and fuzzing
BinaryTests.run();
BinaryTests.fuzz();


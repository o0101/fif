import { BinaryHandler, BinaryTypes, BinaryUtils } from './binary-bliss.js';
import { Readable, Writable } from 'stream';
import { Buffer } from 'buffer';

class DebugBinaryHandler extends BinaryHandler {
  async _readNextChunk() {
    console.log('_readNextChunk called');
    return new Promise((resolve, reject) => {
      this.stream.once('data', chunk => {
        console.log('Received chunk:', chunk);
        this.buffer = Buffer.concat([this.buffer, chunk]);
        resolve();
      });
      this.stream.once('error', err => {
        console.log('Error in _readNextChunk:', err);
        reject(err);
      });
    });
  }

  async _ensureBytes(length) {
    console.log(`_ensureBytes called with length ${length}`);
    while (this.buffer.length - this.cursor < length) {
      console.log(`Buffer length ${this.buffer.length}, cursor ${this.cursor}`);
      await this._readNextChunk();
    }
  }
}

async function testColorType() {
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

  // Collect written data in a buffer
  let writtenBuffer = Buffer.alloc(0);
  const writeStream = new Writable({
    write(chunk, encoding, callback) {
      console.log('Writing chunk:', chunk);
      writtenBuffer = Buffer.concat([writtenBuffer, chunk]);
      callback();
    }
  });

  const writeHandler = new DebugBinaryHandler(writeStream, 'write');
  await BinaryTypes.write(writeHandler, 'Color', color);
  await writeHandler.write();

  console.log('Finished writing. Written Buffer:', writtenBuffer);

  // Wait for the writable stream to finish
  writeStream.on('finish', async () => {
    const readStream = new Readable({
      read() {
        console.log('Pushing buffer to read stream:', writtenBuffer);
        this.push(writtenBuffer);
        this.push(null);
      }
    });

    const readHandler = new DebugBinaryHandler(readStream, 'read');
    const readColor = await BinaryTypes.read(readHandler, 'Color');

    console.log('Written Color:', color);
    console.log('Read Color:', readColor);
  });

  writeStream.end(); // Ensure the stream ends to trigger the 'finish' event
}

async function testMapType() {
  console.log('Testing Map Type');

  BinaryTypes.define('MapEntry', [
    { name: 'key', type: 'str' },
    { name: 'value', type: 'str' }
  ]);

  BinaryTypes.define('Map', [
    { name: 'length', type: 'uint32' },
    { name: 'entries', type: 'array', subtype: 'MapEntry' }
  ]);

  const map = new Map();
  map.set('key1', 'value1');
  map.set('key2', 'value2');

  // Collect written data in a buffer
  let writtenBuffer = Buffer.alloc(0);
  const writeStream = new Writable({
    write(chunk, encoding, callback) {
      console.log('Writing chunk:', chunk);
      writtenBuffer = Buffer.concat([writtenBuffer, chunk]);
      callback();
    }
  });

  const writeHandler = new DebugBinaryHandler(writeStream, 'write');
  await writeMap(writeHandler, map);
  await writeHandler.write();

  console.log('Finished writing. Written Buffer:', writtenBuffer);

  // Wait for the writable stream to finish
  writeStream.on('finish', async () => {
    const readStream = new Readable({
      read() {
        console.log('Pushing buffer to read stream:', writtenBuffer);
        this.push(writtenBuffer);
        this.push(null);
      }
    });

    const readHandler = new DebugBinaryHandler(readStream, 'read');
    const readMap = await readMapType(readHandler);

    console.log('Written Map:', Array.from(map.entries()));
    console.log('Read Map:', Array.from(readMap.entries()));
  });

  writeStream.end(); // Ensure the stream ends to trigger the 'finish' event
}

async function testHeteroArray() {
  console.log('Testing Heterogeneous Array');

  BinaryTypes.define('HeteroArrayElement', [
    { name: 'type', type: 'uint8' },
    { name: 'value', type: 'str' }
  ]);

  const array = ['value1', 'value2'];

  // Collect written data in a buffer
  let writtenBuffer = Buffer.alloc(0);
  const writeStream = new Writable({
    write(chunk, encoding, callback) {
      console.log('Writing chunk:', chunk);
      writtenBuffer = Buffer.concat([writtenBuffer, chunk]);
      callback();
    }
  });

  const writeHandler = new DebugBinaryHandler(writeStream, 'write');
  await writeHeteroArray(writeHandler, array);
  await writeHandler.write();

  console.log('Finished writing. Written Buffer:', writtenBuffer);

  // Wait for the writable stream to finish
  writeStream.on('finish', async () => {
    const readStream = new Readable({
      read() {
        console.log('Pushing buffer to read stream:', writtenBuffer);
        this.push(writtenBuffer);
        this.push(null);
      }
    });

    const readHandler = new DebugBinaryHandler(readStream, 'read');
    const readArray = await readHeteroArray(readHandler, array.length);

    console.log('Written Array:', array);
    console.log('Read Array:', readArray);
  });

  writeStream.end(); // Ensure the stream ends to trigger the 'finish' event
}

async function writeMap(handler, map) {
  await handler.uint32(map.size).write();
  for (const [key, value] of map.entries()) {
    await BinaryTypes.write(handler, 'MapEntry', { key, value });
  }
}

async function readMapType(handler) {
  const map = new Map();
  await handler.uint32('length').read();
  const length = handler.reading.find(f => f.key === 'length').value;

  for (let i = 0; i < length; i++) {
    const entry = await BinaryTypes.read(handler, 'MapEntry');
    map.set(entry.key, entry.value);
  }
  return map;
}

async function writeHeteroArray(handler, array) {
  await handler.uint32(array.length).write();
  for (const element of array) {
    let type;
    if (typeof element === 'string') {
      type = 1;
    }
    // Handle other types
    await BinaryTypes.write(handler, 'HeteroArrayElement', { type, value: element });
  }
}

async function readHeteroArray(handler, length) {
  const array = [];
  for (let i = 0; i < length; i++) {
    const element = await BinaryTypes.read(handler, 'HeteroArrayElement');
    switch (element.type) {
      case 1:
        array.push(element.value); // Assuming type 1 is string
        break;
      // Handle other types
    }
  }
  return array;
}

async function runTests() {
  await testColorType();
  await testMapType();
  await testHeteroArray();
}

runTests();


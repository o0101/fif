import { openSync, readSync, writeSync, closeSync, fstatSync, statSync, existsSync } from 'fs';
import { Buffer } from 'buffer';
import path from 'path';

const MAX_BUFFER_SIZE = 1024 * 1024 * 128; // 128 MB
const DEBUG = true;

class BinaryHandler {
  constructor(endian = 'BE') {
    this.endian = endian;
    this._buffer = Buffer.alloc(0);
    this.cursor = 0;
    this.bitCursor = 0;
    this.reading = [];
    this.fd = null;
    this.bitRemainder = 0; // Remainder bits from previous reads
    this.bitRemainderLength = 0; // Number of remainder bits
  }

  jump(cursorPosition) {
    DEBUG && console.log(`Jumping to cursor position: ${cursorPosition}`);
    if (this._buffer.length) {
      this._writeBytes(this._buffer);
      this._buffer = Buffer.alloc(0);
    }
    this.cursor = cursorPosition;
    this.bitCursor = 0;
    return this;
  }

  // Function to write bits into a buffer with bitOffset
  writeBits(length, value, buffer, bitOffset = 0) {
    if (typeof length !== 'number' || length <= 0 || !Number.isInteger(length)) {
      throw new Error('Length must be a positive integer');
    }

    value = BigInt(value);
    DEBUG && console.log(`\nWriting bits: length=${length}, value=${value.toString(2)}, bitOffset=${bitOffset}`);

    const byteAddr = i => Math.floor((i + bitOffset) / 8);
    const bitAddr = i => (i + bitOffset) % 8;

    for (let i = 0; i < length; i++) {
      const mask = 1n << BigInt(length - 1 - i);
      const iBit = (value & mask) >> BigInt(length - 1 - i);
      const byteIndex = byteAddr(i);
      const bitIndex = bitAddr(i);

      if (bitIndex === 0 && byteIndex >= buffer.length) {
        buffer = Buffer.concat([buffer, Buffer.alloc(1)]); // Extend the buffer
      }

      DEBUG && console.log(`Setting bit at byteIndex=${byteIndex}, bitIndex=${bitIndex}, iBit=${iBit}`);
      buffer[byteIndex] |= Number(iBit) << bitIndex;
    }

    DEBUG && console.log(`Buffer after writeBits: ${buffer.toString('hex')}`);
    return { buffer, bitOffset: (bitOffset + length) % 8 };
  }

  // Function to read bits from a buffer with bitOffset
  readBits(length, buffer, bitOffset = 0) {
    if (typeof length !== 'number' || length <= 0 || !Number.isInteger(length)) {
      throw new Error('Length must be a positive integer');
    }

    let value = BigInt(0);
    DEBUG && console.log(`\nReading bits: length=${length}, bitOffset=${bitOffset}`);

    const byteAddr = i => Math.floor((i + bitOffset) / 8);
    const bitAddr = i => (i + bitOffset) % 8;

    for (let i = 0; i < length; i++) {
      const byteIndex = byteAddr(i);
      const bitIndex = bitAddr(i);

      const bit = (buffer[byteIndex] >> bitIndex) & 1;
      value |= BigInt(bit) << BigInt(length - 1 - i);
      DEBUG && console.log(`Reading bit at byteIndex=${byteIndex}, bitIndex=${bitIndex}, bit=${bit}`);
    }

    DEBUG && console.log(`Value after readBits: ${value.toString(2)}`);
    return { value, bitOffset: (bitOffset + length) % 8 };
  }

  bit(length, keyOrValue) {
    const byteLength = Math.ceil((this.bitCursor + length) / 8);
    DEBUG && console.log(`\nBit operation: length=${length}, keyOrValue=${keyOrValue}, byteLength=${byteLength}`);
    if (typeof keyOrValue === 'string') {
      // Read mode
      if (byteLength > this._buffer.length) {
        this._buffer = Buffer.concat([this._buffer, this._readBytes(byteLength - this._buffer.length)]);
      }

      // Combine remainder bits with new bits if necessary
      if (this.bitRemainderLength > 0) {
        const totalBits = this.bitRemainderLength + length;
        const remainderShift = BigInt(this.bitRemainder) << BigInt(length);
        const { value: newBits, bitOffset } = this.readBits(totalBits, this._buffer, this.bitCursor);
        const combinedValue = remainderShift | newBits;
        this.bitRemainder = 0;
        this.bitRemainderLength = 0;

        // Handle any unused bits from combined value
        const unusedBits = totalBits - length;
        const finalValue = combinedValue >> BigInt(unusedBits);
        const newRemainder = combinedValue & ((1n << BigInt(unusedBits)) - 1n);

        this.reading.push({ key: keyOrValue, value: finalValue, type: `bit_${length}` });
        this.bitCursor = bitOffset;

        if (unusedBits > 0) {
          this.bitRemainder = Number(newRemainder);
          this.bitRemainderLength = unusedBits;
        }

        DEBUG && console.log(`Combined read: finalValue=${finalValue.toString(2)}, newRemainder=${newRemainder.toString(2)}, bitCursor=${this.bitCursor}`);
      } else {
        const { value, bitOffset } = this.readBits(length, this._buffer, this.bitCursor);
        this.reading.push({ key: keyOrValue, value, type: `bit_${length}` });
        this.bitCursor = bitOffset;
        DEBUG && console.log(`Direct read: value=${value.toString(2)}, bitCursor=${this.bitCursor}`);
      }

      return this;
    } else {
      // Write mode
      const value = BigInt(keyOrValue);
      if (byteLength > this._buffer.length) {
        this._buffer = Buffer.concat([this._buffer, Buffer.alloc(byteLength - this._buffer.length)]);
      }
      const { buffer, bitOffset } = this.writeBits(length, value, this._buffer, this.bitCursor);
      this.bitCursor = bitOffset;
      this._buffer = buffer;

      DEBUG && console.log(`Write operation: buffer=${buffer.toString('hex')}, bitCursor=${this.bitCursor}`);
      return this;
    }
  }

  openFile(filePath) {
    const safePath = path.resolve(filePath);
    if (!existsSync(safePath)) {
      this.fd = openSync(safePath, 'w+');
    } else {
      const stats = statSync(safePath);
      const isWritable = (stats.mode & 0o200) !== 0;
      this.fd = openSync(safePath, isWritable ? 'r+' : 'r');
    }
    this.filePath = filePath;
    DEBUG && console.log(`File opened: ${this.filePath}, fd=${this.fd}`);
    return this;
  }

  closeFile() {
    if (this._buffer.length) {
      this._writeBytes(this._buffer);
      this._buffer = Buffer.alloc(0);
    }
    if (this.fd !== null) {
      closeSync(this.fd);
      this.fd = null;
    }
    DEBUG && console.log(`File closed: ${this.filePath}`);
    return this;
  }

  _validateLength(length) {
    if (typeof length !== 'number' || length <= 0 || length > MAX_BUFFER_SIZE) {
      console.error({ length });
      throw new Error('Invalid length');
    }
  }

  _validateBuffer(buffer) {
    if (!Buffer.isBuffer(buffer)) {
      throw new Error('Invalid buffer');
    }
  }

  _ensureBytes(length) {
    if (this.fd === null) {
      throw new Error('File is not open');
    }
    const stats = fstatSync(this.fd);
    if (this.cursor + length > stats.size) {
      throw new Error('Insufficient data in file');
    }
  }

  _readBytes(length, opts = {}) {
    try {
      this._validateLength(length);
      const stats = fstatSync(this.fd);
      if (this.cursor + length > stats.size) {
        throw new Error('Insufficient data in file');
      }

      const buffer = Buffer.alloc(length);
      readSync(this.fd, buffer, 0, length, this.cursor);
      if (opts.decode && ETEXT) {
        BinaryUtils.decode(buffer);
      }
      this.cursor += length;

      DEBUG && console.log(`Read bytes: length=${length}, cursor=${this.cursor}, buffer=${buffer.toString('hex')}`);
      return buffer;
    } catch (error) {
      console.error('Error reading bytes:', error);
      throw error;
    }
  }

  _writeBytes(buffer, opts = {}) {
    if (!buffer.length) return;
    try {
      this._validateBuffer(buffer);
      if (opts.encode && ETEXT) {
        BinaryUtils.encode(buffer);
      }
      writeSync(this.fd, buffer, 0, buffer.length, this.cursor);
      this.cursor += buffer.length;

      DEBUG && console.log(`Wrote bytes: length=${buffer.length}, cursor=${this.cursor}, buffer=${buffer.toString('hex')}`);
    } catch (error) {
      console.error('Error writing bytes:', error);
      throw error;
    }
  }

  read() {
    const result = {};
    for (const { key, value, type } of this.reading) {
      result[key] = { value, type };
    }
    DEBUG && console.log(`Read result: `, result);
    return result;
  }

  get last() {
    const lastItem = this.reading.length ? this.reading[this.reading.length - 1] : null;
    DEBUG && console.log(`Last item: ${JSON.stringify(lastItem)}`);
    return lastItem;
  }

  $(searchKey) {
    const foundItem = this.reading.findLast(item => item.key === searchKey) || null;
    DEBUG && console.log(`Find item by key (${searchKey}): ${JSON.stringify(foundItem)}`);
    return foundItem;
  }
}

export { BinaryHandler }


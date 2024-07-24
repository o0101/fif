import { openSync, readSync, writeSync, closeSync, fstatSync, statSync, existsSync } from 'fs';
import { Buffer } from 'buffer';
import path from 'path';

const MAX_BUFFER_SIZE = 1024 * 1024 * 128; // 128 MB
const DEBUG = false;

class BinaryHandler {
  constructor(endian = 'BE') {
    this.endian = endian;
    this._buffer = Buffer.alloc(0);
    this.cursor = 0;
    this.bitCursor = 0;
    this.reading = [];
    this.fd = null;
  }

  // Function to write bits into a buffer with bitOffset
  writeBits(length, value, buffer, bitOffset = 0) {
    if (typeof length !== 'number' || length <= 0 || !Number.isInteger(length)) {
      throw new Error('Length must be a positive integer');
    }

    value = BigInt(value);
    DEBUG && console.log(`\nWriting bits for length: ${length}, value: ${value.toString(2)}, bitOffset: ${bitOffset}`);

    const byteAddr = i => Math.floor((i + bitOffset) / 8);
    const bitAddr = i => (i + bitOffset) % 8;

    for (let i = 0; i < length; i++) {
      const mask = 1n << BigInt(i);
      const iBit = (value & mask) >> BigInt(i);
      const byteIndex = byteAddr(i);
      const bitIndex = bitAddr(i);

      if (bitIndex === 0) {
        buffer[byteIndex] = 0; // Clear the byte before setting bits
      }
      
      buffer[byteIndex] |= Number(iBit) << bitIndex;
    }

    return { buffer, bitOffset: (bitOffset + length) % 8 };
  }

  // Function to read bits from a buffer with bitOffset
  readBits(length, buffer, bitOffset = 0) {
    if (typeof length !== 'number' || length <= 0 || !Number.isInteger(length)) {
      throw new Error('Length must be a positive integer');
    }

    let value = BigInt(0);
    DEBUG && console.log(`\nReading bits for length: ${length}, bitOffset: ${bitOffset}`);

    const byteAddr = i => Math.floor((i + bitOffset) / 8);
    const bitAddr = i => (i + bitOffset) % 8;

    for (let i = 0; i < length; i++) {
      const byteIndex = byteAddr(i);
      const bitIndex = bitAddr(i);

      const bit = (buffer[byteIndex] >> bitIndex) & 1;
      value |= BigInt(bit) << BigInt(i);
    }

    return { value, bitOffset: (bitOffset + length) % 8 };
  }

  bit(length, keyOrValue) {
    const byteLength = Math.ceil((this.bitCursor + length) / 8);
    if (typeof keyOrValue === 'string') {
      // Read mode
      if (byteLength > this._buffer.length) {
        this._buffer = Buffer.concat([this._buffer, this._readBytes(byteLength - this._buffer.length)]);
      }

      const { value, bitOffset } = this.readBits(length, this._buffer, this.bitCursor);
      this.reading.push({ key: keyOrValue, value, type: `bit_${length}` });
      this.bitCursor = bitOffset;
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
    return result;
  }

  get last() {
    return this.reading.length ? this.reading[this.reading.length - 1] : null;
  }

  $(searchKey) {
    return this.reading.findLast(item => item.key === searchKey) || null;
  }
}

export { BinaryHandler }


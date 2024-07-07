import { createReadStream, createWriteStream } from 'fs';
import { Buffer } from 'buffer';

class BinaryHandler {
  constructor(mode = 'read', endian = 'BE') {
    this.mode = mode;
    this.endian = endian;
    this.buffer = Buffer.alloc(0);
    this.cursor = 0;
    this.bitCursor = 0;
    this.reading = [];
    this.stream = null;
  }

  setMode(mode) {
    this.mode = mode;
    return this;
  }

  setEndian(endian) {
    this.endian = endian;
    return this;
  }

  async _readNextChunk() {
    return new Promise((resolve, reject) => {
      if (this.stream) {
        this.stream.once('data', chunk => {
          this.buffer = Buffer.concat([this.buffer, chunk]);
          resolve();
        });
        this.stream.once('error', reject);
      } else {
        reject(new Error('Stream not initialized.'));
      }
    });
  }

  async _ensureBytes(length) {
    while (this.buffer.length - this.cursor < length) {
      await this._readNextChunk();
    }
  }

  async bit(length, keyOrValue) {
    if (this.mode === 'write') {
      const value = keyOrValue;
      for (let i = 0; i < length; i++) {
        const bit = (value >> (length - 1 - i)) & 1;
        if (this.bitCursor === 0) {
          this.buffer = Buffer.concat([this.buffer, Buffer.alloc(1)]);
        }
        this.buffer[this.cursor] |= bit << (7 - this.bitCursor);
        this.bitCursor = (this.bitCursor + 1) % 8;
        if (this.bitCursor === 0) {
          this.cursor++;
        }
      }
      return this;
    } else {
      await this._ensureBytes(Math.ceil(length / 8));
      let value = 0;
      for (let i = 0; i < length; i++) {
        const bit = (this.buffer[this.cursor] >> (7 - this.bitCursor)) & 1;
        value = (value << 1) | bit;
        this.bitCursor = (this.bitCursor + 1) % 8;
        if (this.bitCursor === 0) {
          this.cursor++;
        }
      }
      this.reading.push({ key: keyOrValue, value });
      return this;
    }
  }

  async int8(keyOrValue) {
    if (this.mode === 'write') {
      const value = keyOrValue;
      const buffer = Buffer.alloc(1);
      buffer.writeInt8(value, 0);
      this.buffer = Buffer.concat([this.buffer, buffer]);
      return this;
    } else {
      await this._ensureBytes(1);
      const value = this.buffer.readInt8(this.cursor);
      this.reading.push({ key: keyOrValue, value });
      this.cursor += 1;
      return this;
    }
  }

  async uint8(keyOrValue) {
    if (this.mode === 'write') {
      const value = keyOrValue;
      const buffer = Buffer.alloc(1);
      buffer.writeUInt8(value, 0);
      this.buffer = Buffer.concat([this.buffer, buffer]);
      return this;
    } else {
      await this._ensureBytes(1);
      const value = this.buffer.readUInt8(this.cursor);
      this.reading.push({ key: keyOrValue, value });
      this.cursor += 1;
      return this;
    }
  }

  async int16(keyOrValue) {
    if (this.mode === 'write') {
      const value = keyOrValue;
      const buffer = Buffer.alloc(2);
      if (this.endian === 'BE') {
        buffer.writeInt16BE(value, 0);
      } else {
        buffer.writeInt16LE(value, 0);
      }
      this.buffer = Buffer.concat([this.buffer, buffer]);
      return this;
    } else {
      await this._ensureBytes(2);
      const value = this.endian === 'BE' ? this.buffer.readInt16BE(this.cursor) : this.buffer.readInt16LE(this.cursor);
      this.reading.push({ key: keyOrValue, value });
      this.cursor += 2;
      return this;
    }
  }

  async uint16(keyOrValue) {
    if (this.mode === 'write') {
      const value = keyOrValue;
      const buffer = Buffer.alloc(2);
      if (this.endian === 'BE') {
        buffer.writeUInt16BE(value, 0);
      } else {
        buffer.writeUInt16LE(value, 0);
      }
      this.buffer = Buffer.concat([this.buffer, buffer]);
      return this;
    } else {
      await this._ensureBytes(2);
      const value = this.endian === 'BE' ? this.buffer.readUInt16BE(this.cursor) : this.buffer.readUInt16LE(this.cursor);
      this.reading.push({ key: keyOrValue, value });
      this.cursor += 2;
      return this;
    }
  }

  async int32(keyOrValue) {
    if (this.mode === 'write') {
      const value = keyOrValue;
      const buffer = Buffer.alloc(4);
      if (this.endian === 'BE') {
        buffer.writeInt32BE(value, 0);
      } else {
        buffer.writeInt32LE(value, 0);
      }
      this.buffer = Buffer.concat([this.buffer, buffer]);
      return this;
    } else {
      await this._ensureBytes(4);
      const value = this.endian === 'BE' ? this.buffer.readInt32BE(this.cursor) : this.buffer.readInt32LE(this.cursor);
      this.reading.push({ key: keyOrValue, value });
      this.cursor += 4;
      return this;
    }
  }

  async uint32(keyOrValue) {
    if (this.mode === 'write') {
      const value = keyOrValue;
      const buffer = Buffer.alloc(4);
      if (this.endian === 'BE') {
        buffer.writeUInt32BE(value, 0);
      } else {
        buffer.writeUInt32LE(value, 0);
      }
      this.buffer = Buffer.concat([this.buffer, buffer]);
      return this;
    } else {
      await this._ensureBytes(4);
      const value = this.endian === 'BE' ? this.buffer.readUInt32BE(this.cursor) : this.buffer.readUInt32LE(this.cursor);
      this.reading.push({ key: keyOrValue, value });
      this.cursor += 4;
      return this;
    }
  }

  async jump(cursorPosition) {
    this.cursor = cursorPosition;
    this.bitCursor = 0; // Reset bit cursor when jumping
    return this;
  }

  async str(keyOrValue, len = null, encoding = 'utf8', delimiter = null) {
    if (this.mode === 'write') {
      const value = keyOrValue;
      let buffer;

      if (len === null) {
        // Non-fixed length string with metadata
        buffer = Buffer.from(value, encoding);
        const metaLength = Buffer.alloc(4);
        metaLength.writeUInt32BE(buffer.length, 0);
        const metaEncoding = Buffer.from(encoding.padEnd(5, '\0'), 'utf8'); // Fixed length for encoding
        const metaDelimiter = delimiter ? Buffer.from(delimiter.padEnd(5, '\0'), 'utf8') : Buffer.alloc(5, '\0'); // Fixed length for delimiter
        this.buffer = Buffer.concat([this.buffer, metaLength, metaEncoding, metaDelimiter, buffer]);
      } else {
        // Fixed length string
        buffer = Buffer.alloc(len);
        buffer.write(value, 0, len, encoding);
        this.buffer = Buffer.concat([this.buffer, buffer]);
      }
      return this;
    } else {
      // Reading logic
      const key = keyOrValue;
      if (len !== null) {
        await this._ensureBytes(len);
        const value = this.buffer.toString(encoding, this.cursor, this.cursor + len);
        this.cursor += len;
        this.reading.push({ key, value });
      } else {
        // Read metadata
        await this._ensureBytes(4); // Read length
        const strLength = this.buffer.readUInt32BE(this.cursor);
        this.cursor += 4;

        await this._ensureBytes(5); // Read encoding
        const strEncoding = this.buffer.toString('utf8', this.cursor, this.cursor + 5).replace(/\0/g, '');
        this.cursor += 5;

        await this._ensureBytes(5); // Read delimiter
        const strDelimiter = this.buffer.toString('utf8', this.cursor, this.cursor + 5).replace(/\0/g, '');
        this.cursor += 5;

        await this._ensureBytes(strLength);
        const value = this.buffer.toString(strEncoding, this.cursor, this.cursor + strLength);
        this.cursor += strLength;
        this.reading.push({ key, value });
      }
      return this;
    }
  }

  async array(keyOrValue, length, type, delimiter = null) {
    if (this.mode === 'write') {
      const values = keyOrValue;
      for (let i = 0; i < values.length; i++) {
        await this[type](values[i]);
        if (delimiter && i < values.length - 1) {
          this.buffer = Buffer.concat([this.buffer, Buffer.from(delimiter)]);
        }
      }
      return this;
    } else {
      const key = keyOrValue;
      const values = [];
      for (let i = 0; i < length; i++) {
        const value = await this[type]();
        values.push(value);
        if (delimiter) {
          await this._ensureBytes(delimiter.length);
          this.cursor += delimiter.length;
        }
      }
      this.reading.push({ key, values });
      return this;
    }
  }

  async readFromFile(filePath) {
    return new Promise((resolve, reject) => {
      this.stream = createReadStream(filePath);
      this.stream.on('readable', async () => {
        try {
          await this._readNextChunk();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
      this.stream.on('error', reject);
    });
  }

  async writeToFile(filePath) {
    return new Promise((resolve, reject) => {
      this.stream = createWriteStream(filePath);
      this.stream.on('writable', () => {
        this.stream.on('finish', resolve);
        this.stream.write(this.buffer, (err) => {
          if (err) reject(err);
          else this.stream.end();
        });
      });
      this.stream.on('error', reject);
    });
  }

  async read() {
    const result = {};
    for (const { key, value } of this.reading) {
      result[key] = value;
    }
    return result;
  }

  async write() {
    if (this.stream) {
      this.stream.write(this.buffer);
    }
    return this;
  }
}

const BinaryTypes = {
  types: {},

  define(name, fields) {
    this.types[name] = fields;
  },

  async read(handler, name) {
    const type = this.types[name];
    const result = {};
    for (const field of type) {
      await handler[field.type](field.name);
      const value = handler.reading.find(f => f.key === field.name).value;
      result[field.name] = value;
    }
    return result;
  },

  async write(handler, name, data) {
    const type = this.types[name];
    for (const field of type) {
      await handler[field.type](data[field.name]);
    }
  }
};

const BinaryUtils = {
  padBits(bits, length) {
    while (bits.length < length) {
      bits.push(0);
    }
    return bits;
  },

  chopBits(bits, length) {
    return bits.slice(0, length);
  }
};

const BinaryTests = {
  run() {
    // Run all tests
  },

  fuzz() {
    // Run fuzzing tests
  }
};

export { BinaryHandler, BinaryTypes, BinaryUtils, BinaryTests };


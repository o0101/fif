import { Writable, Readable } from 'stream';
import { Buffer } from 'buffer';

class BinaryHandler {
  constructor(mode = 'read', endian = 'BE') {
    this.mode = mode;
    this.endian = endian;
    this.buffer = Buffer.alloc(0);
    this.cursor = 0;
    this.bitCursor = 0;
    this.reading = [];
  }

  setMode(mode) {
    this.mode = mode;
    return this;
  }

  setEndian(endian) {
    this.endian = endian;
    return this;
  }

  async _readNextChunk(stream) {
    return new Promise((resolve, reject) => {
      stream.once('data', chunk => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        resolve();
      });
      stream.once('error', reject);
    });
  }

  async _ensureBytes(length, stream) {
    while (this.buffer.length - this.cursor < length) {
      await this._readNextChunk(stream);
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
      await this._ensureBytes(Math.ceil(length / 8), this.stream);
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
    await this._ensureBytes(1, this.stream);
    const value = this.buffer.readInt8(this.cursor);
    if (this.mode === 'read') {
      this.reading.push({ key: keyOrValue, value });
    }
    this.cursor += 1;
    return this;
  }

  async uint8(keyOrValue) {
    await this._ensureBytes(1, this.stream);
    const value = this.buffer.readUInt8(this.cursor);
    if (this.mode === 'read') {
      this.reading.push({ key: keyOrValue, value });
    }
    this.cursor += 1;
    return this;
  }

  async int16(keyOrValue) {
    await this._ensureBytes(2, this.stream);
    const value = this.endian === 'BE' ? this.buffer.readInt16BE(this.cursor) : this.buffer.readInt16LE(this.cursor);
    if (this.mode === 'read') {
      this.reading.push({ key: keyOrValue, value });
    }
    this.cursor += 2;
    return this;
  }

  async uint16(keyOrValue) {
    await this._ensureBytes(2, this.stream);
    const value = this.endian === 'BE' ? this.buffer.readUInt16BE(this.cursor) : this.buffer.readUInt16LE(this.cursor);
    if (this.mode === 'read') {
      this.reading.push({ key: keyOrValue, value });
    }
    this.cursor += 2;
    return this;
  }

  async int32(keyOrValue) {
    await this._ensureBytes(4, this.stream);
    const value = this.endian === 'BE' ? this.buffer.readInt32BE(this.cursor) : this.buffer.readInt32LE(this.cursor);
    if (this.mode === 'read') {
      this.reading.push({ key: keyOrValue, value });
    }
    this.cursor += 4;
    return this;
  }

  async uint32(keyOrValue) {
    await this._ensureBytes(4, this.stream);
    const value = this.endian === 'BE' ? this.buffer.readUInt32BE(this.cursor) : this.buffer.readUInt32LE(this.cursor);
    if (this.mode === 'read') {
      this.reading.push({ key: keyOrValue, value });
    }
    this.cursor += 4;
    return this;
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
        await this._ensureBytes(len, this.stream);
        const value = this.buffer.toString(encoding, this.cursor, this.cursor + len);
        this.cursor += len;
        this.reading.push({ key, value });
      } else {
        // Read metadata
        await this._ensureBytes(4, this.stream); // Read length
        const strLength = this.buffer.readUInt32BE(this.cursor);
        this.cursor += 4;

        await this._ensureBytes(5, this.stream); // Read encoding
        const strEncoding = this.buffer.toString('utf8', this.cursor, this.cursor + 5).replace(/\0/g, '');
        this.cursor += 5;

        await this._ensureBytes(5, this.stream); // Read delimiter
        const strDelimiter = this.buffer.toString('utf8', this.cursor, this.cursor + 5).replace(/\0/g, '');
        this.cursor += 5;

        await this._ensureBytes(strLength, this.stream);
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
          await this._ensureBytes(delimiter.length, this.stream);
          this.cursor += delimiter.length;
        }
      }
      this.reading.push({ key, values });
      return this;
    }
  }

  async readFromFile(filePath) {
    const readStream = Readable.from(filePath);
    this.stream = readStream;
    await this._readNextChunk(readStream);
    return this;
  }

  async writeToFile(filePath) {
    const writeStream = Writable.from(filePath);
    this.stream = writeStream;
    await this.write();
    writeStream.end();
    return this;
  }

  async read() {
    const result = {};
    for (const { key, value } of this.reading) {
      result[key] = value;
    }
    return result;
  }

  async write() {
    this.stream.write(this.buffer);
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


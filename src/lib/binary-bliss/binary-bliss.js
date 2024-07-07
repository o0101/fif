import { openSync, readSync, writeSync, closeSync, fstatSync } from 'fs';
import { Buffer } from 'buffer';

class BinaryHandler {
  constructor(endian = 'BE') {
    this.endian = endian;
    this.buffer = Buffer.alloc(0);
    this.cursor = 0;
    this.bitCursor = 0;
    this.reading = [];
    this.fd = null;
  }

  setEndian(endian) {
    this.endian = endian;
    return this;
  }

  openFile(filePath) {
    this.fd = openSync(filePath, 'w+');
    return this;
  }

  closeFile() {
    if (this.fd !== null) {
      closeSync(this.fd);
      this.fd = null;
    }
    return this;
  }

  _seek(offset) {
    this.cursor = offset;
  }

  _readBytes(length) {
    const buffer = Buffer.alloc(length);
    readSync(this.fd, buffer, 0, length, this.cursor);
    this.cursor += length;
    return buffer;
  }

  _writeBytes(buffer) {
    writeSync(this.fd, buffer, 0, buffer.length, this.cursor);
    this.cursor += buffer.length;
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

  bit(length, keyOrValue) {
    if (typeof keyOrValue === 'string') {
      this._ensureBytes(Math.ceil(length / 8));
      let value = 0;
      for (let i = 0; i < length; i++) {
        const bit = (this.buffer[this.cursor] >> (7 - this.bitCursor)) & 1;
        value = (value << 1) | bit;
        this.bitCursor = (this.bitCursor + 1) % 8;
        if (this.bitCursor === 0) {
          this.cursor++;
        }
      }
      this.reading.push({ key: keyOrValue, value, type: `bit_${length}` });
      return this;
    } else {
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
      this._writeBytes(this.buffer.slice(-Math.ceil(length / 8)));
      return this;
    }
  }

  int8(keyOrValue) {
    if (typeof keyOrValue === 'string') {
      this._ensureBytes(1);
      const buffer = this._readBytes(1);
      const value = buffer.readInt8(0);
      this.reading.push({ key: keyOrValue, value, type: 'int8' });
      return this;
    } else {
      const value = keyOrValue;
      const buffer = Buffer.alloc(1);
      buffer.writeInt8(value, 0);
      this._writeBytes(buffer);
      return this;
    }
  }

  uint8(keyOrValue) {
    if (typeof keyOrValue === 'string') {
      this._ensureBytes(1);
      const buffer = this._readBytes(1);
      const value = buffer.readUInt8(0);
      this.reading.push({ key: keyOrValue, value, type: 'uint8' });
      return this;
    } else {
      const value = keyOrValue;
      const buffer = Buffer.alloc(1);
      buffer.writeUInt8(value, 0);
      this._writeBytes(buffer);
      return this;
    }
  }

  int16(keyOrValue) {
    if (typeof keyOrValue === 'string') {
      this._ensureBytes(2);
      const buffer = this._readBytes(2);
      const value = this.endian === 'BE' ? buffer.readInt16BE(0) : buffer.readInt16LE(0);
      this.reading.push({ key: keyOrValue, value, type: 'int16' });
      return this;
    } else {
      const value = keyOrValue;
      const buffer = Buffer.alloc(2);
      if (this.endian === 'BE') {
        buffer.writeInt16BE(value, 0);
      } else {
        buffer.writeInt16LE(value, 0);
      }
      this._writeBytes(buffer);
      return this;
    }
  }

  uint16(keyOrValue) {
    if (typeof keyOrValue === 'string') {
      this._ensureBytes(2);
      const buffer = this._readBytes(2);
      const value = this.endian === 'BE' ? buffer.readUInt16BE(0) : buffer.readUInt16LE(0);
      this.reading.push({ key: keyOrValue, value, type: 'uint16' });
      return this;
    } else {
      const value = keyOrValue;
      const buffer = Buffer.alloc(2);
      if (this.endian === 'BE') {
        buffer.writeUInt16BE(value, 0);
      } else {
        buffer.writeUInt16LE(value, 0);
      }
      this._writeBytes(buffer);
      return this;
    }
  }

  int32(keyOrValue) {
    if (typeof keyOrValue === 'string') {
      this._ensureBytes(4);
      const buffer = this._readBytes(4);
      const value = this.endian === 'BE' ? buffer.readInt32BE(0) : buffer.readInt32LE(0);
      this.reading.push({ key: keyOrValue, value, type: 'int32' });
      return this;
    } else {
      const value = keyOrValue;
      const buffer = Buffer.alloc(4);
      if (this.endian === 'BE') {
        buffer.writeInt32BE(value, 0);
      } else {
        buffer.writeInt32LE(value, 0);
      }
      this._writeBytes(buffer);
      return this;
    }
  }

  uint32(keyOrValue) {
    if (typeof keyOrValue === 'string') {
      this._ensureBytes(4);
      const buffer = this._readBytes(4);
      const value = this.endian === 'BE' ? buffer.readUInt32BE(0) : buffer.readUInt32LE(0);
      this.reading.push({ key: keyOrValue, value, type: 'uint32' });
      return this;
    } else {
      const value = keyOrValue;
      const buffer = Buffer.alloc(4);
      if (this.endian === 'BE') {
        buffer.writeUInt32BE(value, 0);
      } else {
        buffer.writeUInt32LE(value, 0);
      }
      this._writeBytes(buffer);
      return this;
    }
  }

  float(keyOrValue) {
    if (typeof keyOrValue === 'string') {
      this._ensureBytes(4);
      const buffer = this._readBytes(4);
      const value = this.endian === 'BE' ? buffer.readFloatBE(0) : buffer.readFloatLE(0);
      this.reading.push({ key: keyOrValue, value, type: 'float' });
      return this;
    } else {
      const value = keyOrValue;
      const buffer = Buffer.alloc(4);
      if (this.endian === 'BE') {
        buffer.writeFloatBE(value, 0);
      } else {
        buffer.writeFloatLE(value, 0);
      }
      this._writeBytes(buffer);
      return this;
    }
  }

  double(keyOrValue) {
    if (typeof keyOrValue === 'string') {
      this._ensureBytes(8);
      const buffer = this._readBytes(8);
      const value = this.endian === 'BE' ? buffer.readDoubleBE(0) : buffer.readDoubleLE(0);
      this.reading.push({ key: keyOrValue, value, type: 'double' });
      return this;
    } else {
      const value = keyOrValue;
      const buffer = Buffer.alloc(8);
      if (this.endian === 'BE') {
        buffer.writeDoubleBE(value, 0);
      } else {
        buffer.writeDoubleLE(value, 0);
      }
      this._writeBytes(buffer);
      return this;
    }
  }

  date(keyOrValue) {
    if (typeof keyOrValue === 'string') {
      this._ensureBytes(8);
      const buffer = this._readBytes(8);
      const value = new Date(buffer.readBigUInt64BE(0));
      this.reading.push({ key: keyOrValue, value, type: 'date' });
      return this;
    } else {
      const value = keyOrValue;
      const buffer = Buffer.alloc(8);
      buffer.writeBigUInt64BE(BigInt(value.getTime()), 0);
      this._writeBytes(buffer);
      return this;
    }
  }

  jump(cursorPosition) {
    this.cursor = cursorPosition;
    this.bitCursor = 0; // Reset bit cursor when jumping
    return this;
  }

  puts(value, len = null, encoding = 'utf8', delimiter = null) {
    let buffer;

    if (len === null) {
      // Non-fixed length string with metadata
      buffer = Buffer.from(value, encoding);
      const metaLength = Buffer.alloc(4);
      metaLength.writeUInt32BE(buffer.length, 0);
      const metaEncoding = Buffer.from(encoding.padEnd(5, '\0'), 'utf8'); // Fixed length for encoding
      const metaDelimiter = delimiter ? Buffer.from(delimiter.padEnd(5, '\0'), 'utf8') : Buffer.alloc(5, '\0'); // Fixed length for delimiter
      this._writeBytes(Buffer.concat([metaLength, metaEncoding, metaDelimiter, buffer]));
    } else {
      // Fixed length string
      buffer = Buffer.alloc(len);
      buffer.write(value, 0, len, encoding);
      this._writeBytes(buffer);
    }
    return this;
  }

  gets(keyOrValue, len = null, encoding = 'utf8', delimiter = null) {
    const key = keyOrValue;
    if (len !== null) {
      this._ensureBytes(len);
      const value = this._readBytes(len).toString(encoding);
      this.reading.push({ key, value, type: 'string' });
    } else {
      // Read metadata
      this._ensureBytes(4); // Read length
      const strLength = this._readBytes(4).readUInt32BE(0);
      this._ensureBytes(5); // Read encoding
      const strEncoding = this._readBytes(5).toString('utf8').replace(/\0/g, '');
      this._ensureBytes(5); // Read delimiter
      const strDelimiter = this._readBytes(5).toString('utf8').replace(/\0/g, '');
      this._ensureBytes(strLength);
      const value = this._readBytes(strLength).toString(strEncoding);
      this.reading.push({ key, value, type: 'string' });
    }
    return this;
  }

  array(keyOrValue, length, type, delimiter = null) {
    if (Array.isArray(keyOrValue)) {
      if ( type == 'string' ) type = 'puts';
      const values = keyOrValue;
      for (let i = 0; i < values.length; i++) {
        console.log(type, values[i]);
        this[type](values[i]);
        if (delimiter && i < values.length - 1) {
          this._writeBytes(Buffer.from(delimiter));
        }
      }
      return this;
    } else {
      if ( type == 'string' ) type = 'gets';
      const key = keyOrValue;
      const values = [];
      for (let i = 0; i < length; i++) {
        this[type](`value_${i}`);
        values.push(this.$(`value_${i}`).value);
      }
      this.reading.push({ key, values, type: 'array' });
      return this;
    }
  }

  map(keyOrValue) {
    if (keyOrValue instanceof Map) {
      const map = keyOrValue;
      this.uint32(map.size);
      for (const [key, value] of map.entries()) {
        this.puts(key);
        this.puts(value);
      }
      return this;
    } else {
      const key = keyOrValue;
      const map = new Map();
      this.uint32('length');
      const length = this.$('length').value;
      for (let i = 0; i < length; i++) {
        this.gets(`key${i}`);
        this.gets(`value${i}`);
        const key = this.$(`key${i}`).value;
        const value = this.$(`value${i}`).value;
        map.set(key, value);
      }
      this.reading.push({ key, value: map, type: 'map' });
      return this;
    }
  }

  read() {
    const result = {};
    for (const { key, value, type } of this.reading) {
      result[key] = { value, type };
    }
    return result;
  }

  get value() {
    return this.reading.length ? this.reading[this.reading.length - 1] : null;
  }

  $(searchKey) {
    return this.reading.find(item => item.key === searchKey) || null;
  }
}

const BinaryTypes = {
  types: {},

  define(name, fields) {
    this.types[name] = fields;
  },

  read(handler, name) {
    const type = this.types[name];
    const result = {};
    for (const field of type) {
      handler[field.type](field.name);
      const { value, type: valueType } = handler.reading.find(f => f.key === field.name);
      result[field.name] = { value, type: valueType };
    }
    return result;
  },

  write(handler, name, data) {
    const type = this.types[name];
    for (const field of type) {
      handler[field.type](data[field.name]);
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

export { BinaryHandler, BinaryTypes, BinaryUtils };


import { openSync, readSync, writeSync, closeSync, fstatSync, statSync, existsSync } from 'fs';
import { Buffer } from 'buffer';
import path from 'path';

const ATextEncoder = new TextEncoder;
const ATextDecoder = new TextDecoder;
const ETEXT = true;

const MAX_BUFFER_SIZE = 1024 * 1024 * 128; // 128 MB

class BinaryHandler {
  constructor(endian = 'BE') {
    this.endian = endian;
    this._buffer = Buffer.alloc(0);
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
    const safePath = path.resolve(filePath);
    if (!existsSync(safePath)) {
      this.fd = openSync(safePath, 'w+');
    } else {
      const stats = statSync(safePath);
      const isWritable = (stats.mode & 0o200) !== 0;
      this.fd = openSync(safePath, isWritable ? 'r+' : 'r');
    }
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

  _validateLength(length) {
    if (typeof length !== 'number' || length <= 0 || length > MAX_BUFFER_SIZE) {
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

  _ensureWriteSpace(buffer) {
    const stats = fstatSync(this.fd);
    if (this.cursor + buffer.length > stats.size) {
      throw new Error('Insufficient space in file for writing');
    }
  }

  _readBytes(length, opts = {}) {
    try {
      this._validateLength(length);
      this._ensureBytes(length);
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
    try {
      this._validateBuffer(buffer);
      this._ensureWriteSpace(buffer);
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

  bit(length, keyOrValue) {
    this._validateLength(length);
    if (typeof keyOrValue === 'string') {
      this._ensureBytes(Math.ceil(length / 8));
      let value = 0;
      for (let i = 0; i < length; i++) {
        const bit = (this._buffer[this.cursor] >> (7 - this.bitCursor)) & 1;
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
          this._buffer = Buffer.concat([this._buffer, Buffer.alloc(1)]);
        }
        this._buffer[this.cursor] |= bit << (7 - this.bitCursor);
        this.bitCursor = (this.bitCursor + 1) % 8;
        if (this.bitCursor === 0) {
          this.cursor++;
        }
      }
      this._writeBytes(this._buffer.slice(-Math.ceil(length / 8)));
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
      const value = new Date(Number(buffer.readBigUInt64BE(0)));
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

    const encodedValue = ATextEncoder.encode(value);
    if (len === null) {
      // Non-fixed length string with metadata
      buffer = Buffer.from(encodedValue, encoding);
      const metaLength = Buffer.alloc(4);
      metaLength.writeUInt32BE(buffer.length, 0);
      const metaEncoding = Buffer.from(encoding.padEnd(5, '\0'), 'utf8'); // Fixed length for encoding
      const metaDelimiter = delimiter ? Buffer.from(delimiter.padEnd(5, '\0'), 'utf8') : Buffer.alloc(5, '\0'); // Fixed length for delimiter
      if (ETEXT) {
        BinaryUtils.encode(metaEncoding);
        BinaryUtils.encode(buffer);
      }
      this._writeBytes(Buffer.concat([metaLength, metaEncoding, metaDelimiter, buffer]));
    } else {
      // Fixed length string
      this._validateLength(len); // Validate the length
      buffer = Buffer.alloc(len);
      buffer.write(value, 0, len, encoding);
      console.log('encode', buffer);
      this._writeBytes(buffer, { encode: true });
    }
    return this;
  }

  gets(keyOrValue, len = null, encoding = 'utf8', delimiter = null) {
    const key = keyOrValue;
    if (len !== null) {
      this._validateLength(len); // Validate the length
      this._ensureBytes(len);
      let value = this._readBytes(len, { decode: true }).toString(encoding);
      value = ATextDecoder.decode(value.buffer.slice(0, value.length));
      this.reading.push({ key, value, type: 'string' });
    } else {
      // Read metadata
      this._ensureBytes(4); // Read length
      const strLength = this._readBytes(4).readUInt32BE(0);
      this._validateLength(strLength); // Validate the length
      this._ensureBytes(5); // Read encoding
      const strEncoding = ETEXT ? BinaryUtils.decode(this._readBytes(5)).toString('utf8').replace(/\0/g, '') : this._readBytes(5).toString('utf8').replace(/\0/g, '');
      this._ensureBytes(5); // Read delimiter
      const strDelimiter = this._readBytes(5).toString('utf8').replace(/\0/g, '');
      this._ensureBytes(strLength);
      let value = this._readBytes(strLength, { decode: true });
      value = ATextDecoder.decode(value.buffer.slice(0, value.length));
      this.reading.push({ key, value, type: 'string' });
    }
    return this;
  }

  array(keyOrValue, length, type, delimiter = null) {
    this._validateLength(length); // Validate the length
    if (Array.isArray(keyOrValue)) {
      const values = keyOrValue;
      for (let i = 0; i < values.length; i++) {
        this[type](values[i]);
        if (delimiter && i < values.length - 1) {
          this._writeBytes(Buffer.from(delimiter));
        }
      }
      return this;
    } else {
      const key = keyOrValue;
      const values = [];
      for (let i = 0; i < length; i++) {
        this[type](`value_${i}`);
        values.push(this.$(`value_${i}`).value);
      }
      this.reading.push({ key, value: values, type: 'array' });
      return this;
    }
  }

  heteroArray(keyOrValue, delimiter = null) {
    if (Array.isArray(keyOrValue)) {
      const values = keyOrValue;
      this.uint32(values.length);
      for (let i = 0; i < values.length; i++) {
        this._writeTypeAndValue(values[i]);
        if (delimiter && i < values.length - 1) {
          this._writeBytes(Buffer.from(delimiter));
        }
      }
      return this;
    } else {
      const key = keyOrValue;
      const values = [];
      this.uint32('length');
      const length = this.$('length').value;
      for (let i = 0; i < length; i++) {
        const value = this._readTypeAndValue();
        values.push(value);
      }
      this.reading.push({ key, value: values, type: 'heteroArray' });
      return this;
    }
  }

  map(keyOrValue) {
    if (keyOrValue instanceof Map) {
      const map = keyOrValue;
      this.uint32(map.size);
      for (const [key, value] of map.entries()) {
        this.puts(key);
        this._writeTypeAndValue(value);
      }
      return this;
    } else {
      const key = keyOrValue;
      const map = new Map();
      this.uint32('length');
      const length = this.$('length').value;
      for (let i = 0; i < length; i++) {
        this.gets(`key${i}`);
        const key = this.$(`key${i}`).value;
        const value = this._readTypeAndValue();
        map.set(key, value);
      }
      this.reading.push({ key, value: map, type: 'map' });
      return this;
    }
  }

  _writeTypeAndValue(value) {
    if (typeof value === 'string') {
      this.uint8(1);
      this.puts(value);
    } else if (typeof value === 'number') {
      this.uint8(2);
      this.float(value);
    } else if (value instanceof Date) {
      this.uint8(3);
      this.date(value);
    } else if (Array.isArray(value)) {
      this.uint8(4);
      this.heteroArray(value);
    } else if (value instanceof Map) {
      this.uint8(6);
      this.map(value);
    } else if (value instanceof Set) {
      this.uint8(7);
      this.set(value);
    } else if (typeof value === 'object' && value !== null) {
      this.uint8(5);
      this.pojo(value);
    }
    // Handle other types similarly
  }

  _readTypeAndValue(uniq = 'value') {
    const type = this.uint8('type').value.value;
    let value;
    switch (type) {
      case 1:
        value = this.gets(uniq).value.value;
        break;
      case 2:
        value = this.float(uniq).value.value;
        break;
      case 3:
        value = this.date(uniq).value.value;
        break;
      case 4:
        value = this.heteroArray(uniq).value.value;
        break;
      case 5:
        this.pojo(uniq);
        value = this.$(uniq).value;
        break;
      case 6:
        this.map(uniq);
        value = this.$(uniq).value;
        break;
      case 7:
        this.set(uniq);
        value = this.$(uniq).value;
        break;
      // Handle other types similarly
    }
    return value;
  }

  set(keyOrValue) {
    if (keyOrValue instanceof Set) {
      const set = keyOrValue;
      this.uint32(set.size);
      for (const value of set) {
        this._writeTypeAndValue(value);
      }
      return this;
    } else {
      const key = keyOrValue;
      const set = new Set();
      this.uint32('length');
      const length = this.$('length').value;
      for (let i = 0; i < length; i++) {
        const value = this._readTypeAndValue();
        set.add(value);
      }
      this.reading.push({ key, value: set, type: 'set' });
      return this;
    }
  }

  pojo(keyOrValue) {
    if (typeof keyOrValue === 'object' && keyOrValue !== null) {
      const obj = keyOrValue;
      const keys = Object.keys(obj);
      this.uint32(keys.length);
      for (const key of keys) {
        this.puts(key);
        this._writeTypeAndValue(obj[key]);
      }
      return this;
    } else {
      const key = keyOrValue;
      const obj = {};
      this.uint32('length');
      const length = this.$('length').value;
      for (let i = 0; i < length; i++) {
        this.gets(`key${i}`);
        const propKey = this.$(`key${i}`).value;
        const value = this._readTypeAndValue();
        obj[propKey] = value;
      }
      this.reading.push({ key, value: obj, type: 'pojo' });
      return this;
    }
  }

  buffer(keyOrBuffer, length = null) {
    if (typeof keyOrBuffer === 'string') {
      const key = keyOrBuffer;
      this._validateLength(length);
      this._ensureBytes(length);
      const buffer = this._readBytes(length);
      this.reading.push({ key, value: buffer, type: 'buffer' });
      return this;
    } else if (Buffer.isBuffer(keyOrBuffer)) {
      const buffer = keyOrBuffer;
      this._validateBuffer(buffer);
      this._writeBytes(buffer);
      return this;
    } else {
      throw new Error('Invalid argument for buffer method');
    }
  }

  writeMagic(data) {
    this.jump(0);
    if (typeof data === 'number') {
      let bytes;
      if (data < 0x100) {
        bytes = Buffer.alloc(1);
        bytes.writeUInt8(data, 0);
      } else if (data < 0x10000) {
        bytes = Buffer.alloc(2);
        bytes.writeUInt16BE(data, 0);
      } else if (data < 0x1000000) {
        bytes = Buffer.alloc(3);
        bytes.writeUIntBE(data, 0, 3);
      } else {
        bytes = Buffer.alloc(4);
        bytes.writeUInt32BE(data, 0);
      }
      this._writeBytes(bytes);
    } else if (typeof data === 'string') {
      const buffer = Buffer.from(data, 'utf8');
      this._writeBytes(buffer);
    } else if (Buffer.isBuffer(data)) {
      this.buffer(data);
    }
    return this;
  }

  readMagic(data) {
    this.jump(0);
    if (typeof data === 'number') {
      let length;
      if (data < 0x100) {
        length = 1;
      } else if (data < 0x10000) {
        length = 2;
      } else if (data < 0x1000000) {
        length = 3;
      } else {
        length = 4;
      }
      const buffer = this._readBytes(length);
      let value;
      if (length === 1) {
        value = buffer.readUInt8(0);
      } else if (length === 2) {
        value = buffer.readUInt16BE(0);
      } else if (length === 3) {
        value = buffer.readUIntBE(0, 3);
      } else {
        value = buffer.readUInt32BE(0);
      }
      this.reading.push({ key: 'magic', value, type: 'number' });
    } else if (typeof data === 'string') {
      const length = data.length;
      const buffer = this._readBytes(length);
      const value = buffer.toString('utf8');
      this.reading.push({ key: 'magic', value, type: 'string' });
    } else if (Buffer.isBuffer(data)) {
      this.buffer('magic', data.length);
    }
    return this;
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
    return this.reading.findLast(item => item.key === searchKey) || null;
  }

  readTranscript(format) {
    const result = [];
    this.jump(0);

    format.split('.').forEach(command => {
      const match = command.match(/(\w+)\(([^)]*)\)/);
      if (match) {
        const method = match[1];
        const args = match[2].split(',').map(arg => arg.trim().replace(/['"]/g, ''));
        if (typeof this[method] === 'function') {
          const beforeCursor = this.cursor;
          this[method](...args);
          const afterCursor = this.cursor;
          const buffer = this._readBytes(afterCursor - beforeCursor);
          const hexData = buffer.toString('hex').match(/.{1,2}/g).join(' ');
          result.push(`${hexData}\t${method}(${args.join(', ')}): ${JSON.stringify(this.value.value)}`);
        }
      }
    });

    console.log('READ TRANSCRIPT');
    console.log('===========================');
    result.forEach(line => console.log(line));
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
  ENCODE_SHIFT: 3,

  padBits(bits, length) {
    while (bits.length < length) {
      bits.push(0);
    }
    return bits;
  },

  chopBits(bits, length) {
    return bits.slice(0, length);
  },

  encode(buffer) {
    const EC = this.ENCODE_SHIFT;
    const ER = 8 - EC;
    if (buffer.length == 0) return;

    let leftCarry = buffer[0] >> ER;

    for (let i = 0; i < buffer.length; i++) {
      const currentByte = buffer[i];
      buffer[i] = (currentByte << EC) & 0xFF;
      if ((i + 1) === buffer.length) {
        buffer[i] |= leftCarry;
      } else {
        buffer[i] |= (buffer[i + 1] >> ER) & 0xFF;
      }
    }

    return buffer;
  },

  decode(buffer) {
    const EC = this.ENCODE_SHIFT;
    const ER = 8 - EC;
    if (buffer.length == 0) return;

    let rightCarry = buffer[buffer.length - 1] << ER;

    for (let i = buffer.length - 1; i >= 0; i--) {
      const currentByte = buffer[i];
      buffer[i] = (currentByte >> EC) & 0xFF;
      if (i === 0) {
        buffer[i] |= rightCarry & 0xFF;
      } else {
        buffer[i] |= (buffer[i - 1] << ER) & 0xFF;
      }
    }

    return buffer;
  }

  /*
  encode(buf) {
    if ( buf.length == 0 ) return buf;

    for( let i = 0; i < buf.length; i++ ) {
      buf[i] ^= 123;
    }

    return buf;
  },

  decode(buf) {
    if ( buf.length == 0 ) return buf;

    for( let i = 0; i < buf.length; i++ ) {
      buf[i] ^= 123;
    }

    return buf;
  }
  */
};

export { BinaryHandler, BinaryTypes, BinaryUtils };


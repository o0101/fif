import { 
  accessSync, constants, openSync, readSync, writeSync, 
  closeSync, fstatSync, statSync, existsSync, readFileSync, 
  appendFileSync 
} from 'fs';
import { Buffer } from 'buffer';
import path from 'path';
import zlib from 'zlib';
import { sign, verify } from '@noble/ed25519';

const ATextEncoder = new TextEncoder;
const ATextDecoder = new TextDecoder;
const ETEXT = true;

const MAX_BUFFER_SIZE = 1024 * 1024 * 128; // 128 MB
const DEBUG = false;
// 32-bit register for bit operations that will not result in signed integers
const R32 = new Uint32Array(1);

const BinaryType = {
  STRING: 1,
  FLOAT: 2,
  DATE: 3,
  HETERO_ARRAY: 4,
  POJO: 5,
  MAP: 6,
  SET: 7,
  BUFFER: 8,
  BOOL: 9,
  BIGINT: 10,
  INT8: 11,
  UINT8: 12,
  INT16: 13,
  UINT16: 14,
  INT32: 15,
  UINT32: 16,
  DOUBLE: 17,
};

const EncodingType = {
  'utf8': 1,
  'utf16le': 2,
  'latin1': 3,
  'base64': 4,
  'base64url': 5,
  'hex': 6,
  'ascii': 7,
  'binary': 8, // Alias for 'latin1'
  'ucs2': 9 // Alias of 'utf16le'
};

const EncodingMap = {};

Object.entries(EncodingType).forEach(([key, value]) => {
  EncodingMap[key] = value;
  EncodingMap[value] = key;
});

class BinaryHandler {
  // Init, config, file access, and checks
    constructor(endian = 'BE') {
      this.endian = endian;
      this._buffer = Buffer.alloc(0);
      this.cursor = 0;
      this.bitCursor = 0;
      this.reading = [];
      this.fd = null;
    }

    openFile(filePath, { append = false, mode = 0o666 } = {}) {
      const safePath = path.resolve(filePath);
      let flag;

      try {
        if (!existsSync(safePath)) {
          // Open for writing and reading if not exist
          flag = 'w+';
          this.fd = openSync(safePath, flag, mode);
        } else {
          const stats = statSync(safePath);

          if (!stats.isFile()) {
            throw new Error(`${safePath} is not a file`);
          }

          let isWritable;
          let isReadable;

          try {
            accessSync(safePath, constants.W_OK);
            isWritable = true;
          } catch (err) {
            isWritable = false;
          }

          try {
            accessSync(safePath, constants.R_OK);
            isReadable = true;
          } catch (err) {
            isReadable = false;
          }

          // Determine the appropriate flags based on readability and writability
          if (isWritable && isReadable) {
            flag = append ? 'a+' : 'r+';
          } else if (isWritable) {
            flag = append ? 'a' : 'w';
          } else {
            flag = 'r';
          }

          this.fd = openSync(safePath, flag, mode);
        }

        this.filePath = filePath;

        if ( append && flag.startsWith('a') ) {
          this.jumpEnd();
        }

        DEBUG && console.log(`File opened: ${safePath} (${flag}) - ${mode}, fd=${this.fd}`);
        return this;
      } catch (err) {
        if (err.code === 'EACCES') {
          console.error(`Permission denied: ${safePath}`);
        } else if (err.code === 'ENOENT') {
          console.error(`File not found: ${safePath}`);
        } else if (err.code === 'EISDIR') {
          console.error(`Is a directory: ${safePath}`);
        } else {
          console.error(`Error opening file: ${safePath}`, err);
        }
        throw err;
      }
    }

    closeFile() {
      if (this._buffer.length) {
        this._writeBytes(this._buffer);
        this._buffer = Buffer.alloc(0);
      }
      if (this.fd !== null) {
        try {
          closeSync(this.fd);
          this.fd = null;
          this.cursor = 0;
          this.bitCursor = 0;
          DEBUG && console.log(`File closed: ${this.filePath}`);
        } catch (err) {
          console.error(`Error closing file: ${this.filePath}`, err);
        }
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
        throw new Error('Insufficient data in file: ' + this.filePath);
      }
    }

  // File typing and signifying 
    writeMagic(data) {
      this._alignToNextWrite();
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
      this._alignToNextRead();
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

  // Variable length coding
    writeLength(length) {
      if (length > 0x3FFFFFFF) { // 2^30 - 1
        throw new Error('Length exceeds the maximum allowed value. Consider breaking your data into smaller chunks.');
      }

      let buffer;
      if (length <= 0x3F) { // 00 - 1 byte
        buffer = Buffer.alloc(1);
        buffer.writeUInt8(length, 0);
      } else if (length <= 0x3FFF) { // 01 - 2 bytes
        buffer = Buffer.alloc(2);
        buffer.writeUInt16BE(length | 0x4000, 0);
      } else if (length <= 0x3FFFFF) { // 10 - 3 bytes
        buffer = Buffer.alloc(3);
        buffer.writeUIntBE(length | 0x800000, 0, 3);
      } else { // 11 - 4 bytes
        buffer = Buffer.alloc(4);
        R32[0] = length;
        R32[0] |= 0xc0000000;
        buffer.writeUInt32BE(R32[0], 0);
      }
      this._writeBytes(buffer);
    }

    readLength() {
      const firstByte = this._readBytes(1).readUInt8(0);
      let length;
      if ((firstByte & 0xC0) === 0x00) { // 00
        length = firstByte & 0x3F;
      } else if ((firstByte & 0xC0) === 0x40) { // 01
        const buffer = Buffer.alloc(2);
        buffer[0] = firstByte;
        buffer[1] = this._readBytes(1).readUInt8(0);
        length = ((buffer.readUInt16BE(0) & 0x3FFF));
      } else if ((firstByte & 0xC0) === 0x80) { // 10
        const buffer = Buffer.alloc(3);
        buffer[0] = firstByte;
        buffer[1] = this._readBytes(1).readUInt8(0);
        buffer[2] = this._readBytes(1).readUInt8(0);
        length = ((buffer.readUIntBE(0,3) & 0x3FFFFF));
      } else { // 11
        const buffer = Buffer.alloc(4);
        buffer[0] = firstByte;
        buffer[1] = this._readBytes(1).readUInt8(0);
        buffer[2] = this._readBytes(1).readUInt8(0);
        buffer[3] = this._readBytes(1).readUInt8(0);
        R32[0] = buffer.readUInt32BE(0);
        R32[0] &= 0x3fffffff;
        length = R32[0];
      }
      return length;
    }

  // Cursor management
    jump(cursorPosition) {
      DEBUG && console.log(`Jumping to cursor position: ${cursorPosition}`);
      if (this._buffer.length) {
        this._writeBytes(this._buffer);
        DEBUG && console.log(`Wrote ${this._buffer.length} bytes at jump to ${cursorPosition}.`);
        this._buffer = Buffer.alloc(0);
      }
      this.cursor = cursorPosition;
      this.bitCursor = 0;
      return this;
    }

    jumpEnd() {
      if ( ! this.fd ) {
        throw new Error(`No open file to jump to the end of.`);
      } 
      if (this._buffer.length) {
        this._writeBytes(this._buffer);
        DEBUG && console.log(`Wrote ${this._buffer.length} bytes at jump to ${cursorPosition}.`);
        this._buffer = Buffer.alloc(0);
      }
      const {size} = fstatSync(this.fd);
      this.cursor = size;
      this.bitCursor = 0;
    }

    isEOF() {
      if ( this.fd ) {
        const {size} = fstatSync(this.fd);
        if ( this.cursor < size ) return false;
      }
      return true;
    }

    _alignToNextRead() {
      if (this.bitCursor > 0) {
        this.bitCursor = 0;
        this._buffer = Buffer.alloc(0);
      }
    }

    _alignToNextWrite() {
      if (this._buffer.length) {
        this._writeBytes(this._buffer);
        this._buffer = Buffer.alloc(0);
        this.bitCursor = 0;
      }
    }

  // Reading and writing bytes
    _readBytes(length, opts = {}) {
      try {
        this._validateLength(length);
        const stats = fstatSync(this.fd);
        if (this.cursor + length > stats.size) {
          throw new Error('Insufficient data in file: ' + this.filePath);
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

        DEBUG && console.log(`Wrote bytes (${this.filePath}): length=${buffer.length}, cursor=${this.cursor}, buffer=${buffer.toString('hex')}`);
      } catch (error) {
        console.error('Error writing bytes:', error);
        throw error;
      }
    }

  // Bitwise operations 
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

        const { value, bitOffset } = this.readBits(length, this._buffer, this.bitCursor);
        this.reading.push({ key: keyOrValue, value, type: `bit_${length}` });
        this.bitCursor = bitOffset;
        if (bitOffset == 0) {
          this._buffer = Buffer.alloc(0);
        } else {
          this._buffer = this._buffer.slice(-1);
        }
        DEBUG && console.log(`Direct read: value=${value.toString(2)}, bitCursor=${this.bitCursor}`);

        return this;
      } else {
        // Write mode
        const value = BigInt(keyOrValue);
        if (byteLength > this._buffer.length) {
          this._buffer = Buffer.concat([this._buffer, Buffer.alloc(byteLength - this._buffer.length)]);
        }
        const { buffer, bitOffset } = this.writeBits(length, value, this._buffer, this.bitCursor);
        this.bitCursor = bitOffset;
        if (bitOffset == 0) {
          // all bits used, carry forward nothing
          this._writeBytes(buffer);
          DEBUG && console.log(`Wrote ${buffer.length} bytes`);
          this._buffer = Buffer.alloc(0);
        } else {
          // carry forward the partial unused bits
          this._buffer = buffer.slice(-1);
          DEBUG && console.log(`Carried 1 bytes and wrote ${buffer.length - 1} bytes`);
          this._writeBytes(buffer.slice(0, -1));
        }

        DEBUG && console.log(`Write operation: buffer=${buffer.toString('hex')}, bitCursor=${this.bitCursor}`);
        return this;
      }
    }

  // Primitive types
    bool(keyOrValue) {
      if (typeof keyOrValue === 'string' || keyOrValue === undefined) {
        // Read mode
        const buy = this.bit(1, keyOrValue).last;
        const value = buy.value ? true : false;
        const type = 'bool';
        this.reading.push({ key: keyOrValue || 'bool', value, type });
        return this;
      } else {
        // Write mode
        return this.bit(1, keyOrValue ? 1 : 0);
      }
    }

    int8(keyOrValue) {
      if (typeof keyOrValue === 'string' || keyOrValue === undefined) {
        this._alignToNextRead();
        this._ensureBytes(1);
        const buffer = this._readBytes(1);
        const value = buffer.readInt8(0);
        this.reading.push({ key: keyOrValue || 'int8', value, type: 'int8' });
        return this;
      } else {
        this._alignToNextWrite();
        const value = keyOrValue;
        const buffer = Buffer.alloc(1);
        buffer.writeInt8(value, 0);
        this._writeBytes(buffer);
        return this;
      }
    }

    uint8(keyOrValue) {
      if (typeof keyOrValue === 'string' || keyOrValue === undefined) {
        this._alignToNextRead();
        this._ensureBytes(1);
        const buffer = this._readBytes(1);
        const value = buffer.readUInt8(0);
        this.reading.push({ key: keyOrValue || 'uint8', value, type: 'uint8' });
        return this;
      } else {
        this._alignToNextWrite();
        const value = keyOrValue;
        const buffer = Buffer.alloc(1);
        buffer.writeUInt8(value, 0);
        this._writeBytes(buffer);
        return this;
      }
    }

    int16(keyOrValue) {
      if (typeof keyOrValue === 'string' || keyOrValue === undefined) {
        this._alignToNextRead();
        this._ensureBytes(2);
        const buffer = this._readBytes(2);
        const value = this.endian === 'BE' ? buffer.readInt16BE(0) : buffer.readInt16LE(0);
        this.reading.push({ key: keyOrValue || 'int16', value, type: 'int16' });
        return this;
      } else {
        this._alignToNextWrite();
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
      if (typeof keyOrValue === 'string' || keyOrValue === undefined) {
        this._alignToNextRead();
        this._ensureBytes(2);
        const buffer = this._readBytes(2);
        const value = this.endian === 'BE' ? buffer.readUInt16BE(0) : buffer.readUInt16LE(0);
        this.reading.push({ key: keyOrValue || 'uint16', value, type: 'uint16' });
        return this;
      } else {
        this._alignToNextWrite();
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
      if (typeof keyOrValue === 'string' || keyOrValue === undefined) {
        this._alignToNextRead();
        this._ensureBytes(4);
        const buffer = this._readBytes(4);
        const value = this.endian === 'BE' ? buffer.readInt32BE(0) : buffer.readInt32LE(0);
        this.reading.push({ key: keyOrValue || 'int32', value, type: 'int32' });
        return this;
      } else {
        this._alignToNextWrite();
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
      if (typeof keyOrValue === 'string' || keyOrValue === undefined) {
        this._alignToNextRead();
        this._ensureBytes(4);
        const buffer = this._readBytes(4);
        const value = this.endian === 'BE' ? buffer.readUInt32BE(0) : buffer.readUInt32LE(0);
        this.reading.push({ key: keyOrValue || 'uint32', value, type: 'uint32' });
        return this;
      } else {
        this._alignToNextWrite();
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
      if (typeof keyOrValue === 'string' || keyOrValue === undefined) {
        this._alignToNextRead();
        this._ensureBytes(4);
        const buffer = this._readBytes(4);
        const value = this.endian === 'BE' ? buffer.readFloatBE(0) : buffer.readFloatLE(0);
        this.reading.push({ key: keyOrValue || 'float', value, type: 'float' });
        return this;
      } else {
        this._alignToNextWrite();
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
      if (typeof keyOrValue === 'string' || keyOrValue === undefined) {
        this._alignToNextRead();
        this._ensureBytes(8);
        const buffer = this._readBytes(8);
        const value = this.endian === 'BE' ? buffer.readDoubleBE(0) : buffer.readDoubleLE(0);
        this.reading.push({ key: keyOrValue || 'double', value, type: 'double' });
        return this;
      } else {
        this._alignToNextWrite();
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

    buffer(keyOrBuffer) {
      if (typeof keyOrBuffer === 'string' || keyOrBuffer === undefined) {
        this._alignToNextRead();
        const key = keyOrBuffer || 'buffer';
        const length = this.readLength();
        this._validateLength(length);
        this._ensureBytes(length);
        const buffer = this._readBytes(length);
        this.reading.push({ key, value: Buffer.from(buffer), type: 'buffer' });
        return this;
      } else if (Buffer.isBuffer(keyOrBuffer)) {
        this._alignToNextWrite();
        const buffer = keyOrBuffer;
        this._validateBuffer(buffer);
        this.writeLength(buffer.length);
        this._writeBytes(buffer);
        return this;
      } else {
        throw new Error('Invalid argument for buffer method');
      }
    }

    date(keyOrValue) {
      if (typeof keyOrValue === 'string' || keyOrValue === undefined) {
        this._alignToNextRead();
        this._ensureBytes(8);
        const buffer = this._readBytes(8);
        const value = new Date(Number(buffer.readBigUInt64BE(0)));
        this.reading.push({ key: keyOrValue || 'date', value, type: 'date' });
        return this;
      } else {
        this._alignToNextWrite();
        const value = keyOrValue;
        const buffer = Buffer.alloc(8);
        buffer.writeBigUInt64BE(BigInt(value.getTime()), 0);
        this._writeBytes(buffer);
        return this;
      }
    }

    // String get 
    gets(keyOrValue, len = null, encoding = 'utf8') {
      this._alignToNextRead();
      const key = keyOrValue || 'string';
      if (len !== null) {
        this._validateLength(len); // Validate the length
        this._ensureBytes(len);
        let value = this._readBytes(len, { decode: ETEXT }).toString(encoding);
        value = ATextDecoder.decode(value.buffer.slice(0, value.length));
        this.reading.push({ key, value, type: 'string' });
      } else {
        // Read metadata
        this._ensureBytes(2); // Ensure enough for length and encoding
        const encodingType = this.uint8().last.value;

        encoding = EncodingMap[encodingType];
        if (encoding === undefined) {
          throw new Error(`Unsupported encoding type: ${encodingType}`);
        }

        const strLength = this.readLength();
        this._validateLength(strLength); // Validate the length
        this._ensureBytes(strLength);
        let value;
        if (encoding === 'binary') {
          value = this._readBytes(strLength).toString('latin1');
        } else {
          value = this._readBytes(strLength, { decode: ETEXT });
          value = ATextDecoder.decode(value.buffer.slice(0, value.length));
        }
        this.reading.push({ key, value, type: 'string' });
      }
      return this;
    }

    // String put
    puts(value, len = null, encoding = 'utf8') {
      this._alignToNextWrite();
      let buffer;

      if (encoding === 'binary') {
        buffer = Buffer.from(value, 'latin1');
      } else {
        const encodedValue = ATextEncoder.encode(value);
        buffer = Buffer.from(encodedValue, encoding);
      }

      if (len === null) {
        // Non-fixed length string with metadata

        const encodingType = EncodingMap[encoding];
        if (encodingType === undefined) {
          throw new Error(`Unsupported encoding: ${encoding}`);
        }
        this.uint8(encodingType); // Write encoding type as integer

        this.writeLength(buffer.length);
        if (ETEXT) {
          BinaryUtils.encode(buffer);
        }
        this._writeBytes(buffer);
      } else {
        // Fixed length string
        this._validateLength(len); // Validate the length
        buffer = Buffer.alloc(len);
        buffer.write(value, 0, len, encoding);
        this._writeBytes(buffer, { encode: ETEXT });
      }
      return this;
    }

    bigInt(keyOrValue) {
      if (typeof keyOrValue === 'string') {
        this._alignToNextRead();
        const key = keyOrValue;
        const length = this.readLength();
        this._validateLength(length);
        this._ensureBytes(length);
        const buffer = this._readBytes(length);
        const value = BigInt('0x' + buffer.toString('hex'));
        this.reading.push({ key, value, type: 'bigint' });
        return this;
      } else if (typeof keyOrValue === 'bigint') {
        this._alignToNextWrite();
        let hex = keyOrValue.toString(16);
        if (  hex.length & 1 ) {
          hex = '0'+hex;
        }
        const buffer = Buffer.from(hex, 'hex');
        this.writeLength(buffer.length);
        this._writeBytes(buffer);
        return this;
      } else {
        throw new Error('Invalid argument for bigInt method');
      }
    }

  // Complex and collection types
    array(keyOrValue, length, type, delimiter = null) {
      this._validateLength(length); // Validate the length
      if (Array.isArray(keyOrValue)) {
        this._alignToNextWrite();
        const values = keyOrValue;
        for (let i = 0; i < values.length; i++) {
          this[type](values[i]);
          if (delimiter && i < values.length - 1) {
            this._writeBytes(Buffer.from(delimiter));
          }
        }
        return this;
      } else {
        this._alignToNextRead();
        const key = keyOrValue || 'array';
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
        this._alignToNextWrite();
        const values = keyOrValue;
        this.writeLength(values.length);
        for (let i = 0; i < values.length; i++) {
          this._writeTypeAndValue(values[i]);
          if (delimiter && i < values.length - 1) {
            this._writeBytes(Buffer.from(delimiter));
          }
        }
        return this;
      } else {
        this._alignToNextRead();
        const key = keyOrValue || 'heteroArray';
        const values = [];
        const length = this.readLength();
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
        this._alignToNextWrite();
        const map = keyOrValue;
        this.writeLength(map.size);
        for (const [key, value] of map.entries()) {
          this.puts(key);
          this._writeTypeAndValue(value);
        }
        return this;
      } else {
        this._alignToNextRead();
        const key = keyOrValue || 'map';
        const map = new Map();
        const length = this.readLength();
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

    set(keyOrValue) {
      if (keyOrValue instanceof Set) {
        this._alignToNextWrite();
        const set = keyOrValue;
        this.writeLength(set.size);
        for (const value of set.values()) {
          this._writeTypeAndValue(value);
        }
        return this;
      } else {
        this._alignToNextRead();
        const key = keyOrValue || 'set';
        const set = new Set();
        const length = this.readLength();
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
        this._alignToNextWrite();
        const obj = keyOrValue;
        const keys = Object.keys(obj);
        this.writeLength(keys.length);
        for (const key of keys) {
          this.puts(key);
          this._writeTypeAndValue(obj[key]);
        }
        return this;
      } else {
        this._alignToNextRead();
        const key = keyOrValue || 'pojo';
        const obj = {};
        const length = this.readLength();
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

  // Utility methods
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

    _writeTypeAndValue(value) {
      this._alignToNextWrite();
      if (typeof value === 'string') {
        this.uint8(BinaryType.STRING); // Type flag for string
        this.puts(value);
      } else if (typeof value === 'number') {
        // Determine the appropriate type for the number
        if (Number.isInteger(value)) {
          if (value >= -128 && value <= 127) {
            this.uint8(BinaryType.INT8);
            this.int8(value);
          } else if (value >= 0 && value <= 255) {
            this.uint8(BinaryType.UINT8);
            this.uint8(value);
          } else if (value >= -32768 && value <= 32767) {
            this.uint8(BinaryType.INT16);
            this.int16(value);
          } else if (value >= 0 && value <= 65535) {
            this.uint8(BinaryType.UINT16);
            this.uint16(value);
          } else if (value >= -2147483648 && value <= 2147483647) {
            this.uint8(BinaryType.INT32);
            this.int32(value);
          } else if (value >= 0 && value <= 4294967295) {
            this.uint8(BinaryType.UINT32);
            this.uint32(value);
          } else {
            this.uint8(BinaryType.DOUBLE); // Fallback to double for larger integers
            this.double(value);
          }
        } else {
          this.uint8(BinaryType.FLOAT); // Type flag for float
          this.float(value);
        }
      } else if (value instanceof Date) {
        this.uint8(BinaryType.DATE); // Type flag for date
        this.date(value);
      } else if (Array.isArray(value)) {
        this.uint8(BinaryType.HETERO_ARRAY); // Type flag for heteroArray
        this.heteroArray(value);
      } else if (value instanceof Map) {
        this.uint8(BinaryType.MAP); // Type flag for map
        this.map(value);
      } else if (value instanceof Set) {
        this.uint8(BinaryType.SET); // Type flag for set
        this.set(value);
      } else if (Buffer.isBuffer(value)) {
        this.uint8(BinaryType.BUFFER); // Type flag for buffer
        this.buffer(value);
      } else if (typeof value === 'object' && value !== null) {
        this.uint8(BinaryType.POJO);
        this.pojo(value);
      } else if (typeof value === 'boolean') {
        this.uint8(BinaryType.BOOL); // Type flag for bool
        this.bool(value);
      } else if (typeof value === 'bigint') {
        this.uint8(BinaryType.BIGINT); // Type flag for bigint
        this.bigInt(value);
      } else {
        console.error(`Unsupported value`, value);
        throw new Error('Unsupported type for _writeTypeAndValue');
      }
    }

    _readTypeAndValue(uniq = 'value') {
      this._alignToNextRead();
      const type = this.uint8('type').last.value;
      let value;
      switch (type) {
        case BinaryType.STRING:
          value = this.gets(uniq).last.value;
          break;
        case BinaryType.FLOAT:
          value = this.float(uniq).last.value;
          break;
        case BinaryType.DATE:
          value = this.date(uniq).last.value;
          break;
        case BinaryType.HETERO_ARRAY:
          value = this.heteroArray(uniq).last.value;
          break;
        case BinaryType.POJO:
          this.pojo(uniq);
          value = this.$(uniq).value;
          break;
        case BinaryType.MAP:
          this.map(uniq);
          value = this.$(uniq).value;
          break;
        case BinaryType.SET:
          this.set(uniq);
          value = this.$(uniq).value;
          break;
        case BinaryType.BUFFER:
          value = this.buffer(uniq).last.value;
          break;
        case BinaryType.BOOL:
          value = this.bool(uniq).last.value;
          break;
        case BinaryType.BIGINT:
          value = this.bigInt(uniq).last.value;
          break;
        case BinaryType.INT8:
          value = this.int8(uniq).last.value;
          break;
        case BinaryType.UINT8:
          value = this.uint8(uniq).last.value;
          break;
        case BinaryType.INT16:
          value = this.int16(uniq).last.value;
          break;
        case BinaryType.UINT16:
          value = this.uint16(uniq).last.value;
          break;
        case BinaryType.INT32:
          value = this.int32(uniq).last.value;
          break;
        case BinaryType.UINT32:
          value = this.uint32(uniq).last.value;
          break;
        case BinaryType.DOUBLE:
          value = this.double(uniq).last.value;
          break;
        default:
          throw new Error('Unknown type in _readTypeAndValue: ' + type);
      }
      return value;
    }

  // Compression and encryption 
    compressData(data) {
      return zlib.gzipSync(data);
    }

    decompressData(data) {
      return zlib.gunzipSync(data);
    }

    // gzip types is a compressed string or buffer type (for example, embedded file content)
    gzip(options) {
      if (typeof options === 'string' || options === undefined) {
        this._alignToNextRead();
        // Reading and decompressing
        const key = options || 'gzip';
        this._ensureBytes(1); // Read type
        const type = this._readBytes(1).readUInt8(0);
        this._ensureBytes(4); // Read length
        const compressedLength = this._readBytes(4).readUInt32BE(0);
        this._validateLength(compressedLength); // Validate the length
        this._ensureBytes(compressedLength);
        let compressedData = this._readBytes(compressedLength);
        compressedData = this.decompressData(compressedData);
        let value;
        if (type === BinaryType.STRING) {
          value = ATextDecoder.decode(compressedData);
        } else if (type === BinaryType.BUFFER) {
          value = compressedData;
        } else {
          throw new Error('Unknown data type');
        }
        this.reading.push({ key, value, type: 'gzip' });
      } else {
        this._alignToNextWrite();
        // Writing and compressing
        const { data } = options;
        let encodedData, type;
        if (typeof data === 'string') {
          encodedData = Buffer.from(ATextEncoder.encode(data));
          type = BinaryType.STRING; // Type flag for string
        } else if (Buffer.isBuffer(data)) {
          encodedData = data;
          type = BinaryType.BUFFER; // Type flag for buffer
        } else {
          throw new Error('Invalid data type for gzip method');
        }
        const compressedData = this.compressData(encodedData);
        const typeBuffer = Buffer.alloc(1);
        typeBuffer.writeUInt8(type, 0);
        const lengthBuffer = Buffer.alloc(4);
        lengthBuffer.writeUInt32BE(compressedData.length, 0);
        this._writeBytes(Buffer.concat([typeBuffer, lengthBuffer, compressedData]));
      }
      return this;
    }

  // File signing and verification 
    signFile(privateKeyPath) {
      // Read the private key
      if (!existsSync(privateKeyPath) || !existsSync(this.filePath)) {
        throw new Error(`Both private key (${privateKeyPath}) and file (${this.filePath}) must exist.`);
      }
      const privateKey = Buffer.from(readFileSync(privateKeyPath, 'utf8'), 'hex');

      // Read the file content excluding the signature (assume last 64 bytes for the signature)
      const fileContent = readFileSync(this.filePath);
      const contentToSign = fileContent;

      // Create the signature
      const signature = sign(contentToSign, privateKey);

      // Append the signature to the file
      appendFileSync(this.filePath, Buffer.from(signature));
    }

    verifyFile(publicKeyPath) {
      // Read the public key
      if (!existsSync(publicKeyPath) || !existsSync(this.filePath)) {
        throw new Error(`Both public key (${publicKeyPath}) and file (${this.filePath}) must exist.`);
      }
      const publicKey = Buffer.from(readFileSync(publicKeyPath, 'utf8'), 'hex');

      // Read the file content excluding the signature (assume last 64 bytes for the signature)
      const fileContent = readFileSync(this.filePath);
      const contentToVerify = fileContent.slice(0, fileContent.length - 64);
      const signature = fileContent.slice(fileContent.length - 64);

      // Verify the signature
      const isValid = verify(signature, contentToVerify, publicKey);

      return isValid;
    }

  // In-development / Uncategorized / Miscellaneous 
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
            result.push(`${hexData}\t${method}(${args.join(', ')}): ${JSON.stringify(this.last.value)}`);
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
};

export { BinaryHandler, BinaryTypes, BinaryUtils, BinaryType };


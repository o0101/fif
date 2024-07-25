import { createCipheriv, createHash, randomBytes } from 'crypto';
import { KeyedShuffle } from './KeyedShuffle.js';

export class AES {
  static prepare(key) {
    if (key instanceof Uint8Array) {
      return key;
    } else if (typeof key === "string") {
      const codes = [...key].map(char => char.codePointAt(0));
      return new Uint8Array(codes);
    } else if (Array.isArray(key)) {
      return new Uint8Array(key);
    } else {
      throw new TypeError(`Don't know how to convert: ${key} to Uint8Array`);
    }
  }

  constructor(key, iv) {
    if (!(key instanceof Uint8Array)) {
      throw new TypeError('Key must be a Uint8Array');
    }
    this.key = this.hashKey(key);
    this.iv = iv;
    this.cipher = createCipheriv('aes-256-ctr', this.key, this.iv);
  }

  hashKey(key) {
    const hash = createHash('sha512');
    hash.update(key);
    return hash.digest().slice(0, 32); // Use the first 256 bits (32 bytes) of the SHA-512 hash
  }

  next() {
    const buffer = Buffer.alloc(2); // 16-bit output
    const encrypted = this.cipher.update(buffer);
    const val = encrypted.readUInt16BE(0);
    return val;
  }

  keystream(length) {
    const stream = new Uint16Array(length);
    for (let k = 0; k < length; k++) {
      stream[k] = this.next();
    }
    return stream;
  }
}

export class AESShuffle extends KeyedShuffle {
  static get MAX_RANGE() { return 65536; }
  constructor() {
    super();
    this.iv = randomBytes(16);
  }
  getKeystream(key, length) {
    const aes = new AES(AES.prepare(key), this.iv);
    return {
      next: () => aes.next()
    };
  }
}


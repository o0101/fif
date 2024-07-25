// RC4Shuffle.js
import { KeyedShuffle } from './KeyedShuffle.js';

export class RC4 {
  static prepare(key) {
    if (key instanceof Uint8Array) {
      return key;
    } else if (typeof key === "string") {
      const codes = [...key].map(char => char.codePointAt(0));
      return new Uint8Array(codes);
    } else {
      throw new TypeError(`Don't know how to convert: ${key} to Uint8Array`);
    }
  }

  constructor(key) {
    if (!(key instanceof Uint8Array)) {
      throw new TypeError('Key must be a Uint8Array');
    }
    this.key = key;
    this.S = new Uint8Array(256);
    this.i = 0;
    this.j = 0;
    this.initialize();
  }

  initialize() {
    const keyLength = this.key.length;
    for (let i = 0; i < 256; i++) {
      this.S[i] = i;
    }
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + this.S[i] + this.key[i % keyLength]) % 256;
      [this.S[i], this.S[j]] = [this.S[j], this.S[i]]; // Swap
    }
  }

  next() {
    this.i = (this.i + 1) % 256;
    this.j = (this.j + this.S[this.i]) % 256;
    [this.S[this.i], this.S[this.j]] = [this.S[this.j], this.S[this.i]]; // Swap
    return this.S[(this.S[this.i] + this.S[this.j]) % 256];
  }

  keystream(length) {
    const stream = new Uint8Array(length);
    for (let k = 0; k < length; k++) {
      stream[k] = this.next();
    }
    return stream;
  }
}

export class RC4Shuffle extends KeyedShuffle {
  static get MAX_RANGE() { return 256; }
  getKeystream(key, length) {
    const rc4 = new RC4(RC4.prepare(key));
    return {
      next: () => rc4.next()
    };
  }
}


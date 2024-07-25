// Rain.js
import { rainstormHash } from '@dosyago/rainsum';
import { KeyedShuffle } from './KeyedShuffle.js';

export class Rain {
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

  constructor(key) {
    if (!(key instanceof Uint8Array)) {
      throw new TypeError('Key must be a Uint8Array');
    }
    this.key = key;
    this.state = new Uint8Array(this.key);
  }

  async next() {
    const hash = await rainstormHash(256, 0, this.state);
    this.state = Buffer.from(hash, 'hex');
    const val = this.state.readUint16BE(0);
    return val;
  }

  async keystream(length) {
    const stream = new Uint16Array(length);
    for (let k = 0; k < length; k++) {
      stream[k] = await this.next();
    }
    return stream;
  }
}

export class RainShuffle extends KeyedShuffle {
  static get MAX_RANGE() { return 65536; }
  
  getKeystream(key, length) {
    const rain = new Rain(Rain.prepare(key));
    return {
      next: async () => await rain.next()
    };
  }
}


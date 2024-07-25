// RC4Shuffle.js
import { KeyedShuffle } from './KeyedShuffle.js';

class RC4 {
  constructor(key) {
    this.key = key;
    this.S = [];
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
      j = (j + this.S[i] + this.key.charCodeAt(i % keyLength)) % 256;
      [this.S[i], this.S[j]] = [this.S[j], this.S[i]]; // Swap
    }
  }

  next() {
    this.i = (this.i + 1) % 256;
    this.j = (this.j + 1) % 256;
    [this.S[this.i], this.S[this.j]] = [this.S[this.j], this.S[this.i]]; // Swap
    return this.S[(this.S[this.i] + this.S[this.j]) % 256];
  }
}

export class RC4Shuffle extends KeyedShuffle {
  constructor() {
    super();
  }

  flatten(matrix) {
    return matrix.reduce((acc, val) => acc.concat(val), []);
  }

  unflatten(array, rows, cols) {
    let result = [];
    for (let i = 0; i < rows; i++) {
      result.push(array.slice(i * cols, i * cols + cols));
    }
    return result;
  }

  shuffle(matrix, key) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const flatArray = this.flatten(matrix);
    const rc4 = new RC4(key);

    for (let i = flatArray.length - 1; i > 0; i--) {
      const j = rc4.next() % (i + 1);
      [flatArray[i], flatArray[j]] = [flatArray[j], flatArray[i]]; // Swap
    }

    return this.unflatten(flatArray, rows, cols);
  }

  unshuffle(matrix, key) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const flatArray = this.flatten(matrix);
    const rc4 = new RC4(key);

    const indexMap = flatArray.map((_, i) => i);
    for (let i = indexMap.length - 1; i > 0; i--) {
      const j = rc4.next() % (i + 1);
      [indexMap[i], indexMap[j]] = [indexMap[j], indexMap[i]]; // Swap
    }

    const unshuffledArray = new Array(flatArray.length);
    for (let i = 0; i < flatArray.length; i++) {
      unshuffledArray[indexMap[i]] = flatArray[i];
    }

    return this.unflatten(unshuffledArray, rows, cols);
  }
}


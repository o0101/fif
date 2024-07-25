// KeyedShuffle.js
export class KeyedShuffle {
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
    if (rows == 0) return matrix;
    const cols = matrix[0].length;
    if (rows > 256 || cols > 256) {
      throw new Error('Matrix dimensions must be 256 or smaller.');
    }
    const flatArray = this.flatten(matrix);
    const keystream = this.getKeystream(key, flatArray.length);

    for (let i = flatArray.length - 1; i > 0; i--) {
      const j = this.getRandomIndex(keystream, i + 1);
      [flatArray[i], flatArray[j]] = [flatArray[j], flatArray[i]]; // Swap
    }

    return this.unflatten(flatArray, rows, cols);
  }

  unshuffle(matrix, key) {
    const rows = matrix.length;
    if (rows == 0) return matrix;
    const cols = matrix[0].length;
    if (rows > 256 || cols > 256) {
      throw new Error('Matrix dimensions must be 256 or smaller.');
    }
    const flatArray = this.flatten(matrix);
    const keystream = this.getKeystream(key, flatArray.length);

    const indexMap = flatArray.map((_, i) => i);
    for (let i = indexMap.length - 1; i > 0; i--) {
      const j = this.getRandomIndex(keystream, i + 1);
      [indexMap[i], indexMap[j]] = [indexMap[j], indexMap[i]]; // Swap
    }

    const unshuffledArray = new Array(flatArray.length);
    for (let i = 0; i < flatArray.length; i++) {
      unshuffledArray[indexMap[i]] = flatArray[i];
    }

    return this.unflatten(unshuffledArray, rows, cols);
  }

  getRandomIndex(keystream, range) {
    if (range > 256) {
      throw new Error('Range must be 256 or smaller.');
    }
    let r;
    const maxValid = Math.floor(256 / range) * range;
    do {
      r = keystream.next();
    } while (r >= maxValid);
    return r % range;
  }

  // Subclasses must implement this method to provide a keystream generator
  getKeystream(key, length) {
    throw new Error('Subclasses must implement getKeystream');
  }
}



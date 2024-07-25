import { expect } from 'chai';
import { RC4Shuffle } from '../src/RC4Shuffle.js';

describe('RC4Shuffle', () => {
  let rc4Shuffle;

  beforeEach(() => {
    rc4Shuffle = new RC4Shuffle();
  });

  it('should shuffle and unshuffle a 3x3 matrix correctly with a given key', () => {
    const matrix = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ];
    const key = 'mysecretkey';

    const shuffledMatrix = rc4Shuffle.shuffle(matrix, key);
    const unshuffledMatrix = rc4Shuffle.unshuffle(shuffledMatrix, key);

    expect(unshuffledMatrix).to.deep.equal(matrix);
  });

  it('should shuffle and unshuffle a 2x2 matrix correctly with a different key', () => {
    const matrix = [
      [10, 20],
      [30, 40]
    ];
    const key = 'anotherkey';

    const shuffledMatrix = rc4Shuffle.shuffle(matrix, key);
    const unshuffledMatrix = rc4Shuffle.unshuffle(shuffledMatrix, key);

    expect(unshuffledMatrix).to.deep.equal(matrix);
  });

  it('should shuffle and unshuffle a 1x5 matrix correctly with a given key', () => {
    const matrix = [
      [100, 200, 300, 400, 500]
    ];
    const key = 'onemorekey';

    const shuffledMatrix = rc4Shuffle.shuffle(matrix, key);
    const unshuffledMatrix = rc4Shuffle.unshuffle(shuffledMatrix, key);

    expect(unshuffledMatrix).to.deep.equal(matrix);
  });

  it('should handle empty matrices correctly', () => {
    const matrix = [];
    const key = 'emptykey';

    const shuffledMatrix = rc4Shuffle.shuffle(matrix, key);
    const unshuffledMatrix = rc4Shuffle.unshuffle(shuffledMatrix, key);

    expect(unshuffledMatrix).to.deep.equal(matrix);
  });

  it('should handle matrices with one element correctly', () => {
    const matrix = [[42]];
    const key = 'oneelementkey';

    const shuffledMatrix = rc4Shuffle.shuffle(matrix, key);
    const unshuffledMatrix = rc4Shuffle.unshuffle(shuffledMatrix, key);

    expect(unshuffledMatrix).to.deep.equal(matrix);
  });

  it('should produce different shuffles with different keys', () => {
    const matrix = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ];
    const key1 = 'key1';
    const key2 = 'key2';

    const shuffledMatrix1 = rc4Shuffle.shuffle(matrix, key1);
    const shuffledMatrix2 = rc4Shuffle.shuffle(matrix, key2);

    expect(shuffledMatrix1).to.not.deep.equal(shuffledMatrix2);
  });
});


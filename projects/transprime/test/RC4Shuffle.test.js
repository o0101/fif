import assert from 'assert';
import { RC4, RC4Shuffle } from '../src/RC4Shuffle.js';
import { testVectors } from '../scripts/vectors.js';

describe('RC4', () => {
  testVectors.forEach(({ key, vectors }) => {
    describe(`Key: ${Array.from(key).map(b => b.toString(16).padStart(2, '0')).join('')}`, () => {
      Object.entries(vectors).forEach(([offset, expected]) => {
        it(`should produce correct keystream at offset ${offset}`, () => {
          const rc4 = new RC4(RC4.prepare(key));
          rc4.keystream(parseInt(offset)); // Advance to the offset
          const keystream = rc4.keystream(expected.length);
          assert.deepStrictEqual(keystream, new Uint8Array(expected));
        });
      });
    });
  });
});

describe('RC4Shuffle', () => {
  it('should shuffle and unshuffle a 3x3 matrix correctly with a given key', () => {
    const matrix = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ];
    const key = RC4.prepare('shufflekey');
    const rc4Shuffle = new RC4Shuffle();
    const shuffled = rc4Shuffle.shuffle(matrix, key);
    const unshuffled = rc4Shuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });

  it('should shuffle and unshuffle a 2x2 matrix correctly with a different key', () => {
    const matrix = [
      [1, 2],
      [3, 4]
    ];
    const key = RC4.prepare('anotherkey');
    const rc4Shuffle = new RC4Shuffle();
    const shuffled = rc4Shuffle.shuffle(matrix, key);
    const unshuffled = rc4Shuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });

  it('should shuffle and unshuffle a 1x5 matrix correctly with a given key', () => {
    const matrix = [
      [1, 2, 3, 4, 5]
    ];
    const key = RC4.prepare('yetanotherkey');
    const rc4Shuffle = new RC4Shuffle();
    const shuffled = rc4Shuffle.shuffle(matrix, key);
    const unshuffled = rc4Shuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });

  it('should handle empty matrices correctly', () => {
    const matrix = [];
    const key = RC4.prepare('emptykey');
    const rc4Shuffle = new RC4Shuffle();
    const shuffled = rc4Shuffle.shuffle(matrix, key);
    const unshuffled = rc4Shuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });

  it('should handle matrices with one element correctly', () => {
    const matrix = [
      [42]
    ];
    const key = RC4.prepare('singlekey');
    const rc4Shuffle = new RC4Shuffle();
    const shuffled = rc4Shuffle.shuffle(matrix, key);
    const unshuffled = rc4Shuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });

  it('should produce different shuffles with different keys', () => {
    const matrix = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ];
    const key1 = RC4.prepare('key1');
    const key2 = RC4.prepare('key2');
    const rc4Shuffle = new RC4Shuffle();
    const shuffled1 = rc4Shuffle.shuffle(matrix, key1);
    const shuffled2 = rc4Shuffle.shuffle(matrix, key2);
    assert.notDeepStrictEqual(shuffled1, shuffled2);
  });
});


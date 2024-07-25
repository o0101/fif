import assert from 'assert';
import { RC4, RC4Shuffle, RC4ShuffleDouble } from '../src/RC4Shuffle.js';
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

describe('RC4Shuffle', async () => {
  it('should shuffle and unshuffle a 3x3 matrix correctly with a given key', async () => {
    const matrix = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ];
    const key = RC4.prepare('shufflekey');
    const rc4Shuffle = new RC4Shuffle();
    const shuffled = await  rc4Shuffle.shuffle(matrix, key);
    const unshuffled = await  rc4Shuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });

  it('should shuffle and unshuffle a 2x2 matrix correctly with a different key', async () => {
    const matrix = [
      [1, 2],
      [3, 4]
    ];
    const key = RC4.prepare('anotherkey');
    const rc4Shuffle = new RC4Shuffle();
    const shuffled = await  rc4Shuffle.shuffle(matrix, key);
    const unshuffled = await  rc4Shuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });

  it('should shuffle and unshuffle a 1x5 matrix correctly with a given key', async () => {
    const matrix = [
      [1, 2, 3, 4, 5]
    ];
    const key = RC4.prepare('yetanotherkey');
    const rc4Shuffle = new RC4Shuffle();
    const shuffled = await  rc4Shuffle.shuffle(matrix, key);
    const unshuffled = await  rc4Shuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });

  it('should handle empty matrices correctly', async () => {
    const matrix = [];
    const key = RC4.prepare('emptykey');
    const rc4Shuffle = new RC4Shuffle();
    const shuffled = await  rc4Shuffle.shuffle(matrix, key);
    const unshuffled = await  rc4Shuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });

  it('should handle matrices with one element correctly', async () => {
    const matrix = [
      [42]
    ];
    const key = RC4.prepare('singlekey');
    const rc4Shuffle = new RC4Shuffle();
    const shuffled = await  rc4Shuffle.shuffle(matrix, key);
    const unshuffled = await  rc4Shuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });

  it('should produce different shuffles with different keys', async () => {
    const matrix = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ];
    const key1 = RC4.prepare('key1');
    const key2 = RC4.prepare('key2');
    const rc4Shuffle = new RC4Shuffle();
    const shuffled1 = await rc4Shuffle.shuffle(matrix, key1);
    const shuffled2 = await rc4Shuffle.shuffle(matrix, key2);
    assert.notDeepStrictEqual(shuffled1, shuffled2);
  });

  it('should shuffle and unshuffle a 16x16 matrix correctly with a given key', async () => {
    const size = 16;
    const matrix = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => i * size + j));
    const key = RC4.prepare('largekey');
    const rc4Shuffle = new RC4Shuffle();
    const shuffled = await  rc4Shuffle.shuffle(matrix, key);
    const unshuffled = await  rc4Shuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });
});

describe('RC4ShuffleDouble', async () => {
  it('should shuffle and unshuffle a 3x3 matrix correctly with a given key', async () => {
    const matrix = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ];
    const key = RC4.prepare('shufflekey');
    const rc4Shuffle = new RC4ShuffleDouble();
    const shuffled = await  rc4Shuffle.shuffle(matrix, key);
    const unshuffled = await  rc4Shuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });

  it('should shuffle and unshuffle a 2x2 matrix correctly with a different key', async () => {
    const matrix = [
      [1, 2],
      [3, 4]
    ];
    const key = RC4.prepare('anotherkey');
    const rc4Shuffle = new RC4ShuffleDouble();
    const shuffled = await  rc4Shuffle.shuffle(matrix, key);
    const unshuffled = await  rc4Shuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });

  it('should shuffle and unshuffle a 1x5 matrix correctly with a given key', async () => {
    const matrix = [
      [1, 2, 3, 4, 5]
    ];
    const key = RC4.prepare('yetanotherkey');
    const rc4Shuffle = new RC4ShuffleDouble();
    const shuffled = await  rc4Shuffle.shuffle(matrix, key);
    const unshuffled = await  rc4Shuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });

  it('should handle empty matrices correctly', async () => {
    const matrix = [];
    const key = RC4.prepare('emptykey');
    const rc4Shuffle = new RC4ShuffleDouble();
    const shuffled = await  rc4Shuffle.shuffle(matrix, key);
    const unshuffled = await  rc4Shuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });

  it('should handle matrices with one element correctly', async () => {
    const matrix = [
      [42]
    ];
    const key = RC4.prepare('singlekey');
    const rc4Shuffle = new RC4ShuffleDouble();
    const shuffled = await  rc4Shuffle.shuffle(matrix, key);
    const unshuffled = await  rc4Shuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });

  it('should produce different shuffles with different keys', async () => {
    const matrix = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9]
    ];
    const key1 = RC4.prepare('key1');
    const key2 = RC4.prepare('key2');
    const rc4Shuffle = new RC4ShuffleDouble();
    const shuffled1 = await rc4Shuffle.shuffle(matrix, key1);
    const shuffled2 = await rc4Shuffle.shuffle(matrix, key2);
    assert.notDeepStrictEqual(shuffled1, shuffled2);
  });

  it('should shuffle and unshuffle a large 100x100 matrix correctly with a given key', async () => {
    const size = 100;
    const matrix = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => i * size + j));
    const key = RC4.prepare('largekey');
    const rc4Shuffle = new RC4ShuffleDouble();
    const shuffled = await  rc4Shuffle.shuffle(matrix, key);
    const unshuffled = await  rc4Shuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });

  it('should shuffle and unshuffle a large 256x256 matrix correctly with a given key', async () => {
    const size = 256;
    const matrix = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => i * size + j));
    const key = RC4.prepare('largekey');
    const rc4Shuffle = new RC4ShuffleDouble();
    const shuffled = await  rc4Shuffle.shuffle(matrix, key);
    const unshuffled = await  rc4Shuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });
});


import assert from 'assert';
import { RC4, RC4Shuffle } from '../src/RC4Shuffle.js';

describe('RC4', () => {
  const testVectors = [
    {
      key: new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05]),
      vectors: {
        0: new Uint8Array([0xb2, 0x39, 0x63, 0x05, 0xf0, 0x3d, 0xc0, 0x27, 0xcc, 0xc3, 0x52, 0x4a, 0x0a, 0x11, 0x18, 0xa8]),
        768: new Uint8Array([0xeb, 0x62, 0x63, 0x8d, 0x4f, 0x0b, 0xa1, 0xfe, 0x9f, 0xca, 0x20, 0xe0, 0x5b, 0xf8, 0xff, 0x2b]),
        1536: new Uint8Array([0xd8, 0x72, 0x9d, 0xb4, 0x18, 0x82, 0x25, 0x9b, 0xee, 0x4f, 0x82, 0x53, 0x25, 0xf5, 0xa1, 0x30]),
        3072: new Uint8Array([0xec, 0x0e, 0x11, 0xc4, 0x79, 0xdc, 0x32, 0x9d, 0xc8, 0xda, 0x79, 0x68, 0xfe, 0x96, 0x56, 0x81]),
        4096: new Uint8Array([0xff, 0x25, 0xb5, 0x89, 0x95, 0x99, 0x67, 0x07, 0xe5, 0x1f, 0xbd, 0xf0, 0x8b, 0x34, 0xd8, 0x75])
      }
    },
    // Add more test vectors here
  ];

  testVectors.forEach(({ key, vectors }) => {
    describe(`Key: ${Array.from(key).map(b => b.toString(16).padStart(2, '0')).join('')}`, () => {
      Object.entries(vectors).forEach(([offset, expected]) => {
        it(`should produce correct keystream at offset ${offset}`, () => {
          const rc4 = new RC4(key);
          rc4.keystream(parseInt(offset)); // Advance to the offset
          const keystream = rc4.keystream(expected.length);
          assert.deepStrictEqual(keystream, expected);
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


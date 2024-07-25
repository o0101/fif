import assert from 'assert';
import { Rain, RainShuffle } from '../src/RainShuffle.js';

describe('RainShuffle', async () => {
  it('should shuffle and unshuffle a large 256x256 matrix correctly with a given key', async () => {
    const size = 256;
    const matrix = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => i * size + j));
    const key = Rain.prepare('largekey');
    const rainShuffle = new RainShuffle();
    const shuffled = await rainShuffle.shuffle(matrix, key);
    const unshuffled = await rainShuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });
});

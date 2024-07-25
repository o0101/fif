import assert from 'assert';
import { AES, AESShuffle } from '../src/AESShuffle.js';

describe('AESShuffle', async () => {
  it('should shuffle and unshuffle a large 256x256 matrix correctly with a given key', async () => {
    const size = 256;
    const matrix = Array.from({ length: size }, (_, i) => Array.from({ length: size }, (_, j) => i * size + j));
    const key = AES.prepare('largekey');
    const aesShuffle = new AESShuffle();
    const shuffled = await aesShuffle.shuffle(matrix, key);
    const unshuffled = await aesShuffle.unshuffle(shuffled, key);
    assert.deepStrictEqual(unshuffled, matrix);
  });
});

// Example usage
import { RC4Shuffle } from './RC4Shuffle.js';

const matrix = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9]
];

const key = 'mysecretkey';
const rc4Shuffle = new RC4Shuffle();

console.log('Original Matrix:');
console.log(matrix);

const shuffledMatrix = rc4Shuffle.shuffle(matrix, key);
console.log('Shuffled Matrix:');
console.log(shuffledMatrix);

const unshuffledMatrix = rc4Shuffle.unshuffle(shuffledMatrix, key);
console.log('Unshuffled Matrix:');
console.log(unshuffledMatrix);


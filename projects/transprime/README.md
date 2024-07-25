# TRANSPRIME - A New Block Cipher 

Basic design:

- key stream generation is flexible and different sources can be plugged in. For example:
  - RC4
  - Rainstorm Hash Half-output
  - Other iterated crypto-hashes Half-output
  - One time pad

- Block size is flexible, but larger sizes become infeasible quickly.
  - Standard block size is 2048 bits. 
  - 256-bytes per block are mapped to 256 unique primes based on a value-position matrix of the first 65536 primes.
  - This matrix is transposed by the keystream
  - The resulting primes are multiplied together, and the resulting bignum integer is written as ciphertext.

- A separate 2nd layer transformation can be applied to this product, for example, multiplied by a 2048-bit secret key prime
modulo a 3000-bit prime modulus. The resulting discrete residue is then written as ciphertext. This step is 'probably unnecessary' for
security, but it does make it a 'real block cipher' by applying a single (irreversible without key) operation that treats the entire block as a unity.

- 16-bit words can also be transposed by the first 2**32 primes but that is infeasible. 
- Alternately rectangular matrices, rather than the default square can be used to map bytes to primes:
  - For example, a 10-byte block could be mapped by a keyed transposition of the first 2560 primes.
  - Alternately, a 20-word (16-bit) block could be mapped by a keyed transposition of the first 1310720 primes.

- The block-size primes are generated once and cached. The transposition is rekeyed every block. Output should be indistuinguishable from random noise regardless of the input.

- There's no need to chain the blocks, they can be computed in parallel. Specific block sizes can be adjusted for applications but security analysis should investigate whether a given block configuration has unnacceptable security for the application. 



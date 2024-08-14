# **BinaryBliss Library**

Welcome to **BinaryBliss**, a versatile toolkit for handling binary data, file operations, and secure data management. This library is designed for advanced binary data manipulation, including bitwise operations, custom type definitions, encryption, and compression, all with a straightforward API.

```javascript
import { BinaryHandler } from './binary-bliss.js';

const h = new BinaryHandler;

h.openFile('my.bin');
h.writeMagic("PRICES");
h.writeLength(4);
h.float(4.99);
h.float(5.99);
h.float(6.99);
h.float(9.99);
h.closeFile();

h.openFile('my.bin');
h.readMagic("PRICES");
const len = h.readLength();
const prices = [];
for( let i = 0; i < len; i++ ) {
  prices[i] = h.float().last.value;
}
h.closeFile();

console.log({rawPrices: prices, fitPrices: prices.map(p => p.toFixed(2))});
```

Also, inspec the file with `xxd my.bin`:

```hex
00000000: 5052 4943 4553 0440 9fae 1440 bfae 1440  PRICES.@...@...@
00000010: dfae 1441 1fd7 0a                        ...A...
```

For more detailed (and crazy) examples [see the tests.js file](tests/tests.js), or just read on below for brief API overview and usage examples.

## **Features**

- **Supports a wide range of types** - BigInt, bit fields, Date objects, plus many other JavaScript built-in types and additional useful ones.
- **Binary Data Manipulation:** Effortlessly read and write binary data, including detailed control over bit-level operations.
- **Custom Type Definitions:** Define and manage custom binary types tailored to your specific needs.
- **File Operations:** Robust file handling, including advanced cursor management, file operations, and data verification.
- **Encryption & Decryption:** Secure data with RSA encryption, supporting hardened data types like strings, objects, and buffers.
- **Compression:** Gzip compression support for optimizing data storage and transmission.
- **Debugging Tools:** Integrated debugging tools to trace operations and inspect internal states.
- **Memory Efficient:** Uses incremental reads and writes, with an automatically managed cursor, does not read the entire file into memory. 

## **Installation**

Install the library via npm:

```bash
npm install binary-bliss@latest
```

## **Getting Started**

### **Basic Usage**

Here's a quick example of how to use **BinaryBliss**:

```javascript
import { BinaryHandler } from 'binary-bliss';

// Initialize a new BinaryHandler
const handler = new BinaryHandler({ endian: 'BE' });

// Open a file for reading and writing
handler.openFile('example.bin');

// Write an integer to the file
handler.int32(12345);

// Close the file
handler.closeFile();
```

### **Custom Type Definitions**

Define and work with custom binary types using `BinaryTypes`:

```javascript
import { BinaryTypes, BinaryHandler } from 'binary-bliss';

BinaryTypes.define('CustomType', [
  { name: 'field1', type: 'int32' },
  { name: 'field2', type: 'bool' },
]);

// Writing custom type data
const handler = new BinaryHandler();
handler.openFile('customType.bin');
BinaryTypes.write(handler, 'CustomType', { field1: 12345, field2: true });
handler.closeFile();

// Reading custom type data
handler.openFile('customType.bin');
const data = BinaryTypes.read(handler, 'CustomType');
console.log(data);
handler.closeFile();
```

## **Advanced Usage**

### **Hardened Data Types**

Encrypt data using RSA, making it secure for storage and transmission:

```javascript
import { BinaryHandler } from 'binary-bliss';

// Set public and private keys for encryption and decryption
await handler.setPublicKey('publicKey.pem');
await handler.setPrivateKey('privateKey.pem');

// Write a hardened string
handler.hputs(new BinaryHandler.HardString('Sensitive Data'));

// Read a hardened string
const data = handler.hgets('sensitiveData').last.value;
console.log(data);
```

### **Bitwise Operations**

Perform precise bitwise operations with ease:

```javascript
import { BinaryHandler } from 'binary-bliss';

const handler = new BinaryHandler();
handler.openFile('bitwise.bin');

// Write 8 bits
handler.bit(8, 0b10101010);

// Read 8 bits
handler.jump(0);  // Reset cursor to the beginning
const result = handler.bit(8, 'myBits').last.value;
console.log(`Bits read: ${result.toString(2)}`);
handler.closeFile();
```

### **File Signing & Verification**

Ensure file integrity with cryptographic signing and verification:

```javascript
import { BinaryHandler } from 'binary-bliss';

const handler = new BinaryHandler();
handler.openFile('signedFile.bin');

// Sign the file
handler.signFile('privateKey.pem');

// Verify the file
const isValid = handler.verifyFile('publicKey.pem');
console.log(`File is valid: ${isValid}`);
handler.closeFile();
```

### **Arrays and Heterogeneous Arrays**

Handle arrays and mixed-type arrays with ease:

```javascript
import { BinaryHandler } from 'binary-bliss';

const handler = new BinaryHandler();
handler.openFile('arrays.bin');

// Writing a homogeneous array
handler.array(['Hello', 'World'], 'string');

// Writing a heterogeneous array
handler.heteroArray(['Hello', 42, new Date()]);

// Reading arrays
handler.jump(0); // Reset cursor to the beginning
const homogenousArray = handler.array('myArray').last.value;
console.log(homogenousArray);

const heterogeneousArray = handler.heteroArray('myHeteroArray').last.value;
console.log(heterogeneousArray);

handler.closeFile();
```

### **Custom Types Example: Color**

You can define more complex custom types such as colors:

```javascript
import { BinaryTypes, BinaryHandler } from 'binary-bliss';

class Color {
  constructor(red, green, blue) {
    this.red = red;
    this.green = green;
    this.blue = blue;
  }
}

// Define a custom type for Color
BinaryTypes.define('Color', [
  { name: 'red', type: 'uint8' },
  { name: 'green', type: 'uint8' },
  { name: 'blue', type: 'uint8' }
]);

const color = new Color(255, 128, 64);
const handler = new BinaryHandler();
handler.openFile('color.bin');

// Write the custom color type to file
BinaryTypes.write(handler, 'Color', color);

// Read it back
handler.jump(0);
const readColor = BinaryTypes.read(handler, 'Color');
console.log(readColor);

handler.closeFile();
```

## **Debugging Tools**

For tracing operations and inspecting internal states:

```javascript
import { BinaryHandler } from 'binary-bliss';

const handler = new BinaryHandler();
handler.d = 'Debugging Mode'; // Set debug context
// Perform operations and check console for trace outputs
```

## **API Overview**

### **BinaryHandler**

- `openFile(filePath, options)`: Opens a file for reading and/or writing.
- `closeFile()`: Closes the currently open file.
- `jump(position)`: Moves the cursor to the specified byte position.
- `jumpEnd()`: Moves the cursor to the end of the file.
- `isEOF()`: Checks if the cursor is at the end of the file.
- `signFile(privateKeyPath)`: Signs the file with the provided private key.
- `verifyFile(publicKeyPath)`: Verifies the file with the provided public key.
- `bit(length, value)`: Writes or reads a specific number of bits.
- `int8(value)`, `uint8(value)`, `int16(value)`, `uint16(value)`, `int32(value)`, `uint32(value)`: Handles integer values of various sizes.
- `float(value)`, `double(value)`: Handles floating-point numbers.
- `bool(value)`: Handles boolean values.
- `buffer(value)`: Handles binary buffers.
- `puts(string)`, `gets(length)`: Handles strings.
- `array(array, type)`: Writes or reads a homogeneous array of a specific type.
- `heteroArray(array)`: Writes or reads a heterogeneous array.
- `map(map)`, `set(set)`: Handles maps and sets.
- `pojo(object)`: Handles plain JavaScript objects.
- `hputs(HardString)`, `hgets()`: Handles hardened strings.
- `hpojo(object)`: Handles hardened objects.
- `hbuffer(buffer)`: Handles hardened buffers.
- `gzip(options)`: Compresses or decompresses data using gzip.

### **BinaryTypes**

- `define(name, fields)`: Defines a custom binary type with specified fields.
- `write(handler, name, data)`: Writes a custom type to the binary handler.
- `read(handler, name)`: Reads a custom type from the binary handler.

### **BinaryUtils**

- `encode(buffer)`: Encodes a buffer with a bit rotation.
- `decode(buffer)`: Decodes a buffer encoded with a bit rotation.
- `chunkData(data, chunkSize)`: Splits data into chunks of the specified size.

## **Tests and Examples**

For more examples, refer to the [tests/test.js](tests/test.js) file in the repository. It contains a comprehensive set of tests that illustrate various use cases and edge cases for the library.

## **Contributing**

Contributions are welcome! Whether it's improving test coverage, enhancing the custom types, or proposing new features, we encourage you to participate. Please make sure to fully spec your idea nd get approval before submitting a pull request.

## **Limitations**

- The `BinaryTypes` custom type

support is still in its early stages and may have limited functionality. Contributions to expand and refine this feature are especially welcome.
- Currently, only RSA encryption is supported for hardened types. Future updates may include support for additional encryption methods.
- The library is optimized for use cases with manageable file sizes. Handling extremely large files or data streams may require additional optimizations.

## **Roadmap**

1. **Enhanced Custom Types**: Expanding support for more complex custom types, including nested structures and arrays within custom types.
2. **Streaming Support**: Introducing the ability to handle large files and data streams more efficiently.
3. **Expanded Encryption Options**: Adding support for alternative encryption algorithms and methods.
4. **Improved Compression**: Exploring additional compression techniques beyond gzip for more use cases.

## **Commercial Licensing**

For commercial usage and licensing options, please contact us at [licenses@dosyago.com](mailto:licenses@dosyago.com).

## **License**

This project is licensed under the Polyform Noncommercial License. See the [LICENSE](LICENSE) file for more details. Commercial licenses are available upon request.


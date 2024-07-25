import fs from 'fs';

// Read the file synchronously
const data = fs.readFileSync('rc4_vectors.txt', 'utf8');

// Function to parse key and vectors
function parseVectors(data) {
  const result = [];
  const lines = data.split('\n');
  const offsets = [0, 768, 1536, 3072, 4096]; // Offsets to focus on

  let currentKey = null;
  let currentVectors = {};

  lines.forEach(line => {
    const keyMatch = line.match(/key:\s+(0x[0-9a-f]+)/i);
    if (keyMatch) {
      // Save the previous key and vectors if they exist
      if (currentKey) {
        result.push({
          key: new Uint8Array(currentKey),
          vectors: currentVectors
        });
      }

      // Start a new key and vectors
      currentKey = keyMatch[1].slice(2).match(/.{2}/g).map(hex => parseInt(hex, 16));
      currentVectors = {};
    }

    const vectorMatch = line.match(/DEC\s+(\d+).*:(.*)/);
    if (vectorMatch) {
      const offset = parseInt(vectorMatch[1], 10);
      if (offsets.includes(offset)) {
        const values = vectorMatch[2].trim().split(/\s+/).map(hex => parseInt(hex, 16));
        currentVectors[offset] = new Uint8Array(values);
      }
    }
  });

  // Save the last key and vectors
  if (currentKey) {
    result.push({
      key: new Uint8Array(currentKey),
      vectors: currentVectors
    });
  }

  return result;
}

// Parse the vectors
const parsedData = parseVectors(data);

// Output the parsed data

const output = JSON.stringify(parsedData,function(k,v){
   if(v instanceof Uint8Array)
      return JSON.stringify(Array.from(v))
   return v;
},2);

console.log(`const testVectors = ${output.replace(/"/g, '')};`);


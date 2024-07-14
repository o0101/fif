import fs from 'fs';
import { BinaryHandler } from '../binary-bliss.js'; // Make sure to use the correct path

function readPDFMetadata(filePath) {
  const bh = new BinaryHandler('BE');
  bh.openFile(filePath);

  // Read PDF header
  bh.jump(0)
    .buffer('header', 8); // PDF header is typically "%PDF-x.x"

  // Move to the end of the file to read the trailer
  const stats = fs.fstatSync(bh.fd);
  const bufferSize = Math.min(1024, stats.size); // Read last 1024 bytes or less if the file is smaller
  bh.jump(stats.size - bufferSize)
    .buffer('trailerBuffer', bufferSize);

  const trailerBuffer = bh.$('trailerBuffer').value;
  const trailerString = trailerBuffer.toString('utf8');

  // Extract the trailer dictionary
  const trailerMatch = trailerString.match(/trailer\s*<<(.*)>>\s*startxref/);
  let trailerDict = {};
  if (trailerMatch) {
    const trailerContent = trailerMatch[1];
    trailerDict = parsePDFDictionary(trailerContent);
  }

  // Extract startxref
  const startxrefMatch = trailerString.match(/startxref\s*(\d+)/);
  const startxref = startxrefMatch ? parseInt(startxrefMatch[1], 10) : null;

  // Close file
  bh.closeFile();

  // Retrieve and return metadata information
  const header = bh.read();
  return {
    header: header.header.value.toString('utf8'),
    trailerDict,
    startxref,
  };
}

// Helper function to parse PDF dictionary strings
function parsePDFDictionary(dictString) {
  const dict = {};
  const regex = /\/(\w+)\s+(\S+)/g;
  let match;
  while ((match = regex.exec(dictString)) !== null) {
    const key = match[1];
    let value = match[2];
    if (value.startsWith('(') && value.endsWith(')')) {
      value = value.slice(1, -1); // Remove parentheses around string values
    }
    dict[key] = value;
  }
  return dict;
}

// Example usage
const filePath = process.argv[2];
if (!filePath || !fs.existsSync(filePath)) throw new Error(`File path ${filePath} does not exist`);
const pdfMetadata = readPDFMetadata(filePath);
console.log(pdfMetadata);


import { BinaryHandler } from './binary-bliss.js';
import { unlinkSync, existsSync } from 'fs';
import path from 'path';

// Create a made-up format: [header, value1, value2, ... valueN]
function createExampleData(filePath) {
  const handler = new BinaryHandler();
  handler.openFile(filePath, 'w+');

  handler.writeMagic('HDR');   // Writing header
  handler.uint32(100);         // Writing value1
  handler.float(123.456);      // Writing value2
  handler.uint32(200);         // Writing value3

  handler.closeFile();
}

function modifyExampleData(filePath) {
  const handler = new BinaryHandler();
  handler.openFile(filePath, 'r+');

  // Reading existing values
  handler.readMagic('HDR');    // Reading header
  handler.uint32('value1');    // Reading value1
  handler.float('value2');     // Reading value2
  handler.uint32('value3');    // Reading value3

  console.log('Original data', handler.read());


  // Modifying value2 (e.g., doubling it)
  const value2 = handler.$('value2').value;
  const newValue2 = value2 * 2;

  console.log(`Modification: ${value2} * 2`);

  // Writing the modified data back
  handler.jump(0);
  handler.writeMagic('HDR');   // Writing header again
  handler.uint32(handler.$('value1').value);   // Writing value1
  handler.float(newValue2);    // Writing modified value2
  handler.uint32(handler.$('value3').value);   // Writing value3

  handler.closeFile();
}

function runExample() {
  const filePath = path.join(process.cwd(), 'example.bin');
  cleanUp(filePath);

  console.log('Creating Example Data...');
  createExampleData(filePath);

  console.log('Modifying Example Data...');
  modifyExampleData(filePath);

  // Verifying the modification
  const handler = new BinaryHandler();
  handler.openFile(filePath, 'r+');
  handler.readMagic('HDR');    // Reading header
  handler.uint32('value1');    // Reading value1
  handler.float('value2');     // Reading value2
  handler.uint32('value3');    // Reading value3
  handler.closeFile();

  console.log('Modified Data:', handler.read());

  cleanUp(filePath);
}

// Helper function to clean up files
function cleanUp(filePath) {
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

runExample();


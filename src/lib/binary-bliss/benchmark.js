import { BinaryHandler } from './binary-bliss.js';
import { unlinkSync, existsSync } from 'fs';
import path from 'path';

// Helper function to generate random data
function generateRandomData(sizeInMB) {
  const size = sizeInMB * 1024 * 1024;
  const buffer = Buffer.alloc(size);
  for (let i = 0; i < size; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  return buffer;
}

// Helper function to clean up files
function cleanUp(filePath) {
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

function benchmarkWrite(filePath, data) {
  const handler = new BinaryHandler();
  handler.openFile(filePath);
  const start = process.hrtime();
  console.log(data.length);
  handler.buffer(data);  // Writing data
  const end = process.hrtime(start);
  handler.closeFile();

  const seconds = end[0] + end[1] / 1e9;
  const mbPerSecond = data.length / (1024 * 1024) / seconds;

  console.log(`Write Speed: ${mbPerSecond.toFixed(2)} MB/s`);
}

function benchmarkRead(filePath, dataSize) {
  const handler = new BinaryHandler();
  handler.openFile(filePath);
  const start = process.hrtime();
  handler.buffer('data', dataSize);  // Reading data
  const end = process.hrtime(start);
  handler.closeFile();

  const seconds = end[0] + end[1] / 1e9;
  const mbPerSecond = dataSize / (1024 * 1024) / seconds;

  console.log(`Read Speed: ${mbPerSecond.toFixed(2)} MB/s`);
}

function verifyData(filePath, originalData) {
  const handler = new BinaryHandler();
  handler.openFile(filePath);
  handler.buffer('data', originalData.length); // Reading data
  handler.closeFile();

  const readData = handler.$('data').value;
  const isEqual = Buffer.compare(originalData, readData) === 0;
  console.log(`Data Verification: ${isEqual ? 'Success' : 'Failure'}`);
}

function runBenchmarks() {
  const RUNS = parseInt(process.argv[2]) || 10;
  for( let i = 0; i < RUNS; i++ ) {
    console.log(`Run ${i+1} of ${RUNS}`);
    const filePath = path.join(process.cwd(), 'benchmark.bin');
    const sizeInMB = 100;
    const data = generateRandomData(sizeInMB);

    cleanUp(filePath);

    console.log('Running Write Benchmark...');
    benchmarkWrite(filePath, data);

    console.log('Running Read Benchmark...');
    benchmarkRead(filePath, data.length);

    console.log('Verifying Data...');
    verifyData(filePath, data);

    cleanUp(filePath);
  }
}

runBenchmarks();


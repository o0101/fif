import path from 'path';
import fs from 'fs';
import { BinaryHandler } from '../binary-bliss.js'; // Make sure to use the correct path

function testMPEG2TSHeader() {
  console.log('Testing MPEG-2 TS Header Parsing');

  const filePath = path.join('mpeg2ts_sample.ts');
  const bh = new BinaryHandler('BE');

  // Simulate writing a TS packet header
  const sampleBuffer = Buffer.from([
    0x47,       // Sync Byte
    0x40, 0x00, // PID (13 bits, value 256)
    0x10,       // Scrambling Control, Adaptation Control, Continuity Counter
  ]);
  fs.writeFileSync(filePath, sampleBuffer);

  bh.openFile(filePath);

  // Read MPEG-2 TS packet header (4 bytes)
  bh.jump(0)
    .uint8('syncByte')             // Sync Byte
    .bit(1, 'transportError')      // Transport Error Indicator
    .bit(1, 'payloadStart')        // Payload Unit Start Indicator
    .bit(1, 'transportPriority')   // Transport Priority
    .bit(13, 'pid')                // PID
    .bit(2, 'scramblingControl')   // Transport Scrambling Control
    .bit(2, 'adaptationControl')   // Adaptation Field Control
    .bit(4, 'continuityCounter');  // Continuity Counter

  const result = bh.read();

  // Assertions to verify the parsing
  assertEqual(0x47, result.syncByte.value, 'Sync Byte');
  assertEqual(0, result.transportError.value, 'Transport Error Indicator');
  assertEqual(0, result.payloadStart.value, 'Payload Unit Start Indicator');
  assertEqual(0, result.transportPriority.value, 'Transport Priority');
  assertEqual(256, result.pid.value, 'PID'); // Adjust PID value according to the sample file
  assertEqual(0, result.scramblingControl.value, 'Transport Scrambling Control');
  assertEqual(1, result.adaptationControl.value, 'Adaptation Field Control');
  assertEqual(0, result.continuityCounter.value, 'Continuity Counter');

  bh.closeFile();
  fs.unlinkSync(filePath);
}

// Helper function for assertions
function assertEqual(expected, actual, message) {
  if (expected !== actual) {
    console.error(`Test failed: ${message}\nExpected: ${expected}\nActual: ${actual}`);
  } else {
    console.log(`Test passed: ${message}`);
  }
}

// Run the MPEG-2 TS header test
testMPEG2TSHeader();


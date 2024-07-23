import fs from 'fs';
import path from 'path';
import { BinaryHandler } from '../binary-bliss.js'; // Make sure to use the correct path

function readMPEG2TSHeader(filePath) {
  const bh = new BinaryHandler('BE');
  bh.openFile(filePath);

  // Ensure the file has enough data for the TS header
  const fileSize = fs.statSync(filePath).size;
  if (fileSize < 4) {
    throw new Error('File is too small to be a valid MPEG-2 TS packet.');
  }

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

  // Close file
  bh.closeFile();

  // Retrieve and return header information
  const header = bh.read();
  return {
    syncByte: header.syncByte.value.toString(16),
    transportError: header.transportError.value,
    payloadStart: header.payloadStart.value,
    transportPriority: header.transportPriority.value,
    pid: header.pid.value,
    scramblingControl: header.scramblingControl.value,
    adaptationControl: header.adaptationControl.value,
    continuityCounter: header.continuityCounter.value,
  };
}

// Example usage
const filePath = process.argv[2];
if (!filePath || !fs.existsSync(filePath)) throw new Error(`File path ${filePath} does not exist`);
const tsHeaderInfo = readMPEG2TSHeader(filePath);
console.log(tsHeaderInfo);


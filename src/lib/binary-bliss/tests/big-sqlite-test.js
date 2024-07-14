import fs from 'fs';
import { BinaryHandler } from '../binary-bliss.js'; // Adjust the path as needed

function readSQLiteHeader(filePath) {
  const bh = new BinaryHandler('BE');
  bh.openFile(filePath);

  // Read header
  bh.jump(0)
    .buffer('magic', 16) // "SQLite format 3\000"
    .uint16('pageSize')   // Page size
    .uint8('writeVersion') // File format write version
    .uint8('readVersion')  // File format read version
    .uint8('reservedSpace') // Reserved space per page
    .uint8('maxPayloadFraction') // Maximum embedded payload fraction
    .uint8('minPayloadFraction') // Minimum embedded payload fraction
    .uint8('leafPayloadFraction') // Leaf payload fraction
    .uint32('fileChangeCounter') // File change counter
    .uint32('databaseSize') // Number of pages in the database
    .uint32('firstFreePage') // First free page
    .uint32('numberOfFreePages') // Number of free pages
    .uint32('schemaCookie') // Schema cookie
    .uint32('schemaFormat') // Schema format number
    .uint32('defaultPageCacheSize') // Default page cache size
    .uint32('largestRootBtreePage') // Largest root b-tree page
    .uint32('textEncoding') // Text encoding
    .uint32('userVersion') // User version
    .uint32('incrementalVacuumMode') // Incremental vacuum mode
    .uint32('applicationId') // Application ID
    .buffer('reserved', 20) // Reserved for expansion
    .uint32('versionValidFor') // Version-valid-for number
    .uint32('sqliteVersion'); // SQLite version number

  // Close file
  bh.closeFile();

  // Retrieve and return header information
  const header = bh.read();
  return {
    magic: header.magic.value.toString('utf8'),
    pageSize: header.pageSize.value,
    writeVersion: header.writeVersion.value,
    readVersion: header.readVersion.value,
    reservedSpace: header.reservedSpace.value,
    maxPayloadFraction: header.maxPayloadFraction.value,
    minPayloadFraction: header.minPayloadFraction.value,
    leafPayloadFraction: header.leafPayloadFraction.value,
    fileChangeCounter: header.fileChangeCounter.value,
    databaseSize: header.databaseSize.value,
    firstFreePage: header.firstFreePage.value,
    numberOfFreePages: header.numberOfFreePages.value,
    schemaCookie: header.schemaCookie.value,
    schemaFormat: header.schemaFormat.value,
    defaultPageCacheSize: header.defaultPageCacheSize.value,
    largestRootBtreePage: header.largestRootBtreePage.value,
    textEncoding: header.textEncoding.value,
    userVersion: header.userVersion.value,
    incrementalVacuumMode: header.incrementalVacuumMode.value,
    applicationId: header.applicationId.value,
    versionValidFor: header.versionValidFor.value,
    sqliteVersion: header.sqliteVersion.value,
  };
}

// Example usage
const filePath = process.argv[2];
if (!filePath || !fs.existsSync(filePath)) throw new Error(`File path ${filePath} does not exist`);
const headerInfo = readSQLiteHeader(filePath);
console.log(headerInfo);


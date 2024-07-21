import { BinaryHandler } from 'binary-bliss';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import path from 'path';
import os from 'os';

const homeDir = os.homedir();
const libraryDir = path.join(homeDir, '.config', 'guutreader', 'library');

// Ensure the library directory exists
if (!existsSync(libraryDir)) {
  mkdirSync(libraryDir, { recursive: true });
}

function loadLibrary() {
  const library = [];
  const files = readdirSync(libraryDir);
  files.forEach(file => {
    if (!file.endsWith('.bin')) return;
    const bookId = path.parse(file).name;
    const binaryHandler = new BinaryHandler();
    binaryHandler.openFile(path.join(libraryDir, file));
    binaryHandler.readMagic('GR');
    binaryHandler.uint32('bookmark');
    const metadata = binaryHandler.pojo('metadata').last.value;
    library.push({ bookId, metadata });
    binaryHandler.closeFile();
  });
  return library;
}

function saveBookmark(bookId, currentPage) {
  const binaryHandler = new BinaryHandler();
  binaryHandler.openFile(path.join(libraryDir, `${bookId}.bin`));
  binaryHandler.readMagic('GR');
  binaryHandler.uint32(currentPage); // Update bookmark
  binaryHandler.closeFile();
}

function readBook(bookId) {
  const binaryHandler = new BinaryHandler();
  binaryHandler.openFile(path.join(libraryDir, `${bookId}.bin`));
  binaryHandler.readMagic('GR');
  const currentPage = binaryHandler.uint32('bookmark').last.value; // Read the bookmark
  const metadata = binaryHandler.pojo('metadata').last.value;
  const bookText = binaryHandler.gets('bookText').last.value;
  binaryHandler.closeFile();
  return { currentPage, metadata, bookText };
}

export { libraryDir, loadLibrary, saveBookmark, readBook };


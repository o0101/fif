import { readdirSync, writeFileSync } from 'fs';
import path from 'path';
import { BinaryHandler } from '../../src/lib/binary-bliss/binary-bliss.js';

const booksDir = 'books';

function migrateBooks() {
  const files = readdirSync(booksDir);
  files.forEach(file => {
    if (!file.endsWith('.bin')) return;
    const filePath = path.join(booksDir, file);

    // Read the current book data
    const binaryHandler = new BinaryHandler();
    binaryHandler.openFile(filePath);
    binaryHandler.readMagic('GR');
    const metadata = binaryHandler.pojo('metadata').value.value;
    const bookText = binaryHandler.gets('bookText').value.value;
    binaryHandler.closeFile();

    // Write the updated book data with bookmark
    binaryHandler.openFile(filePath, 'w+');
    binaryHandler.writeMagic('GR');
    binaryHandler.uint32(0); // Initialize bookmark
    binaryHandler.pojo(metadata);
    binaryHandler.puts(bookText);
    binaryHandler.closeFile();
    
    console.log(`Migrated ${file}`);
  });
}

migrateBooks();


import readlineSync from 'readline-sync';
import { searchBooks, downloadBook } from './gutenberg.js';
import { BinaryHandler } from '../../src/lib/binary-bliss/binary-bliss.js';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import path from 'path';

const booksDir = 'books';
let searchResults;
let library = [];
let currentPage = 0;
const linesPerPage = 20;

// Ensure the books directory exists
if (!existsSync(booksDir)) {
  mkdirSync(booksDir);
}

// Load the library from the books directory
function loadLibrary() {
  const files = readdirSync(booksDir);
  files.forEach(file => {
    const bookId = path.parse(file).name;
    const binaryHandler = new BinaryHandler();
    binaryHandler.openFile(path.join(booksDir, file));
    binaryHandler.readMagic('GR');
    const metadata = binaryHandler.pojo('metadata').value.value;
    library.push({ bookId, metadata });
    binaryHandler.closeFile();
  });
}

loadLibrary();

export async function startRepl() {
  console.log('Welcome to the Project Gutenberg Reader');

  while (true) {
    const command = readlineSync.question('> ');

    if (command.startsWith('search ')) {
      const query = command.slice(7);
      const results = await searchBooks(query);
      searchResults = results;
      displayResults(results);
    } else if (command.startsWith('download ')) {
      const resultIndex = parseInt(command.slice(9)) - 1;
      if (resultIndex >= 0 && resultIndex < searchResults.length) {
        const book = searchResults[resultIndex];
        const bookId = book.id;
        const bookText = await downloadBook(bookId);
        saveBook(book, bookText);
      } else {
        console.log('Invalid index');
      }
    } else if (command === 'library') {
      displayLibrary();
    } else if (command.startsWith('read ')) {
      const libraryId = command.slice(5);
      const bookId = library[parseInt(libraryId) - 1].bookId;
      readBook(bookId);
    } else if (command === 'n') {
      nextPage();
    } else if (command === 'p') {
      previousPage();
    } else if (command === 'quit') {
      break;
    } else {
      console.log('Unknown command');
    }
  }
}

function displayResults(results) {
  if (!results || results.length === 0) {
    console.log('No results found.');
    return;
  }
  
  results.forEach((book, index) => {
    console.log(`${index + 1}. [ID: ${book.id}] ${book.title} by ${book.authors.map(author => author.name).join(', ')}`);
  });
}

async function saveBook(book, bookText) {
  const metadata = { bookId: book.id, title: book.title, author: book.authors.map(author => author.name).join(', ') };

  console.log('Downloading book...');
  const bookText = await downloadBook(bookId, progress => {
    process.stdout.write(`Downloaded: ${progress} bytes\r`);
  });

  const binaryHandler = new BinaryHandler();
  binaryHandler.openFile(path.join(booksDir, `${bookId}.bin`));
  binaryHandler.writeMagic('GR');
  binaryHandler.pojo(metadata);
  binaryHandler.puts(bookText);
  binaryHandler.closeFile();

  library.push({ bookId, metadata });
  console.log('\nDownload complete.');
}

function displayLibrary() {
  library.forEach((book, index) => {
    console.log(`${index + 1}. [ID: ${book.bookId}] ${book.metadata.title} by ${book.metadata.author}`);
  });
}

function readBook(bookId) {
  const binaryHandler = new BinaryHandler();
  binaryHandler.openFile(path.join(booksDir, `${bookId}.bin`));
  binaryHandler.readMagic('GR');
  binaryHandler.pojo('metadata');
  const bookText = binaryHandler.gets('bookText').value.value;
  binaryHandler.closeFile();

  // Split the book text into pages
  global.bookPages = bookText.split('\n');
  global.currentPage = 0;

  displayPage();
}

function displayPage() {
  const start = currentPage * linesPerPage;
  const end = start + linesPerPage;
  const pageContent = global.bookPages.slice(start, end).join('\n');
  console.log(pageContent);
}

function nextPage() {
  if ((currentPage + 1) * linesPerPage < global.bookPages.length) {
    currentPage++;
    displayPage();
  } else {
    console.log('You are at the end of the book.');
  }
}

function previousPage() {
  if (currentPage > 0) {
    currentPage--;
    displayPage();
  } else {
    console.log('You are at the beginning of the book.');
  }
}

export default { startRepl };


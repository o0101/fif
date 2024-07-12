import readlineSync from 'readline-sync';
import { BinaryHandler } from 'binary-bliss';
import { searchBooks, downloadBook } from './gutenberg.js';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import path from 'path';

const booksDir = 'books';
let searchResults = [];
let library = [];
let currentPage = 0;
const linesPerPage = process.stdout.rows - 2 || 21;
let currentBookId = null; // Track the current book being read

// Ensure the books directory exists
if (!existsSync(booksDir)) {
  mkdirSync(booksDir);
}

// Load the library from the books directory
function loadLibrary() {
  const files = readdirSync(booksDir);
  files.forEach(file => {
    if (!file.endsWith('.bin')) return;
    const bookId = path.parse(file).name;
    const binaryHandler = new BinaryHandler();
    binaryHandler.openFile(path.join(booksDir, file));
    binaryHandler.readMagic('GR');
    binaryHandler.uint32('bookmark');
    const metadata = binaryHandler.pojo('metadata').value.value;
    library.push({ bookId, metadata });
    binaryHandler.closeFile();
  });
}

loadLibrary();

export async function startRepl() {
  console.log('Welcome to the Project Gutenberg Reader');
  console.log('Type "help" to see available commands.');

  while (true) {
    try {
      const command = readlineSync.question('> ');

      if (command === 'help') {
        displayHelp();
      } else if (command.startsWith('search ') || command.startsWith('s ')) {
        command.trim().split(/\s+/g).shift();
        const query = command.join(' ');
        const results = await searchBooks(query);
        searchResults = results; // Store the search results
        displayResults(results);
      } else if (command.startsWith('download ') || command.startsWith('d ')) {
        const resultIndex = parseInt(command.trim().split(/\s+/g).pop()) - 1;
        if (resultIndex >= 0 && resultIndex < searchResults.length) {
          const book = searchResults[resultIndex];
          const bookId = book.id;
          await saveBook(book, bookId);
        } else {
          console.log('Invalid index');
        }
      } else if (command === 'library' || command === 'l') {
        displayLibrary();
      } else if (command.startsWith('read ') || command.startsWith('r ')) {
        const libraryId = command.trim().split(/\s+/g).pop();
        const bookId = library[parseInt(libraryId) - 1].bookId;
        currentBookId = bookId; // Track the current book
        readBook(bookId);
      } else if (command === 'n') {
        nextPage();
      } else if (command === 'p') {
        previousPage();
      } else if (command === 'quit' || command === 'q') {
        break;
      } else {
        console.log('Unknown command');
      }
    } catch (e) {
      console.warn('There was an error', e);
    }
  }
}

function displayHelp() {
  console.log(`
Available commands:
  help               - Display this help message
  search <query>     - Search for books by title, author, or topic
  download <number>  - Download a book from the search results
  library            - Display your library of downloaded books
  read <number>      - Read a book from your library
  n                  - Next page
  p                  - Previous page
  quit               - Quit the reader
  `);
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

async function saveBook(book, bookId) {
  const metadata = { title: book.title, author: book.authors.map(author => author.name).join(', ') };

  console.log('Downloading book...');
  const bookText = await downloadBook(bookId, (progress, total) => {
    if (total) {
      const percent = ((progress / total) * 100).toFixed(2);
      process.stdout.write(`Downloaded: ${progress} bytes (${percent}%)\r`);
    } else {
      process.stdout.write(`Downloaded: ${progress} bytes\r`);
    }
  });

  const binaryHandler = new BinaryHandler();
  binaryHandler.openFile(path.join(booksDir, `${bookId}.bin`));
  binaryHandler.writeMagic('GR');
  binaryHandler.uint32(0); // Initialize bookmark
  binaryHandler.pojo(metadata);
  binaryHandler.puts(bookText);
  binaryHandler.closeFile();

  library.push({ bookId, metadata });
  console.log('\nDownload complete.');
}

function displayLibrary() {
  if (library.length === 0) {
    console.log('No books in library.');
    return;
  }

  library.forEach((book, index) => {
    console.log(`${index + 1}. ${book.metadata.title} by ${book.metadata.author}`);
  });
}

function readBook(bookId) {
  const binaryHandler = new BinaryHandler();
  binaryHandler.openFile(path.join(booksDir, `${bookId}.bin`));
  binaryHandler.readMagic('GR');
  currentPage = binaryHandler.uint32('bookmark').value.value; // Read the bookmark
  const metadata = binaryHandler.pojo('metadata').value.value;
  const bookText = binaryHandler.gets('bookText').value.value;
  binaryHandler.closeFile();

  // Split the book text into pages
  global.bookPages = bookText.split('\n');

  displayPage();
}

function displayPage() {
  const start = currentPage * linesPerPage;
  const end = start + linesPerPage;
  const pageContent = global.bookPages.slice(start, end).join('\n');
  console.log(pageContent);
}

function saveBookmark(bookId) {
  const binaryHandler = new BinaryHandler();
  binaryHandler.openFile(path.join(booksDir, `${bookId}.bin`));
  binaryHandler.readMagic('GR');
  binaryHandler.uint32(currentPage); // Update bookmark
  binaryHandler.closeFile();
}

function nextPage() {
  if ((currentPage + 1) * linesPerPage < global.bookPages.length) {
    currentPage++;
    displayPage();
    saveBookmark(currentBookId);
  } else {
    console.log('You are at the end of the book.');
  }
}

function previousPage() {
  if (currentPage > 0) {
    currentPage--;
    displayPage();
    saveBookmark(currentBookId);
  } else {
    console.log('You are at the beginning of the book.');
  }
}

export default { startRepl };


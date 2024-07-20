import readline from 'readline';
import { searchBooks, downloadBook } from './gutenberg.js';
import { libraryDir, loadLibrary, saveBookmark, readBook } from './library.js';
import path from 'path';
import { BinaryHandler } from 'binary-bliss';
import { existsSync, mkdirSync } from 'fs';

let searchResults = [];
let library = loadLibrary();
let currentPage = 0;
const linesPerPage = process.stdout.rows - 2 || 21;
let currentBookId = null; // Track the current book being read
let lineOffset = 0; // Track the line offset for one-line scrolling

export async function startRepl() {
  console.log('Welcome to the Project Gutenberg Reader');
  console.log('Type "help" to see available commands.');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  process.stdin.on('keypress', (str, key) => {
    if (key.name === 'up') {
      previousLine();
    } else if (key.name === 'down') {
      nextLine();
    } else if (key.name === 'right') {
      nextPage();
    } else if (key.name === 'left') {
      previousPage();
    } else if (key.sequence === '\u0003') {
      // Handle Ctrl+C
      rl.close();
      process.exit();
    }
  });

  while (true) {
    try {
      const command = await new Promise(resolve => rl.question('> ', resolve));

      if (command === 'help' || command === 'h') {
        displayHelp();
      } else if (command.startsWith('search ') || command.startsWith('s ')) {
        const parts = command.trim().split(/\s+/g);
        parts.shift();
        const query = parts.join(' ');
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
        const { currentPage: savedPage, bookText } = readBook(bookId);
        currentPage = savedPage;
        global.bookPages = bookText.split('\n');
        displayPage();
      } else if (command === 'n') {
        nextPage();
      } else if (command === 'p') {
        previousPage();
      } else if (command === 'quit' || command === 'q') {
        rl.close();
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
    console.log(`${index + 1}. ${book.title} by ${book.authors.map(author => author.name).join(', ')}`);
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
  binaryHandler.openFile(path.join(libraryDir, `${bookId}.bin`));
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

function displayPage() {
  const start = currentPage * linesPerPage + lineOffset;
  const end = start + linesPerPage;
  const pageContent = global.bookPages.slice(start, end).join('\n');
  console.log(pageContent);
}

function nextPage() {
  if ((currentPage + 1) * linesPerPage < global.bookPages.length) {
    currentPage++;
    lineOffset = 0;
    displayPage();
    saveBookmark(currentBookId, currentPage);
  } else {
    console.log('You are at the end of the book.');
  }
}

function previousPage() {
  if (currentPage > 0) {
    currentPage--;
    lineOffset = 0;
    displayPage();
    saveBookmark(currentBookId, currentPage);
  } else {
    console.log('You are at the beginning of the book.');
  }
}

function nextLine() {
  if ((currentPage * linesPerPage + lineOffset + linesPerPage) < global.bookPages.length) {
    lineOffset++;
    if (lineOffset >= linesPerPage) {
      currentPage++;
      lineOffset = 0;
    }
    displayPage();
    saveBookmark(currentBookId, currentPage);
  } else {
    console.log('You are at the end of the book.');
  }
}

function previousLine() {
  if (currentPage > 0 || lineOffset > 0) {
    lineOffset--;
    if (lineOffset < 0) {
      currentPage--;
      lineOffset = linesPerPage - 1;
    }
    displayPage();
    saveBookmark(currentBookId, currentPage);
  } else {
    console.log('You are at the beginning of the book.');
  }
}

export default { startRepl };


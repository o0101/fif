import axios from 'axios';

const GUTENBERG_API_URL = 'https://gutendex.com/books/';

export async function searchBooks(query) {
  try {
    const response = await axios.get(GUTENBERG_API_URL, {
      params: {
        search: query,
      },
    });
    return response.data.results;
  } catch (error) {
    console.error('Error searching books:', error.message);
    return []; // Return an empty array on error
  }
}

export async function downloadBook(bookId, onProgress) {
  try {
    const response = await axios.get(`https://www.gutenberg.org/files/${bookId}/${bookId}-0.txt`, {
      responseType: 'stream',
    });

    let totalLength = 0;
    response.data.on('data', chunk => {
      totalLength += chunk.length;
      if (onProgress) {
        onProgress(totalLength);
      }
    });

    let bookText = '';
    response.data.on('data', chunk => {
      bookText += chunk.toString();
    });

    return new Promise((resolve, reject) => {
      response.data.on('end', () => resolve(bookText));
      response.data.on('error', reject);
    });
  } catch (error) {
    console.error('Error downloading book:', error.message);
  }
}



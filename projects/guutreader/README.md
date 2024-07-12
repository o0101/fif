# GuutReader

GuutReader is a command-line tool for accessing and reading books from Project Gutenberg. It allows you to search for books, download them, and read them with support for bookmarks and binary storage.

## Features

- Search for books by title, author, or topic
- Download and save books with metadata
- Bookmark your current reading position
- Paginate through the book text
- Efficient binary storage for books and metadata

## Installation

To install GuutReader globally, run:

```sh
npm install -g guutreader
```

## Usage

After installing, you can use the `gr` command to start the reader.

### Commands

- `help`: Display available commands and usage instructions
- `search <query>`: Search for books by title, author, or topic
- `download <number>`: Download a book from the search results
- `library`: Display your library of downloaded books
- `read <number>`: Read a book from your library
- `n`: Next page
- `p`: Previous page
- `quit`: Quit the reader

### Example

1. **Search for Books**

```sh
> search Dostoyevsky
```

2. **Download a Book**

```sh
> download 1
```

3. **View Library**

```sh
> library
```

4. **Read a Book**

```sh
> read 1
```

5. **Paginate through the Book**

```sh
> n  # Next page
> p  # Previous page
```

6. **Quit the Reader**

```sh
> quit
```

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## License

```
THE BEERWARE LICENSE (Revision 42):

Your Name wrote this file. As long as you retain this notice you can do whatever you want with this stuff. If we meet someday, and you think this stuff is worth it, you can buy me a beer in return.
```

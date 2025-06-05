export const schemaTemplate = `import { buildSchema } from 'graphql';

// Example schema - replace with your own
export const schema = buildSchema(\`
  type Book {
    id: ID!
    title: String!
    author: String!
    year: Int
    genre: String
  }

  type Author {
    id: ID!
    name: String!
    books: [Book]
    bio: String
  }

  type Query {
    books: [Book]
    book(id: ID!): Book
    authors: [Author]
    author(id: ID!): Author
  }

  type Mutation {
    addBook(title: String!, author: String!, year: Int, genre: String): Book
    updateBook(id: ID!, title: String, author: String, year: Int, genre: String): Book
    deleteBook(id: ID!): Boolean
    addAuthor(name: String!, bio: String): Author
  }
\`);

type Book = {
  id: string
  title: string
  author: string
  year?: number
  genre?: string
}

type Author = {
  id: string;
  name: string;
  bio?: string;
}
// Sample data - replace with your database queries
const books: Book[] = [
  { id: '1', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', year: 1925, genre: 'Classic' },
  { id: '2', title: 'To Kill a Mockingbird', author: 'Harper Lee', year: 1960, genre: 'Classic' },
  { id: '3', title: '1984', author: 'George Orwell', year: 1949, genre: 'Dystopian' }
];

const authors: Author[] = [
  { id: '1', name: 'F. Scott Fitzgerald', bio: 'American novelist and short story writer' },
  { id: '2', name: 'Harper Lee', bio: 'American novelist known for To Kill a Mockingbird' },
  { id: '3', name: 'George Orwell', bio: 'English novelist and essayist' }
];

// Resolvers - replace with your data fetching logic
export const resolvers = {
  books: () => books,
  book: ({ id }: { id: string }) => books.find(book => book.id === id),
  authors: () => authors,
  author: ({ id }: { id: string }) => authors.find(author => author.id === id),
  
  addBook: ({ title, author, year, genre }: { title: string, author: string, year?: number, genre?: string }) => {
    const newBook = {
      id: String(books.length + 1),
      title,
      author,
      year,
      genre
    };
    books.push(newBook);
    return newBook;
  },
  
  updateBook: ({ id, title, author, year, genre }: { id: string, title?: string, author?: string, year?: number, genre?: string }) => {
    const book = books.find(book => book.id === id);
    if (!book) return null;
    
    if (title) book.title = title;
    if (author) book.author = author;
    if (year !== undefined) book.year = year;
    if (genre) book.genre = genre;
    
    return book;
  },
  
  deleteBook: ({ id }: { id: string }) => {
    const index = books.findIndex(book => book.id === id);
    if (index === -1) return false;
    
    books.splice(index, 1);
    return true;
  },
  
  addAuthor: ({ name, bio }: { name: string, bio?: string }) => {
    const newAuthor = {
      id: String(authors.length + 1),
      name,
      bio
    };
    authors.push(newAuthor);
    return newAuthor;
  }
};
`;
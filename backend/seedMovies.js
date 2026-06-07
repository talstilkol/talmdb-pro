import 'dotenv/config';
import fs from 'node:fs/promises';
import mongoose from 'mongoose';

const seedFile = process.argv[2] || process.env.MOVIES_SEED_FILE;
const firstMovieYear = 1888;
const maxReleaseYear = new Date().getFullYear() + 2;

function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalize(item, index) {
  const movie = {
    title: clean(item.title),
    genre: clean(item.genre),
    description: clean(item.description).slice(0, 200),
    year: Number(item.year),
    poster: clean(item.poster),
    source: 'tmdb'
  };

  if (!movie.title || movie.title.length > 80) throw new Error(`Invalid title at row ${index + 1}`);
  if (!movie.genre) throw new Error(`Invalid genre at row ${index + 1}`);
  if (!Number.isInteger(movie.year) || movie.year < firstMovieYear || movie.year > maxReleaseYear) {
    throw new Error(`Invalid year at row ${index + 1}`);
  }
  if (movie.poster && !URL.canParse(movie.poster)) throw new Error(`Invalid poster URL at row ${index + 1}`);
  return movie;
}

if (!seedFile) throw new Error('Pass a JSON seed file path: npm --workspace backend run seed:movies -- /path/to/movies.json');
if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');

const data = JSON.parse(await fs.readFile(seedFile, 'utf8'));
if (!Array.isArray(data)) throw new Error('Seed file must contain an array');

const movies = data.map(normalize);
await mongoose.connect(process.env.MONGO_URI);

const now = new Date();
const operations = movies.map((movie) => ({
  updateOne: {
    filter: { title: movie.title, year: movie.year },
    update: {
      $set: { ...movie, updatedAt: now },
      $setOnInsert: { createdAt: now }
    },
    upsert: true
  }
}));

const result = operations.length ? await mongoose.connection.collection('movies').bulkWrite(operations, { ordered: false }) : {};
await mongoose.disconnect();

console.log(JSON.stringify({
  read: movies.length,
  inserted: result.upsertedCount || 0,
  updated: result.modifiedCount || 0,
  matched: result.matchedCount || 0
}));

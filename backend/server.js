import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json({ limit: '32kb' }));

const firstMovieYear = 1888;
const maxReleaseYear = new Date().getFullYear() + 2;

const movieSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    genre: { type: String, required: true, trim: true, minlength: 1 },
    description: { type: String, trim: true, maxlength: 200, default: '' },
    year: { type: Number, required: true, min: firstMovieYear, max: maxReleaseYear },
    poster: { type: String, trim: true, default: '' },
    tmdbId: { type: Number, index: true, sparse: true },
    source: { type: String, enum: ['manual', 'tmdb'], default: 'manual' }
  },
  { timestamps: true }
);

const Movie = mongoose.model('Movie', movieSchema);
const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const bad = (res, error) => res.status(400).json({ error });
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tmdbBase = 'https://api.themoviedb.org/3';
const tmdbImageBase = 'https://image.tmdb.org/t/p/w342';
const tmdbLanguage = process.env.TMDB_LANGUAGE || 'en-US';
const rateBuckets = new Map();
let genreCache = { expiresAt: 0, map: new Map() };
let mongoPromise;

async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!process.env.MONGO_URI) {
    const error = new Error('MONGO_URI is required');
    error.status = 503;
    throw error;
  }
  mongoPromise ||= mongoose.connect(process.env.MONGO_URI);
  return mongoPromise;
}

function movieError({ title, genre, description, year, poster, tmdbId }) {
  if (!title || title.length > 80) return 'Title must be 1-80 characters';
  if (!genre) return 'Genre is required';
  if (description.length > 200) return 'Description can be up to 200 characters';
  if (year === undefined || year === '') return 'Year is required';
  if (!Number.isInteger(Number(year)) || Number(year) < firstMovieYear || Number(year) > maxReleaseYear) return 'Year is invalid';
  if (poster && !URL.canParse(poster)) return 'Poster must be a valid URL';
  if (tmdbId !== undefined && tmdbId !== '' && !Number.isInteger(Number(tmdbId))) return 'TMDb id is invalid';
  return '';
}

function limit(max, windowMs) {
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const current = rateBuckets.get(key);
    if (!current || current.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (current.count >= max) return res.status(429).json({ error: 'Too many requests' });
    current.count += 1;
    next();
  };
}

function aiText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  const message = data.choices?.[0]?.message?.content;
  if (typeof message === 'string') {
    try {
      return JSON.parse(message).description || message;
    } catch {
      return message;
    }
  }
  if (!Array.isArray(data.output)) return '';
  return data.output
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .map((part) => part.text || '')
    .join(' ');
}

function tmdbUrl(path, params = {}) {
  const url = new URL(`${tmdbBase}${path}`);
  Object.entries({ language: tmdbLanguage, ...params }).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  });
  if (!process.env.TMDB_ACCESS_TOKEN && process.env.TMDB_API_KEY) {
    url.searchParams.set('api_key', process.env.TMDB_API_KEY);
  }
  return url;
}

async function tmdbFetch(path, params) {
  if (!process.env.TMDB_ACCESS_TOKEN && !process.env.TMDB_API_KEY) {
    const error = new Error('TMDB_ACCESS_TOKEN or TMDB_API_KEY is required');
    error.status = 503;
    throw error;
  }
  const res = await fetch(tmdbUrl(path, params), {
    headers: process.env.TMDB_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}` } : {}
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.status_message || 'TMDb request failed');
    error.status = 502;
    throw error;
  }
  return data;
}

async function genreMap() {
  if (genreCache.expiresAt > Date.now()) return genreCache.map;
  const data = await tmdbFetch('/genre/movie/list');
  const map = new Map((data.genres || []).filter((genre) => genre.id && genre.name).map((genre) => [genre.id, genre.name]));
  genreCache = { expiresAt: Date.now() + 86400000, map };
  return map;
}

function toSuggestion(movie, genresById) {
  const genres = (movie.genre_ids || []).map((id) => genresById.get(id)).filter(Boolean);
  const year = movie.release_date ? Number(movie.release_date.slice(0, 4)) : undefined;
  return {
    tmdbId: movie.id,
    title: clean(movie.title || movie.original_title),
    genre: genres[0] || 'unknown/unavailable',
    genres,
    description: clean(movie.overview).slice(0, 200),
    year: Number.isInteger(year) ? year : undefined,
    poster: movie.poster_path ? `${tmdbImageBase}${movie.poster_path}` : '',
    source: 'tmdb'
  };
}

app.get('/movies', async (_req, res, next) => {
  try {
    await connectDB();
    res.json(await Movie.find().sort({ createdAt: -1 }));
  } catch (error) {
    next(error);
  }
});

app.post('/movies', async (req, res, next) => {
  try {
    await connectDB();
    const movie = {
      title: clean(req.body.title),
      genre: clean(req.body.genre),
      description: clean(req.body.description),
      year: req.body.year === '' || req.body.year === undefined ? undefined : Number(req.body.year),
      poster: clean(req.body.poster),
      tmdbId: req.body.tmdbId === '' || req.body.tmdbId === undefined ? undefined : Number(req.body.tmdbId),
      source: req.body.source === 'tmdb' ? 'tmdb' : 'manual'
    };
    const error = movieError(movie);
    if (error) return bad(res, error);
    if (movie.tmdbId && (await Movie.exists({ tmdbId: movie.tmdbId }))) {
      return res.status(409).json({ error: 'Movie already exists' });
    }
    res.status(201).json(await Movie.create(movie));
  } catch (error) {
    next(error);
  }
});

app.delete('/movies/:id', async (req, res, next) => {
  try {
    await connectDB();
    if (!mongoose.isValidObjectId(req.params.id)) return bad(res, 'Invalid movie id');
    const deleted = await Movie.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Movie not found' });
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

app.get('/movies/search', async (req, res, next) => {
  try {
    await connectDB();
    const name = clean(req.query.name);
    if (!name) return res.json([]);
    const titleQuery = { title: { $regex: escapeRegex(name), $options: 'i' } };
    const filter = /^\d{4}$/.test(name) ? { $or: [titleQuery, { year: Number(name) }] } : titleQuery;
    res.json(await Movie.find(filter).sort({ createdAt: -1 }));
  } catch (error) {
    next(error);
  }
});

app.get('/movies/suggest', limit(30, 60000), async (req, res, next) => {
  try {
    const query = clean(req.query.query);
    if (query.length < 2) return res.json([]);
    const [data, genresById] = await Promise.all([
      tmdbFetch('/search/movie', { query, include_adult: 'false', page: '1' }),
      genreMap()
    ]);
    res.json((data.results || []).slice(0, 8).map((movie) => toSuggestion(movie, genresById)).filter((movie) => movie.title));
  } catch (error) {
    next(error);
  }
});

app.post('/movies/generate', limit(12, 60000), async (req, res, next) => {
  try {
    const title = clean(req.body.title);
    const genre = clean(req.body.genre);
    const year = req.body.year === '' || req.body.year === undefined ? undefined : Number(req.body.year);
    const error = movieError({ title, genre, description: '', year });
    if (error) return bad(res, error);
    if (!process.env.AI_GATEWAY_API_KEY && !process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'AI_GATEWAY_API_KEY or OPENAI_API_KEY is required' });
    }

    const useGateway = Boolean(process.env.AI_GATEWAY_API_KEY);
    const aiRes = await fetch(useGateway ? 'https://ai-gateway.vercel.sh/v1/chat/completions' : 'https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${useGateway ? process.env.AI_GATEWAY_API_KEY : process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(
        useGateway
          ? {
              model: process.env.AI_MODEL || 'openai/gpt-4o-mini',
              response_format: { type: 'json_object' },
              messages: [
                {
                  role: 'user',
                  content: `Return JSON only: {"description":"..."}. Write a concise movie description under 200 characters. Title: ${title}. Year: ${year}. Genre: ${genre}.`
                }
              ]
            }
          : {
              model: process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini',
              input: `Write one concise movie description under 200 characters. Title: ${title}. Year: ${year}. Genre: ${genre}. Return only the description.`
            }
      )
    });

    const data = await aiRes.json().catch(() => ({}));
    if (!aiRes.ok) return res.status(502).json({ error: 'AI request failed' });
    const description = aiText(data).trim().slice(0, 200);
    if (!description) return res.status(502).json({ error: 'AI response was empty' });
    res.json({ description });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  if (error.status) return res.status(error.status).json({ error: error.message });
  if (error.name === 'ValidationError') {
    return res.status(400).json({ error: Object.values(error.errors).map((item) => item.message).join(', ') });
  }
  console.error(error);
  res.status(500).json({ error: 'Server error' });
});

const port = process.env.PORT || 5000;
if (!process.env.VERCEL) {
  connectDB()
    .then(() => app.listen(port, () => console.log(`Backend listening on ${port}`)))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default app;

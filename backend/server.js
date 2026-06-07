import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';

const app = express();
app.use(cors());
app.use(express.json());

const movieSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 20 },
    genre: { type: String, required: true, trim: true, minlength: 1 },
    description: { type: String, trim: true, maxlength: 200, default: '' }
  },
  { timestamps: true }
);

const Movie = mongoose.model('Movie', movieSchema);
const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const bad = (res, error) => res.status(400).json({ error });
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function movieError({ title, genre, description }) {
  if (!title || title.length > 20) return 'Title must be 1-20 characters';
  if (!genre) return 'Genre is required';
  if (description.length > 200) return 'Description can be up to 200 characters';
  return '';
}

function aiText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  if (!Array.isArray(data.output)) return '';
  return data.output
    .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
    .map((part) => part.text || '')
    .join(' ');
}

app.get('/movies', async (_req, res, next) => {
  try {
    res.json(await Movie.find().sort({ createdAt: -1 }));
  } catch (error) {
    next(error);
  }
});

app.post('/movies', async (req, res, next) => {
  try {
    const movie = {
      title: clean(req.body.title),
      genre: clean(req.body.genre),
      description: clean(req.body.description)
    };
    const error = movieError(movie);
    if (error) return bad(res, error);
    res.status(201).json(await Movie.create(movie));
  } catch (error) {
    next(error);
  }
});

app.delete('/movies/:id', async (req, res, next) => {
  try {
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
    const name = clean(req.query.name);
    if (!name) return res.json([]);
    res.json(await Movie.find({ title: { $regex: escapeRegex(name), $options: 'i' } }).sort({ createdAt: -1 }));
  } catch (error) {
    next(error);
  }
});

app.post('/movies/generate', async (req, res, next) => {
  try {
    const title = clean(req.body.title);
    const genre = clean(req.body.genre);
    const error = movieError({ title, genre, description: '' });
    if (error) return bad(res, error);
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'OPENAI_API_KEY is required' });

    const aiRes = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        input: `Write one concise movie description under 200 characters. Title: ${title}. Genre: ${genre}. Return only the description.`
      })
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
  if (error.name === 'ValidationError') {
    return res.status(400).json({ error: Object.values(error.errors).map((item) => item.message).join(', ') });
  }
  console.error(error);
  res.status(500).json({ error: 'Server error' });
});

const port = process.env.PORT || 5000;
if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => app.listen(port, () => console.log(`Backend listening on ${port}`)))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const links = [
  ['/all-movies', 'All Movies'],
  ['/add-movie', 'Add Movie'],
  ['/search-movies', 'Search Movies']
];

function MovieList({ movies, onDelete }) {
  if (!movies.length) return <p className="text-sm text-gray-500">No movies found.</p>;
  return (
    <div className="grid gap-3">
      {movies.map((movie) => (
        <article key={movie._id} className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{movie.title}</h2>
              <p className="text-sm text-gray-600">{movie.genre}</p>
            </div>
            {onDelete && (
              <button
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                onClick={() => onDelete(movie._id)}
              >
                Delete
              </button>
            )}
          </div>
          {movie.description && <p className="mt-3 text-sm leading-6 text-gray-700">{movie.description}</p>}
        </article>
      ))}
    </div>
  );
}

function AllMovies() {
  const [movies, setMovies] = useState([]);

  async function load() {
    const res = await fetch(`${API}/movies`);
    setMovies(await res.json());
  }

  async function remove(id) {
    const res = await fetch(`${API}/movies/${id}`, { method: 'DELETE' });
    if (!res.ok) return alert('Delete failed');
    setMovies((items) => items.filter((movie) => movie._id !== id));
  }

  useEffect(() => {
    load().catch(() => alert('Could not load movies'));
  }, []);

  return <MovieList movies={movies} onDelete={remove} />;
}

function AddMovie() {
  const [form, setForm] = useState({ title: '', genre: '', description: '' });
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  function valid() {
    const movie = {
      title: form.title.trim(),
      genre: form.genre.trim(),
      description: form.description.trim()
    };
    if (!movie.title || movie.title.length > 20) return alert('Title must be 1-20 characters');
    if (!movie.genre) return alert('Genre is required');
    if (movie.description.length > 200) return alert('Description can be up to 200 characters');
    return movie;
  }

  async function submit(event) {
    event.preventDefault();
    const movie = valid();
    if (!movie) return;
    const res = await fetch(`${API}/movies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(movie)
    });
    if (!res.ok) return alert((await res.json()).error || 'Add failed');
    setForm({ title: '', genre: '', description: '' });
    alert('Movie added');
  }

  return (
    <form className="grid max-w-xl gap-3" onSubmit={submit}>
      <input className="rounded-md border p-3" name="title" placeholder="Title" value={form.title} onChange={change} />
      <input className="rounded-md border p-3" name="genre" placeholder="Genre" value={form.genre} onChange={change} />
      <textarea
        className="min-h-32 rounded-md border p-3"
        name="description"
        placeholder="Description"
        value={form.description}
        onChange={change}
      />
      <button className="rounded-md bg-blue-700 px-4 py-3 font-medium text-white hover:bg-blue-800">Add Movie</button>
    </form>
  );
}

function SearchMovies() {
  const [name, setName] = useState('');
  const [movies, setMovies] = useState([]);

  useEffect(() => {
    const query = name.trim();
    if (!query) return setMovies([]);
    const controller = new AbortController();
    fetch(`${API}/movies/search?name=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then(setMovies)
      .catch((error) => {
        if (error.name !== 'AbortError') alert('Search failed');
      });
    return () => controller.abort();
  }, [name]);

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Search Movies</h1>
      <input className="mb-4 w-full max-w-xl rounded-md border p-3" placeholder="Movie title" value={name} onChange={(event) => setName(event.target.value)} />
      <MovieList movies={movies} />
    </>
  );
}

function App() {
  const path = window.location.pathname;
  const Page = path === '/add-movie' ? AddMovie : path === '/search-movies' ? SearchMovies : AllMovies;
  return (
    <main className="mx-auto max-w-3xl p-6">
      <nav className="mb-6 flex flex-wrap gap-2">
        {links.map(([href, label]) => (
          <a key={href} className="rounded-md border bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50" href={href}>
            {label}
          </a>
        ))}
      </nav>
      <Page />
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const links = [
  ['/all-movies', 'Library'],
  ['/add-movie', 'Add Movie'],
  ['/search-movies', 'Search']
];
const cardColors = ['from-sky-500 to-cyan-400', 'from-rose-500 to-orange-400', 'from-emerald-500 to-teal-400', 'from-violet-500 to-fuchsia-500'];

async function api(path, options) {
  const res = await fetch(`${API}${path}`, options);
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function MovieCard({ movie, onDelete }) {
  const color = cardColors[(movie.title?.charCodeAt(0) || 0) % cardColors.length];
  const imdbUrl = `https://www.imdb.com/find/?q=${encodeURIComponent(movie.title)}`;
  return (
    <article className="flex min-h-full flex-col overflow-hidden rounded-lg border border-white/10 bg-neutral-900 shadow-lg">
      <div className="relative aspect-[2/3] bg-neutral-800">
        {movie.poster ? (
          <img className="h-full w-full object-cover" src={movie.poster} alt={movie.title} />
        ) : (
          <div className={`flex h-full items-center justify-center bg-gradient-to-br ${color}`}>
            <span className="text-6xl font-black text-white">{movie.title?.charAt(0)}</span>
          </div>
        )}
        {movie.year && <span className="absolute right-2 top-2 rounded bg-black/75 px-2 py-1 text-xs font-semibold text-yellow-300">{movie.year}</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="line-clamp-2 text-base font-bold">{movie.title}</h2>
        <p className="mt-1 text-sm text-yellow-300">{movie.genre}</p>
        <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-neutral-300">{movie.description || 'unknown/unavailable'}</p>
        <a className="mt-3 text-sm font-semibold text-sky-300 hover:text-sky-200" href={imdbUrl} target="_blank" rel="noreferrer">
          View on IMDb
        </a>
        {onDelete && (
          <button className="mt-3 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500" onClick={() => onDelete(movie._id)}>
            Delete
          </button>
        )}
      </div>
    </article>
  );
}

function MovieGrid({ movies, onDelete }) {
  if (!movies.length) return <p className="text-sm text-neutral-400">No movies found.</p>;
  return <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">{movies.map((movie) => <MovieCard key={movie._id} movie={movie} onDelete={onDelete} />)}</div>;
}

function AllMovies() {
  const [movies, setMovies] = useState([]);
  const [sortBy, setSortBy] = useState('createdAt');

  async function load() {
    setMovies(await api('/movies'));
  }

  async function remove(id) {
    try {
      await api(`/movies/${id}`, { method: 'DELETE' });
      setMovies((items) => items.filter((movie) => movie._id !== id));
    } catch (error) {
      alert(error.message);
    }
  }

  useEffect(() => {
    load().catch(() => alert('Could not load movies'));
  }, []);

  const sorted = useMemo(() => {
    return [...movies].sort((a, b) => {
      if (sortBy === 'year') return (b.year || 0) - (a.year || 0);
      if (sortBy === 'genre') return a.genre.localeCompare(b.genre);
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [movies, sortBy]);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black">TalMDB Pro</h1>
        <select className="rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-sm" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
          <option value="createdAt">Newest added</option>
          <option value="title">Title</option>
          <option value="year">Year</option>
          <option value="genre">Genre</option>
        </select>
      </div>
      <MovieGrid movies={sorted} onDelete={remove} />
    </>
  );
}

function AddMovie() {
  const [form, setForm] = useState({ title: '', genre: '', description: '', year: '', poster: '', tmdbId: '', source: 'manual' });
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [generating, setGenerating] = useState(false);
  const skipSuggest = useRef(false);
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });

  function valid() {
    const movie = {
      title: form.title.trim(),
      genre: form.genre.trim(),
      description: form.description.trim(),
      year: form.year ? Number(form.year) : undefined,
      poster: form.poster.trim(),
      tmdbId: form.tmdbId ? Number(form.tmdbId) : undefined,
      source: form.source
    };
    if (!movie.title || movie.title.length > 80) return alert('Title must be 1-80 characters');
    if (!movie.genre) return alert('Genre is required');
    if (movie.description.length > 200) return alert('Description can be up to 200 characters');
    if (movie.year && (!Number.isInteger(movie.year) || movie.year < 1888 || movie.year > new Date().getFullYear() + 2)) return alert('Year is invalid');
    return movie;
  }

  async function submit(event) {
    event.preventDefault();
    const movie = valid();
    if (!movie) return;
    try {
      await api('/movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movie)
      });
      setForm({ title: '', genre: '', description: '', year: '', poster: '', tmdbId: '', source: 'manual' });
      setSuggestions([]);
      alert('Movie added');
    } catch (error) {
      alert(error.message);
    }
  }

  async function generate() {
    const title = form.title.trim();
    const genre = form.genre.trim();
    if (!title || !genre) return alert('Enter title and genre first');
    setGenerating(true);
    try {
      const data = await api('/movies/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, genre })
      });
      setForm((current) => ({ ...current, description: data.description }));
    } catch (error) {
      alert(error.message);
    } finally {
      setGenerating(false);
    }
  }

  function pick(movie) {
    skipSuggest.current = true;
    setForm({
      title: movie.title || '',
      genre: movie.genres?.length ? movie.genres.join(', ') : movie.genre || '',
      description: movie.description || '',
      year: movie.year || '',
      poster: movie.poster || '',
      tmdbId: movie.tmdbId || '',
      source: 'tmdb'
    });
    setSuggestions([]);
  }

  useEffect(() => {
    const query = form.title.trim();
    if (skipSuggest.current) {
      skipSuggest.current = false;
      return;
    }
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoadingSuggest(true);
      fetch(`${API}/movies/suggest?query=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : []))
        .then(setSuggestions)
        .catch((error) => {
          if (error.name !== 'AbortError') setSuggestions([]);
        })
        .finally(() => setLoadingSuggest(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.title]);

  return (
    <form className="grid max-w-2xl gap-3" onSubmit={submit}>
      <h1 className="text-2xl font-black">Add Movie</h1>
      <div className="relative">
        <input className="w-full rounded-md border border-white/10 bg-neutral-900 p-3" name="title" placeholder="Title" value={form.title} onChange={change} />
        {loadingSuggest && <p className="mt-2 text-xs text-neutral-400">Searching TMDb...</p>}
        {suggestions.length > 0 && (
          <div className="absolute z-20 mt-2 max-h-96 w-full overflow-auto rounded-lg border border-white/10 bg-neutral-950 shadow-2xl">
            {suggestions.map((movie) => (
              <button key={`${movie.tmdbId}-${movie.title}`} type="button" className="flex w-full gap-3 p-3 text-left hover:bg-white/10" onClick={() => pick(movie)}>
                {movie.poster ? <img className="h-16 w-11 rounded object-cover" src={movie.poster} alt="" /> : <div className="h-16 w-11 rounded bg-neutral-800" />}
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{movie.title} {movie.year ? `(${movie.year})` : ''}</span>
                  <span className="block truncate text-sm text-yellow-300">{movie.genre}</span>
                  <span className="line-clamp-2 text-xs text-neutral-400">{movie.description || 'unknown/unavailable'}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <input className="rounded-md border border-white/10 bg-neutral-900 p-3" name="genre" placeholder="Genre" value={form.genre} onChange={change} />
      <input className="rounded-md border border-white/10 bg-neutral-900 p-3" name="year" placeholder="Year" value={form.year} onChange={change} />
      <input className="rounded-md border border-white/10 bg-neutral-900 p-3" name="poster" placeholder="Poster URL" value={form.poster} onChange={change} />
      <textarea
        className="min-h-32 rounded-md border border-white/10 bg-neutral-900 p-3"
        name="description"
        placeholder="Description"
        value={form.description}
        onChange={change}
      />
      <p className="text-right text-xs text-neutral-400">{form.description.length}/200</p>
      <button type="button" className="rounded-md border border-yellow-400 px-4 py-3 font-semibold text-yellow-300 hover:bg-yellow-400 hover:text-black" onClick={generate} disabled={generating}>
        {generating ? 'Generating...' : 'Generate AI Description'}
      </button>
      <button className="rounded-md bg-yellow-400 px-4 py-3 font-black text-black hover:bg-yellow-300">Add Movie</button>
    </form>
  );
}

function SearchMovies() {
  const [name, setName] = useState('');
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = name.trim();
    if (!query) return setMovies([]);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`${API}/movies/search?name=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then(setMovies)
        .catch((error) => {
          if (error.name !== 'AbortError') alert('Search failed');
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [name]);

  return (
    <>
      <h1 className="mb-4 text-2xl font-black">Search Movies</h1>
      <input className="mb-2 w-full max-w-xl rounded-md border border-white/10 bg-neutral-900 p-3" placeholder="Movie title" value={name} onChange={(event) => setName(event.target.value)} />
      <p className="mb-4 text-sm text-neutral-400">{loading ? 'Searching...' : name.trim() ? `${movies.length} results` : 'Type to search your library'}</p>
      <MovieGrid movies={movies} />
    </>
  );
}

function App() {
  const path = window.location.pathname;
  const Page = path === '/add-movie' ? AddMovie : path === '/search-movies' ? SearchMovies : AllMovies;
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <nav className="mx-auto mb-6 flex max-w-6xl flex-wrap gap-2 p-6 pb-0">
        {links.map(([href, label]) => (
          <a key={href} className="rounded-md border border-white/10 bg-neutral-900 px-3 py-2 text-sm font-semibold hover:bg-neutral-800" href={href}>
            {label}
          </a>
        ))}
      </nav>
      <section className="mx-auto max-w-6xl p-6 pt-0">
        <Page />
      </section>
      <footer className="mx-auto max-w-6xl px-6 pb-8 text-xs text-neutral-500">
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);

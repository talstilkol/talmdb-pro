# Movie App

Frontend: http://localhost:5173/all-movies  
Backend: http://localhost:5000/movies

## Run

1. `npm install`
2. Set `MONGO_URI` for the backend. For `/movies/generate`, also set `OPENAI_API_KEY`; `OPENAI_MODEL` is optional.
3. `npm run dev:backend`
4. `npm run dev:frontend`

The backend is an Express API connected to MongoDB with five routes: list, add, delete, title search, and AI description generation. The frontend is React with Tailwind and includes `/all-movies`, `/add-movie`, and `/search-movies`.

AI help: Codex was used to implement the API, React pages, Tailwind setup, validation, and this README.

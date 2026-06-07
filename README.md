# TalMDB Pro

Frontend: https://talmdb-pro.vercel.app/all-movies  
Backend: https://talmdb-pro.vercel.app/movies

Local in this workspace: http://127.0.0.1:5174/all-movies and http://localhost:5001/movies.

## Run

1. `npm install`
2. Set `MONGO_URI` for MongoDB.
3. For TMDb autocomplete, set `TMDB_ACCESS_TOKEN` or `TMDB_API_KEY`.
4. For AI descriptions, set `AI_GATEWAY_API_KEY` or `OPENAI_API_KEY`; `AI_MODEL` is optional.
5. `npm run dev:backend`
6. `npm run dev:frontend`

Seed 100 real movie records:

`npm --workspace backend run seed:movies -- /Users/tal/Desktop/פרויקט\ מבחן/svExam/movies-with-posters.json`

OpenAI API key: create a secret key at https://platform.openai.com/api-keys and save it as `OPENAI_API_KEY` in Vercel Environment Variables. Do not commit it.

## Features

- Express + Mongo movie library.
- React + Tailwind Pro UI.
- Live library search with debounce and request cancellation.
- TMDb autocomplete with dynamic genre lookup from TMDb, not hardcoded genre IDs.
- Movie autocomplete fills title, year, genre, description, poster, TMDb id, and source.
- Required release year, optional poster, TMDb id, and source tracking.
- AI description generation through Vercel AI Gateway or OpenAI.
- Backend validation, duplicate TMDb prevention, basic rate limiting, and safe title search.
- Search by movie title or exact release year.

## API

- `GET /movies`
- `POST /movies`
- `DELETE /movies/:id`
- `GET /movies/search?name=`
- `POST /movies/generate`
- `GET /movies/suggest?query=`
- `POST /movies/suggest`
- `GET /movies/genres`

This product uses the TMDB API but is not endorsed or certified by TMDB.

AI help: Codex was used to build the Pro UI, TMDb integration, AI endpoint support, validation, and this README.

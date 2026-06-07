# TalMDB Pro

Frontend: http://localhost:5173/all-movies  
Backend: http://localhost:5000/movies

## Run

1. `npm install`
2. Set `MONGO_URI` for MongoDB.
3. For TMDb autocomplete, set `TMDB_ACCESS_TOKEN` or `TMDB_API_KEY`.
4. For AI descriptions, set `AI_GATEWAY_API_KEY` or `OPENAI_API_KEY`; `AI_MODEL` is optional.
5. `npm run dev:backend`
6. `npm run dev:frontend`

## Features

- Express + Mongo movie library.
- React + Tailwind Pro UI.
- Live library search with debounce and request cancellation.
- TMDb autocomplete with dynamic genre lookup from TMDb, not hardcoded genre IDs.
- Optional poster, release year, TMDb id, and source tracking.
- AI description generation through Vercel AI Gateway or OpenAI.
- Backend validation, duplicate TMDb prevention, basic rate limiting, and safe title search.

## API

- `GET /movies`
- `POST /movies`
- `DELETE /movies/:id`
- `GET /movies/search?name=`
- `POST /movies/generate`
- `GET /movies/suggest?query=`

This product uses the TMDB API but is not endorsed or certified by TMDB.

AI help: Codex was used to build the Pro UI, TMDb integration, AI endpoint support, validation, and this README.

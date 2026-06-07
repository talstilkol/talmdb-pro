import app from '../backend/server.js';

export default function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const id = url.searchParams.get('id') || '';
  req.url = `/movies/${encodeURIComponent(id)}`;
  return app(req, res);
}

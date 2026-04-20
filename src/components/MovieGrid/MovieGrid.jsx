import { useEffect, useState, useRef } from 'react';
import './MovieGrid.css';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w300';

const GENRE_IDS = {
  'Trending Now': null,
  'Action':       28,
  'Comedy':       35,
  'Horror':       27,
  'Romance':      10749,
  'Sci-Fi':       878,
  'Thriller':     53,
};

const GENRE_NAMES = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy',
  80: 'Crime', 99: 'Documentary', 18: 'Drama', 10751: 'Family',
  14: 'Fantasy', 36: 'History', 27: 'Horror', 10402: 'Music',
  9648: 'Mystery', 10749: 'Romance', 878: 'Sci-Fi', 10770: 'TV Movie',
  53: 'Thriller', 10752: 'War', 37: 'Western',
};

const LS_PREFIX = 'kmv_tmdb_';
const LS_TTL    = 7 * 24 * 60 * 60 * 1000;

function lsGet(key) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > LS_TTL) { localStorage.removeItem(LS_PREFIX + key); return null; }
    return data;
  } catch { return null; }
}

function lsSet(key, data) {
  try { localStorage.setItem(LS_PREFIX + key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

function normalize(item) {
  return {
    id:         item.id,
    Title:      item.title || item.name || '—',
    Year:       item.release_date?.slice(0, 4) ?? '—',
    imdbRating: item.vote_average ? item.vote_average.toFixed(1) : '—',
    Poster:     item.poster_path ? `${TMDB_IMG}${item.poster_path}` : null,
    Genre:      (item.genre_ids ?? []).slice(0, 2).map(id => GENRE_NAMES[id]).filter(Boolean).join(', ') || '—',
    Type:       'movie',
  };
}

export default function MovieGrid({ genre = 'Trending Now', searchQuery = '' }) {
  const [movies, setMovies]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [visible, setVisible] = useState(false);
  const cache = useRef({});

  useEffect(() => {
    const key = import.meta.env.VITE_TMDB_KEY;
    if (!key) {
      setError('Add VITE_TMDB_KEY to your .env and restart the dev server.');
      setLoading(false);
      return;
    }

    const cacheKey = searchQuery ? `search:${searchQuery.toLowerCase()}` : genre;

    if (cache.current[cacheKey]) {
      setMovies(cache.current[cacheKey]);
      setLoading(false);
      setTimeout(() => setVisible(true), 30);
      return;
    }

    const stored = lsGet(cacheKey);
    if (stored) {
      cache.current[cacheKey] = stored;
      setMovies(stored);
      setLoading(false);
      setTimeout(() => setVisible(true), 30);
      return;
    }

    setLoading(true);
    setVisible(false);
    setMovies([]);
    setError(null);

    const base = 'https://api.themoviedb.org/3';
    let url;

    if (searchQuery) {
      url = `${base}/search/movie?api_key=${key}&query=${encodeURIComponent(searchQuery)}&language=en-US&page=1`;
    } else if (genre === 'Trending Now') {
      url = `${base}/trending/movie/week?api_key=${key}&language=en-US`;
    } else {
      const genreId = GENRE_IDS[genre];
      url = `${base}/discover/movie?api_key=${key}&with_genres=${genreId}&sort_by=popularity.desc&language=en-US&page=1`;
    }

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.success === false || !data.results) {
          setError(data.status_message ?? 'Failed to load movies.');
          setLoading(false);
          return;
        }
        if (data.results.length === 0) {
          setError('No results found.');
          setLoading(false);
          return;
        }
        const results = data.results.slice(0, 20).map(normalize);
        cache.current[cacheKey] = results;
        lsSet(cacheKey, results);
        setMovies(results);
        setLoading(false);
        setTimeout(() => setVisible(true), 30);
      })
      .catch(() => {
        setError('Network error — check your connection.');
        setLoading(false);
      });
  }, [genre, searchQuery]);

  if (loading) {
    return (
      <section className="mg-section">
        <div className="mg-heading mg-skeleton mg-skeleton-heading" />
        <div className="mg-grid mg-grid-skeleton">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="mg-card">
              <div className="mg-poster mg-skeleton" />
              <div className="mg-info">
                <div className="mg-skeleton mg-skeleton-meta" />
                <div className="mg-skeleton mg-skeleton-title" />
                <div className="mg-skeleton mg-skeleton-rating" />
                <div className="mg-skeleton mg-skeleton-genre" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    const isNoResults = error === 'No results found.';
    return (
      <section className="mg-section">
        <div className="mg-error-box">
          <p className="mg-error-title">{isNoResults ? 'No results found' : 'Something went wrong'}</p>
          <p className="mg-error-sub">{error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mg-section">
      <h2 className="mg-heading">
        {searchQuery ? `Results for "${searchQuery}"` : genre}
      </h2>
      <div className={`mg-grid${visible ? ' mg-grid-visible' : ''}`}>
        {movies.map((movie, i) => (
          <div
            key={movie.id}
            className="mg-card"
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            <div className="mg-poster">
              {movie.Poster
                ? <img
                    src={movie.Poster}
                    alt={movie.Title}
                    className="mg-poster-img"
                    onError={e => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextSibling.style.display = 'flex';
                    }}
                  />
                : null
              }
              <div
                className="mg-poster-fallback"
                style={{ display: movie.Poster ? 'none' : 'flex' }}
              >
                <span className="mg-no-image">No Image</span>
              </div>
            </div>
            <div className="mg-info">
              <p className="mg-meta">
                <span className="mg-year">{movie.Year}</span>
              </p>
              <h3 className="mg-title">{movie.Title}</h3>
              <div className="mg-ratings">
                <span className="mg-imdb-badge">
                  <span className="mg-imdb-label">TMDB</span>
                  <span className="mg-imdb-score">{movie.imdbRating}/10</span>
                </span>
              </div>
              <p className="mg-genre">{movie.Genre}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

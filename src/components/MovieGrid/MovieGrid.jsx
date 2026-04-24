import { useEffect, useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import './MovieGrid.css';

const IcoBookmarkFill = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
);
const IcoBookmarkOut = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
);

const TMDB_IMG    = 'https://image.tmdb.org/t/p/w300';
const TMDB_W500   = 'https://image.tmdb.org/t/p/w500';
const TMDB_W780   = 'https://image.tmdb.org/t/p/w780';

const IcoX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IcoStar = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

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
const PAGES     = 5; // 5 pages × 20 = up to 100 movies per genre

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
    PosterHD:   item.poster_path ? `${TMDB_W500}${item.poster_path}` : null,
    Backdrop:   item.backdrop_path ? `${TMDB_W780}${item.backdrop_path}` : null,
    Genre:      (item.genre_ids ?? []).slice(0, 2).map(id => GENRE_NAMES[id]).filter(Boolean).join(', ') || '—',
    Overview:   item.overview || '',
  };
}

async function fetchPages(baseUrl, pageCount) {
  const responses = await Promise.all(
    Array.from({ length: pageCount }, (_, i) =>
      fetch(`${baseUrl}&page=${i + 1}`).then(r => r.json())
    )
  );

  const seen = new Set();
  return responses
    .flatMap(data => data.results ?? [])
    .filter(item => {
      if (item.adult) return false;        // exclude 18+
      if (!item.poster_path) return false; // skip no-poster entries
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
}

export default function MovieGrid({ genre = 'Trending Now', searchQuery = '' }) {
  const [movies, setMovies]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [visible, setVisible]         = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [movieDetails, setMovieDetails]   = useState(null);
  const [modalLoading, setModalLoading]   = useState(false);
  const cache = useRef({});
  const { addBookmark, removeBookmark, isBookmarked, preferredCountry } = useApp();

  useEffect(() => {
    if (!selectedMovie) return;
    const close = e => { if (e.key === 'Escape') setSelectedMovie(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [selectedMovie]);

  useEffect(() => {
    if (!selectedMovie) { setMovieDetails(null); return; }
    const key = import.meta.env.VITE_TMDB_KEY;
    if (!key) return;
    setModalLoading(true);
    setMovieDetails(null);
    fetch(`https://api.themoviedb.org/3/movie/${selectedMovie.id}?api_key=${key}&language=en-US`)
      .then(r => r.json())
      .then(data => { setMovieDetails(data); setModalLoading(false); })
      .catch(() => setModalLoading(false));
  }, [selectedMovie?.id]);

  useEffect(() => {
    const key = import.meta.env.VITE_TMDB_KEY;
    if (!key) {
      setError('No API key found.');
      setLoading(false);
      return;
    }

    const countryParam = preferredCountry ? `&with_origin_country=${preferredCountry}` : '';
    const cacheKey = searchQuery
      ? `search:${searchQuery.toLowerCase()}`
      : `${genre}:${preferredCountry}`;

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

    const base  = 'https://api.themoviedb.org/3';
    const safe  = `include_adult=false&language=en-US`;

    let baseUrl;

    if (searchQuery) {
      baseUrl = `${base}/search/movie?api_key=${key}&${safe}&query=${encodeURIComponent(searchQuery)}`;
    } else if (genre === 'Trending Now') {
      if (preferredCountry) {
        baseUrl = `${base}/discover/movie?api_key=${key}&${safe}&sort_by=popularity.desc${countryParam}`;
      } else {
        baseUrl = `${base}/trending/movie/week?api_key=${key}&${safe}`;
      }
    } else {
      const genreId = GENRE_IDS[genre];
      baseUrl = `${base}/discover/movie?api_key=${key}&${safe}&with_genres=${genreId}&sort_by=popularity.desc&vote_count.gte=50${countryParam}`;
    }

    fetchPages(baseUrl, searchQuery ? 2 : PAGES)
      .then(items => {
        if (items.length === 0) {
          setError('No results found.');
          setLoading(false);
          return;
        }
        const results = items.map(normalize);
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
  }, [genre, searchQuery, preferredCountry]);

  if (loading) {
    return (
      <section className="mg-section">
        <div className="mg-heading mg-skeleton mg-skeleton-heading" />
        <div className="mg-grid mg-grid-skeleton">
          {Array.from({ length: 20 }).map((_, i) => (
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
            onClick={() => setSelectedMovie(movie)}
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
              <button
                className={`mg-bm-btn${isBookmarked(movie.id) ? ' mg-bm-btn--active' : ''}`}
                onClick={e => {
                  e.stopPropagation();
                  isBookmarked(movie.id) ? removeBookmark(movie.id) : addBookmark(movie.id);
                }}
                title={isBookmarked(movie.id) ? 'Remove bookmark' : 'Bookmark'}
              >
                {isBookmarked(movie.id) ? <IcoBookmarkFill /> : <IcoBookmarkOut />}
              </button>
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

      {/* ── Movie Detail Modal ── */}
      {selectedMovie && (() => {
        const d = movieDetails;
        const posterUrl  = d?.poster_path   ? `${TMDB_W500}${d.poster_path}`   : selectedMovie.PosterHD;
        const backdropUrl= d?.backdrop_path ? `${TMDB_W780}${d.backdrop_path}` : selectedMovie.Backdrop;
        const title      = d?.title         || selectedMovie.Title;
        const year       = d?.release_date?.slice(0, 4) || selectedMovie.Year;
        const rating     = d?.vote_average  ? d.vote_average.toFixed(1)        : selectedMovie.imdbRating;
        const genres     = d?.genres?.map(g => g.name).join(', ')              || selectedMovie.Genre;
        const overview   = d?.overview      || selectedMovie.Overview          || '';
        const runtime    = d?.runtime;
        const tagline    = d?.tagline;

        return (
          <div className="mg-modal-overlay" onClick={() => setSelectedMovie(null)}>
            {backdropUrl && (
              <div className="mg-modal-backdrop" style={{ backgroundImage: `url(${backdropUrl})` }} />
            )}
            <div className="mg-modal-grad" />

            <div className="mg-modal" onClick={e => e.stopPropagation()}>
              <button className="mg-modal-close" onClick={() => setSelectedMovie(null)} title="Close">
                <IcoX />
              </button>

              {/* Poster */}
              <div className="mg-modal-poster-side">
                {posterUrl
                  ? <img src={posterUrl} alt={title} className="mg-modal-poster-img" />
                  : <div className="mg-modal-poster-ph">{title?.[0]}</div>
                }
              </div>

              {/* Content */}
              <div className="mg-modal-content">
                {modalLoading ? (
                  <div className="mg-modal-loading">
                    <span className="mg-modal-spin" />
                  </div>
                ) : (
                  <>
                    <div className="mg-modal-badges">
                      {year && year !== '—' && (
                        <span className="mg-modal-badge mg-modal-badge--year">{year}</span>
                      )}
                      {rating && rating !== '—' && (
                        <span className="mg-modal-badge mg-modal-badge--rating">
                          <IcoStar /> {rating}/10
                        </span>
                      )}
                      {runtime > 0 && (
                        <span className="mg-modal-badge mg-modal-badge--year">
                          {Math.floor(runtime / 60)}h {runtime % 60}m
                        </span>
                      )}
                      {genres && genres !== '—' && genres.split(', ').map(g => (
                        <span key={g} className="mg-modal-badge mg-modal-badge--genre">{g}</span>
                      ))}
                    </div>

                    <h2 className="mg-modal-title">{title}</h2>

                    {tagline && <p className="mg-modal-tagline">"{tagline}"</p>}

                    <p className="mg-modal-overview">
                      {overview || 'No synopsis available for this title.'}
                    </p>

                    <button
                      className={`mg-modal-bm-btn${isBookmarked(selectedMovie.id) ? ' mg-modal-bm-btn--active' : ''}`}
                      onClick={e => {
                        e.stopPropagation();
                        isBookmarked(selectedMovie.id) ? removeBookmark(selectedMovie.id) : addBookmark(selectedMovie.id);
                      }}
                    >
                      {isBookmarked(selectedMovie.id) ? <IcoBookmarkFill /> : <IcoBookmarkOut />}
                      {isBookmarked(selectedMovie.id) ? 'Bookmarked' : 'Bookmark'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}

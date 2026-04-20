import { useEffect, useState, useRef } from 'react';
import './MovieGrid.css';

const MOVIES_BY_GENRE = {
  'Trending Now': [
    'tt4574334','tt4154756','tt5675620','tt2771200','tt6320628','tt6966692',
    'tt4154796','tt4633694','tt0816692','tt1375666','tt5311514','tt6751668',
    'tt7286456','tt1477834','tt4154664','tt0468569','tt2250912','tt3501632',
    'tt3896198','tt0848228',
  ],
  'Action': [
    'tt0468569','tt0848228','tt3498820','tt1825683','tt3501632','tt0372183',
    'tt7126948','tt1392190','tt2015381','tt0137523','tt1345836','tt0110912',
    'tt4154756','tt4154796','tt2250912','tt7286456','tt2395427','tt1843866',
    'tt0369610','tt1431045','tt3896198','tt4154664','tt6320628','tt4633694',
  ],
  'Comedy': [
    'tt0993846','tt4116284','tt0816711','tt0942385','tt5013056','tt1375670',
    'tt6723592','tt7131622','tt1045658','tt2562232','tt1431045','tt1853728',
    'tt0361748','tt1232829','tt0357413','tt1490017','tt2229499','tt4925292',
    'tt0479884','tt0482571',
  ],
  'Horror': [
    'tt1457767','tt5884052','tt1396484','tt7784604','tt0102926','tt0117571',
    'tt5727208','tt0144084','tt7349950','tt1591095','tt2958890','tt3266566',
    'tt0087182','tt0078748','tt8772262','tt2396566','tt4263482','tt0092099',
    'tt0325980','tt0411951',
  ],
  'Romance': [
    'tt3783958','tt0332280','tt2582782','tt1045658','tt4080728','tt0219822',
    'tt0112471','tt3104988','tt1605783','tt0381681','tt5726616','tt0120338',
    'tt2194499','tt7653254','tt2798920','tt2322441','tt0107302','tt2119532',
    'tt1707386','tt3416742',
  ],
  'Sci-Fi': [
    'tt0816692','tt1375666','tt0133093','tt0499549','tt2543164','tt2488496',
    'tt1856101','tt0910970','tt3748528','tt2527336','tt0369610','tt0088247',
    'tt0103064','tt0083658','tt0062622','tt1454468','tt3659388','tt3859448',
    'tt5311514','tt4729430',
  ],
  'Thriller': [
    'tt0114814','tt0110912','tt0209144','tt0477348','tt2267998','tt0264464',
    'tt1807166','tt1130884','tt6751668','tt0137523','tt0114369','tt1375666',
    'tt0407887','tt0364569','tt0110413','tt0116231','tt1568346','tt0119698',
    'tt0443706','tt0482571',
  ],
};

function getPrimaryCountry(country = '') {
  return country.split(',')[0].trim();
}

const LS_PREFIX = 'kmv_';
const LS_TTL    = 7 * 24 * 60 * 60 * 1000; // 7 days

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

export default function MovieGrid({ genre = 'Trending Now', searchQuery = '' }) {
  const [movies, setMovies]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [visible, setVisible] = useState(false);
  const cache = useRef({});

  useEffect(() => {
    const key = import.meta.env.VITE_OMDB_KEY;
    if (!key) {
      setError('Add VITE_OMDB_KEY to your .env and restart the dev server.');
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

    if (searchQuery) {
      fetch(`https://www.omdbapi.com/?s=${encodeURIComponent(searchQuery)}&apikey=${key}`)
        .then(r => r.json())
        .then(data => {
          if (data.Response === 'False') {
            setError(data.Error === 'Movie not found!' ? 'No results found.' : `OMDB: ${data.Error}`);
            setMovies([]);
            setLoading(false);
            return;
          }
          return Promise.all(
            data.Search.map(item =>
              fetch(`https://www.omdbapi.com/?i=${item.imdbID}&apikey=${key}`)
                .then(r => r.json())
            )
          ).then(results => {
            const valid = results.filter(m => m.Response === 'True');
            cache.current[cacheKey] = valid;
            lsSet(cacheKey, valid);
            setMovies(valid);
            setLoading(false);
            setTimeout(() => setVisible(true), 30);
          });
        })
        .catch(() => {
          setError('Network error — check your connection.');
          setLoading(false);
        });
      return;
    }

    const ids = MOVIES_BY_GENRE[genre] ?? MOVIES_BY_GENRE['Trending Now'];

    fetch(`https://www.omdbapi.com/?i=${ids[0]}&apikey=${key}`)
      .then(r => r.json())
      .then(probe => {
        if (probe.Response === 'False') {
          setError(`OMDB: ${probe.Error}`);
          setLoading(false);
          return;
        }
        return Promise.all(
          ids.map(id =>
            fetch(`https://www.omdbapi.com/?i=${id}&apikey=${key}`)
              .then(r => r.json())
          )
        ).then(results => {
          const valid = results.filter(m => m.Response === 'True');
          cache.current[cacheKey] = valid;
          lsSet(cacheKey, valid);
          setMovies(valid);
          setLoading(false);
          setTimeout(() => setVisible(true), 30);
        });
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
        {movies.map((movie, i) => {
          const isTV   = movie.Type === 'series';
          const poster = movie.Poster !== 'N/A' ? movie.Poster : null;

          return (
            <div
              key={movie.imdbID}
              className="mg-card"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <div className="mg-poster">
                {poster
                  ? <img
                      src={poster}
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
                  style={{ display: poster ? 'none' : 'flex' }}
                >
                  <span className="mg-no-image">No Image</span>
                </div>
                {isTV && <span className="mg-type-badge">TV Series</span>}
              </div>
              <div className="mg-info">
                <p className="mg-meta">
                  {getPrimaryCountry(movie.Country)},&nbsp;
                  <span className="mg-year">{movie.Year}</span>
                </p>
                <h3 className="mg-title">{movie.Title}</h3>
                <div className="mg-ratings">
                  <span className="mg-imdb-badge">
                    <span className="mg-imdb-label">IMDb</span>
                    <span className="mg-imdb-score">{movie.imdbRating}/10</span>
                  </span>
                </div>
                <p className="mg-genre">{movie.Genre}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

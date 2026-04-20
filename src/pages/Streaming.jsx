import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../../images/keromovielogo.png';
import './streaming.css';

const TMDB_IMG = 'https://image.tmdb.org/t/p/original';

const PROVIDER_URLS = {
  8:   'https://www.netflix.com',
  9:   'https://www.primevideo.com',
  337: 'https://www.disneyplus.com',
  384: 'https://www.max.com',
  350: 'https://tv.apple.com',
  531: 'https://www.paramountplus.com',
  386: 'https://www.peacocktv.com',
  15:  'https://www.hulu.com',
  283: 'https://www.crunchyroll.com',
  190: 'https://www.youtube.com/premium',
  188: 'https://www.youtube.com',
  192: 'https://www.youtube.com',
  2:   'https://www.apple.com/apple-tv-plus',
  3:   'https://play.google.com/store/movies',
  7:   'https://www.vudu.com',
  10:  'https://www.amazon.com/video',
  68:  'https://www.microsoft.com/movies-tv',
  100: 'https://www.gwallet.com',
  257: 'https://www.fubo.tv',
  358: 'https://www.shudder.com',
  367: 'https://www.spectrumtv.com',
  372: 'https://www.mubi.com',
  389: 'https://www.tubitv.com',
  444: 'https://www.plex.tv',
  510: 'https://www.discovery.com',
};

export default function Streaming() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [menuOpen, setMenuOpen]   = useState(false);

  useEffect(() => {
    const key = import.meta.env.VITE_TMDB_KEY;
    if (!key) { setLoading(false); return; }

    fetch(`https://api.themoviedb.org/3/watch/providers/movie?api_key=${key}&language=en-US&watch_region=US`)
      .then(r => r.json())
      .then(data => {
        const list = (data.results ?? [])
          .filter(p => p.logo_path && p.display_priority < 60)
          .sort((a, b) => a.display_priority - b.display_priority);
        setProviders(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener('scroll', close, { passive: true });
    return () => window.removeEventListener('scroll', close);
  }, [menuOpen]);

  return (
    <div className="sp-page">
      {/* Navbar */}
      <nav className="h-nav">
        <button className="h-logo h-logo-desktop" onClick={() => setMenuOpen(p => !p)} aria-label="Menu">
          <img src={logo} alt="KeroMovie" className="h-logo-img" />
          <span className="h-logo-text">
            {'Kero'.split('').map((ch, i) => (
              <span key={i} className={`h-logo-kero h-logo-l h-logo-l-${i}`}>{ch}</span>
            ))}
            {'Movie'.split('').map((ch, i) => (
              <span key={i + 4} className={`h-logo-movie h-logo-l h-logo-l-${i + 4}`}>{ch}</span>
            ))}
          </span>
        </button>
        <button className="h-logo h-logo-mobile" onClick={() => setMenuOpen(p => !p)} aria-label="Menu">
          <img src={logo} alt="KeroMovie" className="h-logo-img" />
        </button>
        <ul className="h-center-links">
          <li className="h-nav-item"><Link to="/">Home</Link></li>
          <li className="h-nav-item"><Link to="/explore">Explore</Link></li>
          <li className="h-nav-item"><Link to="/browse">Dashboard</Link></li>
          <li className="h-nav-item"><Link to="/forums">Forum</Link></li>
        </ul>
        <div className="h-search" style={{ pointerEvents: 'none', opacity: 0 }} />
      </nav>

      {/* Mobile dropdown */}
      <div className={`mobile-nav-dropdown${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)}>
        <li className="h-nav-item"><Link to="/">Home</Link></li>
        <li className="h-nav-item"><Link to="/explore">Explore</Link></li>
        <li className="h-nav-item"><Link to="/browse">Dashboard</Link></li>
        <li className="h-nav-item"><Link to="/forums">Forum</Link></li>
      </div>
      {menuOpen && <div className="mobile-nav-backdrop" onClick={() => setMenuOpen(false)} />}

      {/* Content */}
      <main className="sp-main">
        <div className="sp-header">
          <h1 className="sp-title">Movie Streaming Platforms</h1>
          <p className="sp-subtitle">discover where to watch your next favourite film</p>
        </div>

        {loading ? (
          <div className="sp-grid">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="sp-card sp-card-skeleton">
                <div className="sp-logo-wrap sp-skeleton" />
                <div className="sp-name sp-skeleton sp-skeleton-text" />
              </div>
            ))}
          </div>
        ) : (
          <div className="sp-grid">
            {providers.map(p => {
              const url = PROVIDER_URLS[p.provider_id];
              const inner = (
                <>
                  <div className="sp-logo-wrap">
                    <img
                      src={`${TMDB_IMG}${p.logo_path}`}
                      alt={p.provider_name}
                      className="sp-logo"
                    />
                  </div>
                  <p className="sp-name">{p.provider_name}</p>
                  <span className="sp-visit">Visit →</span>
                </>
              );

              return url ? (
                <a key={p.provider_id} href={url} target="_blank" rel="noopener noreferrer" className="sp-card">
                  {inner}
                </a>
              ) : (
                <div key={p.provider_id} className="sp-card">
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

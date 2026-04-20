import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../../images/keromovielogo.png';
import bgGif from '../../images/discoverbackground.gif';
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

const FILTERS = [
  'All',
  'Most Used Platform',
  'Least Used Platform',
  'Available on Android',
  'Available on iOS',
  'Available on Laptop / Desktop',
];

const ANDROID_IDS  = new Set([8, 9, 337, 384, 350, 531, 386, 15, 283, 190, 188, 192, 3, 7, 10, 257, 358, 367, 372, 389, 444, 510]);
const IOS_IDS      = new Set([8, 9, 337, 384, 350, 531, 386, 15, 283, 190, 188, 192, 2, 7, 10, 257, 358, 367, 372, 389, 444, 510]);
const DESKTOP_IDS  = new Set([8, 9, 337, 384, 350, 531, 386, 15, 283, 190, 188, 192, 2, 3, 7, 10, 68, 257, 358, 367, 372, 389, 444, 510]);
const MOST_USED_PRIORITY  = 18;

function applyFilter(providers, filter) {
  switch (filter) {
    case 'Most Used Platform':
      return providers.filter(p => p.display_priority <= MOST_USED_PRIORITY);
    case 'Least Used Platform':
      return providers.filter(p => p.display_priority > MOST_USED_PRIORITY);
    case 'Available on Android':
      return providers.filter(p => ANDROID_IDS.has(p.provider_id));
    case 'Available on iOS':
      return providers.filter(p => IOS_IDS.has(p.provider_id));
    case 'Available on Laptop / Desktop':
      return providers.filter(p => DESKTOP_IDS.has(p.provider_id));
    default:
      return providers;
  }
}

export default function Streaming() {
  const [providers, setProviders]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [activeFilter, setActiveFilter] = useState('All');

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

  const filtered = applyFilter(providers, activeFilter);

  return (
    <>
    <div className="sp-bg-gif">
      <img src={bgGif} alt="" className="sp-bg-gif-img" />
      <div className="sp-bg-gif-overlay" />
    </div>
    <div className="sp-page">
      {/* Navbar */}
      <nav className="h-nav">
        <Link to="/" className="h-logo h-logo-desktop" aria-label="Home">
          <img src={logo} alt="KeroMovie" className="h-logo-img" />
          <span className="h-logo-text">
            {'Kero'.split('').map((ch, i) => (
              <span key={i} className={`h-logo-kero h-logo-l h-logo-l-${i}`}>{ch}</span>
            ))}
            {'Movie'.split('').map((ch, i) => (
              <span key={i + 4} className={`h-logo-movie h-logo-l h-logo-l-${i + 4}`}>{ch}</span>
            ))}
          </span>
        </Link>
        <Link to="/" className="h-logo h-logo-mobile" aria-label="Home">
          <img src={logo} alt="KeroMovie" className="h-logo-img" />
        </Link>
        <ul className="h-center-links">
          <li className="h-nav-item"><Link to="/">Home</Link></li>
          <li className="h-nav-item"><Link to="/explore">Explore</Link></li>
          <li className="h-nav-item"><Link to="/browse">Dashboard</Link></li>
          <li className="h-nav-item"><Link to="/forums">Forum</Link></li>
        </ul>
        <div className="h-search" style={{ pointerEvents: 'none', opacity: 0 }} />
      </nav>

      {/* Mobile filter pills */}
      <div className="sp-filter-strip">
        {FILTERS.map(f => (
          <button
            key={f}
            className={`sp-filter-pill${activeFilter === f ? ' active' : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="sp-main">
        <div className="sp-content">
          <div className="sp-header">
            <h1 className="sp-title">Movie Streaming Platforms</h1>
            <p className="sp-subtitle">discover where to watch your next favourite film</p>
          </div>

          <div className="sp-grid">
            {filtered.map((p, i) => {
              const url = PROVIDER_URLS[p.provider_id];
              const words = p.provider_name.split(' ');
              const lines = [];
              for (let j = 0; j < words.length; j += 2) lines.push(words.slice(j, j + 2).join(' '));
              const style = { animationDelay: `${i * 0.06}s` };
              const inner = (
                <span className="sp-platform-name">{lines.join('\n')}</span>
              );

              return url ? (
                <a key={p.provider_id} href={url} target="_blank" rel="noopener noreferrer" className="sp-card" style={style}>
                  {inner}
                </a>
              ) : (
                <div key={p.provider_id} className="sp-card" style={style}>
                  {inner}
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop filter sidebar */}
        <aside className="sp-filter-sidebar">
          <p className="sp-filter-label">Filter</p>
          <ul className="sp-filter-list">
            {FILTERS.map(f => (
              <li key={f}>
                <button
                  className={`sp-filter-option${activeFilter === f ? ' active' : ''}`}
                  onClick={() => setActiveFilter(f)}
                >
                  {f}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </main>
    </div>
    </>
  );
}

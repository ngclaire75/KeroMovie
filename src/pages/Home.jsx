import { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../../images/keromovielogo.png';
import loginIcon from '../../images/login.png';
import bgGif from '../../images/background.gif';
import './home.css';

const LS_PREFIX = 'hp_anime_';

function lsGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > 7 * 24 * 60 * 60 * 1000) { localStorage.removeItem(key); return null; }
    return data;
  } catch { return null; }
}
function lsSet(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

export default function Home() {
  const navigate               = useNavigate();
  const canvasRef              = useRef(null);
  const intervalRef            = useRef(null);
  const [animes, setAnimes]    = useState([]);
  const [index, setIndex]      = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [fadeKey, setFadeKey]  = useState(0);
  const [bookmarkOpen, setBookmarkOpen] = useState(false);

  // Load anime movies from Jikan (MyAnimeList) — no API key needed
  useEffect(() => {
    const cached = lsGet(LS_PREFIX + 'jikan');
    if (cached && cached.length > 0) { setAnimes(cached); return; }

    (async () => {
      try {
        const r = await fetch('https://api.jikan.moe/v4/top/anime?type=movie&filter=bypopularity&limit=20');
        const json = await r.json();
        const results = (json.data || [])
          .filter(a => a.images?.jpg?.large_image_url)
          .map(a => ({
            Title:      a.title_english || a.title,
            Year:       a.aired?.prop?.from?.year ?? '—',
            imdbRating: a.score ? String(a.score) : '—',
            Runtime:    a.duration || '—',
            Genre:      a.genres?.[0]?.name ?? '—',
            Poster:     a.images.jpg.large_image_url,
          }));
        if (results.length > 0) {
          lsSet(LS_PREFIX + 'jikan', results);
          setAnimes(results);
        }
      } catch {}
    })();
  }, []);

  // Cycle only when playing
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!isPlaying || animes.length === 0) return;
    intervalRef.current = setInterval(() => {
      setIndex(i => (i + 1) % animes.length);
      setFadeKey(k => k + 1);
    }, 6000);
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, animes.length]);

  const togglePlay = useCallback(() => setIsPlaying(p => !p), []);

  // Canvas particles
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const pts = Array.from({ length: 70 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.0 + 0.3,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      o: Math.random() * 0.25 + 0.05,
    }));
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pts) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${p.o})`; ctx.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = canvas.width; else if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height; else if (p.y > canvas.height) p.y = 0;
      }
      animId = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  const featured  = animes[index] ?? null;
  const related   = animes[(index + 1) % Math.max(animes.length, 1)] ?? null;
  const poster    = featured?.Poster !== 'N/A' ? featured?.Poster : null;
  const relPoster = related?.Poster  !== 'N/A' ? related?.Poster  : null;

  return (
    <>
    <div className="hp-bg-gif">
      <img src={bgGif} alt="" className="hp-bg-gif-img" />
      <div className="hp-bg-gif-overlay" />
    </div>
    <div className="hp-page">
      {/* Transparent navbar */}
      <nav className="hp-nav">
        <ul className="hp-nav-links">
          <li><Link to="/explore" className="hp-nav-link">Explore</Link></li>
          <li><Link to="/browse" className="hp-nav-link">Dashboard</Link></li>
          <li><Link to="/forums" className="hp-nav-link">Forum</Link></li>
        </ul>
        <button className="hp-nav-cta" onClick={() => navigate('/streaming')}>
          Discover Movie Streaming Platforms
        </button>
        <Link to="/login"><img src={loginIcon} alt="Login" className="hp-login-icon" /></Link>
      </nav>
      <Link to="/login"><img src={loginIcon} alt="Login" className="hp-login-icon-mobile" /></Link>

      <canvas ref={canvasRef} className="hp-canvas" />

      {/* Backdrop is always the gif — no dynamic poster */}

      {/* Left halftone overlay */}
      <div className="hp-dots-overlay" />

      {/* Left-to-right dark fade */}
      <div className="hp-fade-overlay" />

      {/* ── Layout ── */}
      <div className="hp-layout">

        {/* ══ LEFT: Cards ══ */}
        <aside className="hp-left">

          {/* Main two-tone card */}
          <div className="hp-main-card">

            {/* Upper white section */}
            <div className="hp-upper">
              <div className="hp-upper-row">
                <button className="hp-phone-badge" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
                  {isPlaying ? (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
                      <rect x="5" y="3" width="4" height="18" rx="1" />
                      <rect x="15" y="3" width="4" height="18" rx="1" />
                    </svg>
                  ) : (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="white">
                      <polygon points="6,3 20,12 6,21" />
                    </svg>
                  )}
                </button>
                <div className="hp-portrait-wrap">
                  {poster
                    ? <img key={fadeKey} src={poster} alt="" className="hp-portrait hp-portrait-fade" />
                    : <div className="hp-portrait-ph" />
                  }
                  <span className="hp-score-badge">
                    {featured?.imdbRating ?? '—'}
                  </span>
                </div>
              </div>
              <p className="hp-upper-sub">featured pick by KeroMovie</p>
              <p className="hp-upper-title">
                {featured?.Title ?? '···'}
              </p>
            </div>

            {/* Lower dark section */}
            <div className="hp-lower">
              <div className="hp-lower-row">
                <span>rating</span>
                <span>{featured?.imdbRating ?? '—'} / 10</span>
              </div>
              <div className="hp-lower-row">
                <span>release date</span>
                <span>{featured?.Year ?? '—'}</span>
              </div>
              <div className="hp-lower-row">
                <span>genre</span>
                <span>{featured?.Genre ?? '—'}</span>
              </div>
              <div className="hp-lower-sep" />
              <div className="hp-schedule-row">
                <div className="hp-schedule-label">
                  <span>movies on schedule</span>
                  <span>for a week</span>
                </div>
                <div className="hp-bars">
                  <div className="hp-bar" style={{ width: '62%' }} />
                  <div className="hp-bar" style={{ width: '82%' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Small related card */}
          <div className={`hp-sm-card${bookmarkOpen ? ' hp-sm-card-open' : ''}`}>
            {relPoster
              ? <img key={fadeKey} src={relPoster} alt="" className="hp-sm-poster" />
              : <div className="hp-sm-poster-ph" />
            }
            <div className="hp-sm-info">
              <p className="hp-sm-title">{related?.Title ?? '···'}</p>
              <p className="hp-sm-genre">{related?.Genre ?? '—'}</p>
              <p className="hp-sm-bookmark-text">Add Your Favorite Movies to the Bookmark!</p>
            </div>
            <div className="hp-sm-plus-wrap">
              <Link to="/explore" className="hp-sm-plus" onClick={() => setBookmarkOpen(o => !o)}>
                <span className="hp-sm-plus-icon">+</span>
                <span className="hp-sm-plus-text">Add Your Favorite Movies to the Bookmark!</span>
              </Link>
            </div>
          </div>

          {/* CTA */}
          <Link to="/explore" className="hp-cta-btn"><span>Explore Movies</span></Link>
        </aside>

        {/* ══ RIGHT: Hero text ══ */}
        <section className="hp-right">
          <div className="hp-right-top">
            <h1 className="hp-headline">
              discover your next<br />favourite film
            </h1>
            <p className="hp-subline">
              don't give up exploring — because of tiredness<br />
              keep watching, keep discovering
            </p>
            <div className="hp-meta-row">
              <div className="hp-avatar">
                <img src={logo} alt="KeroMovie" />
              </div>
              <div className="hp-red-pill" />
            </div>
          </div>

          <div className="hp-right-bottom">
            <p className="hp-body-text">
              a great film with every search no matter how tired you are,<br />
              we have to find the perfect movie even if we scroll a while,<br />
              there are great stories waiting for you
            </p>
            <p className="hp-domain">keromovie designed by claire.</p>
          </div>
        </section>

      </div>
    </div>
</>
  );
}

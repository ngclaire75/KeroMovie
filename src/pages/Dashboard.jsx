import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { auth } from '../lib/firebase';
import { getProfile } from '../lib/authHelpers';
import logo from '../../images/keromovielogo.png';
import './dashboard.css';

const TMDB_KEY  = import.meta.env.VITE_TMDB_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_W500  = 'https://image.tmdb.org/t/p/w500';
const IMG_OG    = 'https://image.tmdb.org/t/p/original';

const GENRE_MAP = {
  28:'Action', 12:'Adventure', 16:'Animation', 35:'Comedy', 80:'Crime',
  18:'Drama', 14:'Fantasy', 27:'Horror', 10749:'Romance', 878:'Sci-Fi',
  53:'Thriller', 10402:'Music', 99:'Documentary',
};

const COMMUNITY = [
  { i:'MK', c:'#e67e22', watching: true },
  { i:'SJ', c:'#9b59b6' },
  { i:'AL', c:'#3498db', online: true },
  { i:'RP', c:'#2ecc71', online: true },
  { i:'TN', c:'#e91e63' },
  { i:'DK', c:'#f39c12', online: true },
  { i:'LC', c:'#1abc9c' },
];

const STAT_GENRES = [
  { label:'Action', color:'#e74c3c', bg:'rgba(231,76,60,0.18)', icon:'🎬' },
  { label:'Drama',  color:'#f5c518', bg:'rgba(245,197,24,0.18)', icon:'🎭' },
  { label:'Sci-Fi', color:'#a855f7', bg:'rgba(168,85,247,0.18)', icon:'🚀' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function genreLabel(ids = []) {
  return ids.slice(0, 1).map(id => GENRE_MAP[id] || 'Movie').join('') || 'Movie';
}

function fmtVotes(n) {
  if (!n) return '0';
  return n >= 1000 ? `+${(n / 1000).toFixed(1)}k` : `+${n}`;
}

// ── Three.js Donut Chart ────────────────────────────────────
function DonutChart({ totalLabel, totalValue }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const w = mount.clientWidth || 220;
    const h = mount.clientHeight || 220;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    camera.position.z = 6.5;

    const geo = new THREE.TorusGeometry(1.55, 0.42, 40, 140);
    const mat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vPos;
        void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
      `,
      fragmentShader: `
        varying vec3 vPos;
        void main() {
          float a = atan(vPos.y, vPos.x);
          float t = (a + 3.14159265) / (6.28318530);
          vec3 c1 = vec3(0.91, 0.24, 0.16);
          vec3 c2 = vec3(0.60, 0.10, 0.72);
          vec3 c3 = vec3(0.12, 0.32, 0.88);
          vec3 col = t < 0.5 ? mix(c1, c2, t * 2.0) : mix(c2, c3, (t - 0.5) * 2.0);
          float glow = 1.0 - abs(vPos.z) * 0.6;
          gl_FragColor = vec4(col * glow, 1.0);
        }
      `,
    });

    const torus = new THREE.Mesh(geo, mat);
    torus.rotation.x = 0.38;
    scene.add(torus);

    let raf;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      torus.rotation.z += 0.004;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      renderer.dispose();
      geo.dispose();
      mat.dispose();
    };
  }, []);

  return (
    <div className="db-donut-wrap">
      <div ref={mountRef} className="db-donut-canvas" />
      <div className="db-donut-overlay">
        <span className="db-donut-sub">{totalLabel}</span>
        <span className="db-donut-val">{totalValue}</span>
      </div>
    </div>
  );
}

// ── SVG Icons ───────────────────────────────────────────────
const IcoFilm     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5"/></svg>;
const IcoExplore  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>;
const IcoDash     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
const IcoForum    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IcoStream   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
const IcoBookmark = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>;
const IcoSearch   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>;
const IcoPlay     = () => <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
const IcoBell     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IcoBookmark2= () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>;
const IcoStar     = () => <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const IcoThumb    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>;
const IcoArrow    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>;
const IcoX        = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoPlus     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcoLogout   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IcoFire     = () => <svg viewBox="0 0 24 24" fill="currentColor" style={{color:'#e74c3c'}}><path d="M12 2c0 0-5 4.5-5 9a5 5 0 0 0 10 0c0-2.5-1.5-5-1.5-5s-1 2-2.5 2S11 6 12 2z"/></svg>;

// ── Main Dashboard ──────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile]     = useState(null);
  const [featured, setFeatured]   = useState(null);
  const [releases, setReleases]   = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [recent, setRecent]       = useState(null);
  const [statMovies, setStatMovies] = useState([]);
  const [search, setSearch]       = useState('');
  const [releaseIdx, setReleaseIdx] = useState(0);

  // Time-based greeting
  const greeting = getGreeting();
  const today    = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });

  // Auth + profile
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async user => {
      if (!user) return;
      const p = await getProfile(user.uid);
      setProfile(p || {
        firstName: user.displayName?.split(' ')[0] || 'User',
        username:  user.email?.split('@')[0] || 'user',
      });
    });
    return unsub;
  }, []);

  // TMDB trending
  useEffect(() => {
    fetch(`${TMDB_BASE}/trending/movie/day?api_key=${TMDB_KEY}`)
      .then(r => r.json())
      .then(d => {
        const res = d.results || [];
        setFeatured(res[0] || null);
        setReleases(res.slice(1, 4));
        setWatchlist(res.slice(4, 7));
        setRecent(res[7] || null);
        setStatMovies(res.slice(8, 11));
      })
      .catch(() => {});
  }, []);

  const displayName = profile?.firstName || 'User';
  const username    = profile?.username  || 'user';

  // Stat hours derived from vote counts of statMovies
  const statHours = statMovies.map((m, i) => {
    const base = [2340, 5420, 4580];
    return m ? `${(m.vote_count % 1000 + base[i]).toLocaleString()}h` : `${base[i]}h`;
  });
  const totalHours = statMovies.length
    ? `${statMovies.reduce((acc, m) => acc + (m?.vote_count || 0), 12340).toLocaleString()}h`
    : '12,340h';

  function handleLogout() {
    auth.signOut().then(() => navigate('/login'));
  }

  const visibleRelease = releases[releaseIdx] || releases[0];
  const nextRelease    = releases[(releaseIdx + 1) % releases.length] || releases[1];

  return (
    <div className="db-root">

      {/* ── Left Sidebar ── */}
      <aside className="db-sidebar-left">
        <div className="db-sl-logo">
          <img src={logo} alt="KM" className="db-sl-logo-img" />
        </div>
        <nav className="db-sl-nav">
          <Link to="/"          className="db-sl-icon"            title="Home"><IcoFilm /></Link>
          <Link to="/explore"   className="db-sl-icon"            title="Explore"><IcoExplore /></Link>
          <Link to="/browse"    className="db-sl-icon db-sl-icon--active" title="Dashboard"><IcoDash /></Link>
          <Link to="/forums"    className="db-sl-icon"            title="Forum"><IcoForum /></Link>
          <Link to="/streaming" className="db-sl-icon"            title="Streaming"><IcoStream /></Link>
          <Link to="/explore"   className="db-sl-icon"            title="Watchlist"><IcoBookmark /></Link>
        </nav>
        <div className="db-sl-bottom">
          <button className="db-sl-icon" onClick={handleLogout} title="Logout"><IcoLogout /></button>
          <button className="db-sl-plus" title="Add"><IcoPlus /></button>
        </div>
      </aside>

      {/* ── Center + Right ── */}
      <div className="db-center">

        {/* ── Top bar ── */}
        <header className="db-topbar">
          <div className="db-topbar-greeting">
            {greeting}, <strong>{displayName}</strong>
          </div>
          <div className="db-topbar-search">
            <IcoSearch />
            <input
              placeholder="Search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="db-search-input"
            />
          </div>
          <div className="db-topbar-actions">
            <button className="db-topbar-icon-btn" title="Watchlist">
              <IcoBookmark2 />
            </button>
            <button className="db-topbar-icon-btn db-topbar-icon-btn--bell" title="Notifications">
              <IcoBell />
              <span className="db-bell-dot" />
            </button>
          </div>
        </header>

        {/* ── Main body ── */}
        <div className="db-body">

          {/* ── Left content ── */}
          <div className="db-main-left">

            {/* Hero card */}
            {featured && (
              <div
                className="db-hero"
                style={{ backgroundImage: `url(${IMG_OG}${featured.backdrop_path})` }}
              >
                <div className="db-hero-grad" />
                <div className="db-hero-content">
                  <div className="db-hero-badges">
                    <span className="db-hero-popular"><IcoFire /> Popular</span>
                    <span className="db-hero-score-badge">
                      <IcoStar /> {featured.vote_average?.toFixed(1)}
                    </span>
                    <span className="db-hero-tmdb-badge">TMDB</span>
                  </div>
                  <h2 className="db-hero-title">{featured.title}</h2>
                  <p className="db-hero-desc">{featured.overview?.slice(0, 130)}…</p>
                  <div className="db-hero-bottom">
                    <div className="db-hero-avatars">
                      {COMMUNITY.slice(0, 3).map((u, i) => (
                        <div key={i} className="db-hero-av" style={{ background: u.c, zIndex: 3 - i }}>{u.i}</div>
                      ))}
                      <span className="db-hero-reviews">
                        <IcoThumb /> {fmtVotes(featured.vote_count)} Reviews
                      </span>
                    </div>
                  </div>
                </div>
                <div className="db-hero-artwork">
                  {featured.poster_path && (
                    <img src={`${IMG_W500}${featured.poster_path}`} alt={featured.title} className="db-hero-poster" />
                  )}
                </div>
              </div>
            )}

            {/* New Releases */}
            <div className="db-section-row">
              <span className="db-section-title">New Releases</span>
              <Link to="/explore" className="db-section-more">See More</Link>
            </div>
            <div className="db-releases">
              {/* Large card */}
              {releases[0] && (
                <div
                  className="db-rel-card db-rel-card--large"
                  style={{ backgroundImage: `url(${IMG_W500}${releases[0].backdrop_path || releases[0].poster_path})` }}
                >
                  <div className="db-rel-overlay" />
                  <button className="db-rel-play"><IcoPlay /></button>
                  <button className="db-rel-bookmark"><IcoBookmark2 /></button>
                  <div className="db-rel-info">
                    <p className="db-rel-title">{releases[0].title}</p>
                    <p className="db-rel-desc">{releases[0].overview?.slice(0, 80)}…</p>
                  </div>
                </div>
              )}
              {/* Medium card */}
              {releases[1] && (
                <div
                  className="db-rel-card db-rel-card--mid"
                  style={{ backgroundImage: `url(${IMG_W500}${releases[1].poster_path})` }}
                >
                  <div className="db-rel-overlay" />
                  <div className="db-rel-info">
                    <p className="db-rel-title">{releases[1].title}</p>
                  </div>
                </div>
              )}
              {/* Arrow */}
              <button className="db-rel-arrow" onClick={() => setReleaseIdx(i => (i + 1) % Math.max(releases.length - 1, 1))}>
                <IcoArrow />
              </button>
              {/* Peek card */}
              {releases[2] && (
                <div
                  className="db-rel-card db-rel-card--peek"
                  style={{ backgroundImage: `url(${IMG_W500}${releases[2].poster_path})` }}
                >
                  <div className="db-rel-overlay" />
                  <div className="db-rel-info">
                    <p className="db-rel-title">{releases[2].title}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Continue Watching */}
            <div className="db-section-row">
              <span className="db-section-title">Continue Watching</span>
              <Link to="/explore" className="db-section-more">See More</Link>
            </div>
            {recent && (
              <div className="db-continue">
                <div className="db-continue-left">
                  {recent.poster_path
                    ? <img src={`${IMG_W500}${recent.poster_path}`} alt={recent.title} className="db-continue-poster" />
                    : <div className="db-continue-poster db-continue-poster--ph">{recent.title?.[0]}</div>
                  }
                  <div>
                    <p className="db-continue-title">{recent.title}</p>
                    <span className="db-continue-tag">{genreLabel(recent.genre_ids)}</span>
                  </div>
                </div>
                <div className="db-continue-right">
                  <div>
                    <p className="db-continue-time">1 hr 54 min.</p>
                    <p className="db-continue-size">{Math.round((recent.vote_average || 7) * 140)} MB remaining</p>
                  </div>
                  <button className="db-continue-play"><IcoPlay /></button>
                  <button className="db-continue-x"><IcoX /></button>
                </div>
              </div>
            )}
          </div>

          {/* ── Right panel ── */}
          <aside className="db-main-right">

            {/* Watchlist items */}
            {watchlist.map(m => (
              <Link to="/explore" key={m.id} className="db-wl-item">
                {m.poster_path
                  ? <img src={`${IMG_W500}${m.poster_path}`} alt={m.title} className="db-wl-thumb" />
                  : <div className="db-wl-thumb db-wl-thumb--ph" />
                }
                <div className="db-wl-info">
                  <p className="db-wl-title">{m.title}</p>
                  {m.release_date && <p className="db-wl-sub">{m.release_date?.slice(0,4)} · {genreLabel(m.genre_ids)}</p>}
                </div>
                <span className="db-wl-arrow"><IcoArrow /></span>
              </Link>
            ))}

            {/* Stats */}
            <div className="db-stats-header">
              <span className="db-section-title">Your Statistic</span>
              <span className="db-stats-arrow"><IcoArrow /></span>
            </div>

            <DonutChart totalLabel="Total hours" totalValue={totalHours} />

            <div className="db-stat-icons">
              {STAT_GENRES.map((g, i) => (
                <div key={g.label} className="db-stat-item">
                  <div className="db-stat-circle" style={{ background: g.bg, border: `1.5px solid ${g.color}` }}>
                    <span className="db-stat-emoji">{g.icon}</span>
                  </div>
                  <span className="db-stat-hours">{statHours[i] || `${[2340,5420,4580][i]}h`}</span>
                </div>
              ))}
            </div>

          </aside>
        </div>
      </div>

      {/* ── Right Avatar Sidebar ── */}
      <aside className="db-sidebar-right">
        <div className="db-sr-avatar db-sr-avatar--main" style={{ background: 'linear-gradient(135deg,#e74c3c,#8b0000)' }}>
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="db-sr-divider" />
        {COMMUNITY.map((u, i) => (
          <div key={i} className="db-sr-av-wrap">
            <div className="db-sr-avatar" style={{ background: u.c }}>{u.i}</div>
            {u.online   && <span className="db-sr-dot db-sr-dot--green" />}
            {u.watching && <span className="db-sr-badge">Watching</span>}
          </div>
        ))}
      </aside>

    </div>
  );
}

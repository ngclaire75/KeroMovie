import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { getProfile } from '../lib/authHelpers';
import { useApp } from '../context/AppContext';
import logo from '../../images/keromovielogo.png';
import './dashboard.css';

const TMDB_KEY  = import.meta.env.VITE_TMDB_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_W500  = 'https://image.tmdb.org/t/p/w500';
const IMG_OG    = 'https://image.tmdb.org/t/p/original';
const IMG_W200  = 'https://image.tmdb.org/t/p/w185';

const AWS_KEY    = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
const AWS_SECRET = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;
const AWS_REGION = import.meta.env.VITE_AWS_REGION || 'us-east-1';

const GENRE_MAP = {
  28:'Action', 12:'Adventure', 16:'Animation', 35:'Comedy', 80:'Crime',
  18:'Drama', 14:'Fantasy', 27:'Horror', 10749:'Romance', 878:'Sci-Fi',
  53:'Thriller', 10402:'Music', 99:'Documentary',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function genreLabel(ids = []) {
  return (ids || []).slice(0, 2).map(id => GENRE_MAP[id]).filter(Boolean).join(', ') || 'Movie';
}

function fmtTime(s) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

// ── AWS Rekognition (SigV4 signed, routed via Vite proxy) ──────────────
async function sha256hex(msg) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacBytes(keyBytes, msg) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)));
}

async function rekognizeCelebrities(jpegBytes) {
  if (!AWS_KEY || !AWS_SECRET) throw new Error('AWS credentials not set in .env (VITE_AWS_ACCESS_KEY_ID / VITE_AWS_SECRET_ACCESS_KEY)');

  const service  = 'rekognition';
  const target   = 'RekognitionService.RecognizeCelebrities';
  const now      = new Date();
  const amzdate  = now.toISOString().replace(/[:\-.]/g, '').slice(0, 15) + 'Z';
  const datestamp = amzdate.slice(0, 8);

  // Rekognition expects base64 string, not raw bytes
  const base64 = btoa(String.fromCharCode(...jpegBytes));
  const body   = JSON.stringify({ Image: { Bytes: base64 } });
  const bodyHash = await sha256hex(body);

  const canonHeaders = `content-type:application/x-amz-json-1.1\nx-amz-date:${amzdate}\nx-amz-target:${target}\n`;
  const signedHdrs   = 'content-type;x-amz-date;x-amz-target';
  const credScope    = `${datestamp}/${AWS_REGION}/${service}/aws4_request`;
  const canonReq     = ['POST', '/', '', canonHeaders, signedHdrs, bodyHash].join('\n');
  const strToSign    = ['AWS4-HMAC-SHA256', amzdate, credScope, await sha256hex(canonReq)].join('\n');

  let k = await hmacBytes(new TextEncoder().encode('AWS4' + AWS_SECRET), datestamp);
  k = await hmacBytes(k, AWS_REGION);
  k = await hmacBytes(k, service);
  k = await hmacBytes(k, 'aws4_request');
  const sigBytes = await hmacBytes(k, strToSign);
  const sig = Array.from(sigBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  const authorization = `AWS4-HMAC-SHA256 Credential=${AWS_KEY}/${credScope}, SignedHeaders=${signedHdrs}, Signature=${sig}`;

  const res = await fetch('/api/rekognition/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Date': amzdate,
      'X-Amz-Target': target,
      'Authorization': authorization,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Rekognition error ${res.status}: ${err}`);
  }
  return res.json();
}

// ── SVG Icons ──────────────────────────────────────────────────────────
const IcoFilm    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5"/></svg>;
const IcoExplore = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>;
const IcoDash    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
const IcoForum   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IcoStream  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
const IcoLogout  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IcoBookmark= () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>;
const IcoBmFill  = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>;
const IcoStar    = () => <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const IcoPlay    = () => <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="8 4 20 12 8 20"/></svg>;
const IcoArrow   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>;
const IcoX       = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoMenu    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const IcoClock   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IcoCamera  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
const IcoScan    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1"/></svg>;
const IcoAlert   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const IcoUser    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IcoFire    = () => <svg viewBox="0 0 24 24" fill="currentColor" style={{color:'#e74c3c'}}><path d="M12 2c0 0-5 4.5-5 9a5 5 0 0 0 10 0c0-2.5-1.5-5-1.5-5s-1 2-2.5 2S11 6 12 2z"/></svg>;
const IcoPause   = () => <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>;
const IcoImdb    = () => <svg viewBox="0 0 24 24" fill="currentColor" style={{color:'#f5c518'}}><rect x="2" y="6" width="20" height="12" rx="2"/><text x="4" y="15" fontSize="7" fontWeight="900" fill="#000">IMDb</text></svg>;

// ── Main Dashboard ─────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate  = useNavigate();
  const { bookmarks, removeBookmark, isBookmarked, addBookmark, comments, ratings, currentUser } = useApp();

  const [profile, setProfile]               = useState(null);
  const [allTrending, setAllTrending]       = useState([]);
  const [featuredIdx, setFeaturedIdx]       = useState(0);
  const [releaseIdx, setReleaseIdx]         = useState(0);
  const [heroVisible, setHeroVisible]       = useState(true);
  const [heroPlaying, setHeroPlaying]       = useState(true);
  const [relVisible, setRelVisible]         = useState(true);
  const [bookmarkMovies, setBookmarkMovies] = useState([]);
  const [cast, setCast]                     = useState([]);
  const [mobileNavOpen, setMobileNavOpen]   = useState(false);
  const [castExpanded, setCastExpanded]     = useState(false);

  // Reading time
  const synopsisRef     = useRef(null);
  const readingInterval = useRef(null);
  const [readingElapsed, setReadingElapsed] = useState(0);

  // AI Scanner
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanning, setScanning]         = useState(false);
  const [scanMsg, setScanMsg]           = useState('');
  const [scanResults, setScanResults]   = useState(null);
  const [scanError, setScanError]       = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadBytes, setUploadBytes]   = useState(null);
  const fileInputRef = useRef(null);

  const greeting     = getGreeting();
  const displayName  = profile?.firstName || currentUser || 'User';

  // Auth
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

  // Fetch diverse movies from multiple endpoints, shuffle for variety
  useEffect(() => {
    const endpoints = [
      `/trending/movie/day`,
      `/movie/now_playing`,
      `/movie/top_rated`,
      `/movie/popular`,
    ];
    Promise.all(
      endpoints.map(ep =>
        fetch(`${TMDB_BASE}${ep}?api_key=${TMDB_KEY}&language=en-US`)
          .then(r => r.json())
          .then(d => d.results || [])
          .catch(() => [])
      )
    ).then(pages => {
      const seen = new Set();
      const pool = pages
        .flat()
        .filter(m => {
          if (!m.backdrop_path || !m.poster_path || m.adult) return false;
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
      // Fisher-Yates shuffle
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      setAllTrending(pool);
    });
  }, []);

  // Derive featured and releases from indices
  // Featured cycles through the first 8; releases use the remaining pool
  const featuredPool = allTrending.slice(0, 15);      // up to 15 diverse featured movies
  const releasePool  = allTrending.slice(15);         // remaining ~60 for releases
  const featured     = featuredPool[featuredIdx] || null;
  const releases     = releasePool.length
    ? Array.from({ length: 3 }, (_, i) => releasePool[(releaseIdx + i) % releasePool.length])
    : [];

  // Auto-cycle featured every 14 s — stops when user pauses
  useEffect(() => {
    if (featuredPool.length < 2 || !heroPlaying) return;
    const t = setInterval(() => {
      setHeroVisible(false);
      setTimeout(() => {
        setFeaturedIdx(i => (i + 1) % featuredPool.length);
        setHeroVisible(true);
      }, 350);
    }, 14000);
    return () => clearInterval(t);
  }, [featuredPool.length, heroPlaying]);

  // Auto-cycle releases every 5 s
  useEffect(() => {
    if (releasePool.length < 2) return;
    const t = setInterval(() => {
      setRelVisible(false);
      setTimeout(() => {
        setReleaseIdx(i => (i + 1) % releasePool.length);
        setRelVisible(true);
      }, 280);
    }, 5000);
    return () => clearInterval(t);
  }, [releasePool.length]);

  // Reset reading timer whenever featured changes
  useEffect(() => {
    setReadingElapsed(0);
    clearInterval(readingInterval.current);
  }, [featuredIdx]);

  // Cast for featured movie
  useEffect(() => {
    if (!featured?.id) return;
    fetch(`${TMDB_BASE}/movie/${featured.id}/credits?api_key=${TMDB_KEY}`)
      .then(r => r.json())
      .then(d => setCast(d.cast || []))
      .catch(() => {});
  }, [featured?.id]);

  // Bookmark movie details
  useEffect(() => {
    if (bookmarks.length === 0) { setBookmarkMovies([]); return; }
    Promise.all(
      bookmarks.map(id =>
        fetch(`${TMDB_BASE}/movie/${id}?api_key=${TMDB_KEY}`).then(r => r.json())
      )
    ).then(movies => setBookmarkMovies(movies.filter(m => !m.status_code)))
     .catch(() => {});
  }, [JSON.stringify(bookmarks)]);

  // Reading time IntersectionObserver — re-attach every time the featured movie loads
  // (synopsisRef.current is null until featured renders, so [] dependency misses it)
  useEffect(() => {
    if (!synopsisRef.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        readingInterval.current = setInterval(() => setReadingElapsed(e => e + 1), 1000);
      } else {
        clearInterval(readingInterval.current);
      }
    }, { threshold: 0.4 });
    obs.observe(synopsisRef.current);
    return () => { obs.disconnect(); clearInterval(readingInterval.current); };
  }, [featured?.id]);

  // Reading time estimate (avg 200 wpm)
  const synopsisWords = featured?.overview?.trim().split(/\s+/).length || 0;
  const estReadSec    = Math.max(5, Math.ceil((synopsisWords / 200) * 60));

  // User activity from AppContext
  const myComments = Object.entries(comments)
    .flatMap(([movieId, cmts]) =>
      cmts.filter(c => c.user === currentUser).map(c => ({ ...c, movieId: Number(movieId) }))
    )
    .sort((a, b) => b.id - a.id)
    .slice(0, 6);

  const myRatings = Object.entries(ratings)
    .map(([movieId, r]) => ({ ...r, movieId: Number(movieId) }))
    .slice(0, 4);

  // Camera helpers
  async function startCamera() {
    setScanResults(null); setScanError(null); setUploadPreview(null); setUploadBytes(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraActive(true);
    } catch {
      setScanError('Camera access denied. Enable camera permission or upload an image.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    stopCamera();
    const reader = new FileReader();
    reader.onload = ev => {
      setUploadPreview(ev.target.result);
      const arr = new Uint8Array(ev.target.result instanceof ArrayBuffer ? ev.target.result : new ArrayBuffer(0));
      // Read as ArrayBuffer for bytes
    };
    // Read both for preview (DataURL) and bytes (ArrayBuffer)
    const fr2 = new FileReader();
    fr2.onload = ev2 => setUploadBytes(new Uint8Array(ev2.target.result));
    fr2.readAsArrayBuffer(file);
    reader.readAsDataURL(file);
    setScanResults(null); setScanError(null);
  }

  async function captureAndScan() {
    setScanning(true); setScanResults(null); setScanError(null);

    let jpegBytes;

    if (uploadBytes) {
      jpegBytes = uploadBytes;
    } else if (cameraActive && videoRef.current) {
      setScanMsg('Capturing frame...');
      const canvas = canvasRef.current;
      canvas.width  = videoRef.current.videoWidth  || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
      jpegBytes = new Uint8Array(await blob.arrayBuffer());
    } else {
      setScanError('No image source. Enable camera or upload an image.');
      setScanning(false);
      return;
    }

    try {
      setScanMsg('Analyzing with AWS Rekognition...');
      const result = await rekognizeCelebrities(jpegBytes);

      if (result.CelebrityFaces?.length) {
        setScanMsg('Fetching actor details from TMDB...');
        const enriched = await Promise.all(
          result.CelebrityFaces.map(async celeb => {
            try {
              const sr = await fetch(
                `${TMDB_BASE}/search/person?api_key=${TMDB_KEY}&query=${encodeURIComponent(celeb.Name)}`
              ).then(r => r.json());
              return { ...celeb, tmdb: sr.results?.[0] || null };
            } catch {
              return { ...celeb, tmdb: null };
            }
          })
        );
        setScanResults({ celebrities: enriched, unmatched: result.UnrecognizedFaces?.length || 0 });
      } else {
        setScanResults({ celebrities: [], unmatched: result.UnrecognizedFaces?.length || 0 });
      }
    } catch (err) {
      setScanError(err.message);
    }

    setScanning(false);
    setScanMsg('');
  }

  function handleLogout() {
    stopCamera();
    auth.signOut().then(() => navigate('/login'));
  }

  const visibleCast = castExpanded ? cast : cast.slice(0, 8);

  return (
    <div className="db-root">

      {/* ── Mobile Header ── */}
      <header className="db-mobile-header">
        <Link to="/"><img src={logo} alt="KeroMovie" className="db-mobile-logo" /></Link>
        <span className="db-mobile-greeting">{greeting}, <strong>{displayName}</strong></span>
        <button className="db-hamburger" onClick={() => setMobileNavOpen(o => !o)} aria-label="Menu">
          {mobileNavOpen ? <IcoX /> : <IcoMenu />}
        </button>
      </header>

      {/* ── Mobile Nav Overlay ── */}
      {mobileNavOpen && (
        <div className="db-nav-overlay" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* ── Left Sidebar ── */}
      <aside className={`db-sidebar-left${mobileNavOpen ? ' db-sidebar-left--open' : ''}`}>
        <div className="db-sl-logo-wrap">
          <Link to="/"><img src={logo} alt="KeroMovie" className="db-sl-logo-img" /></Link>
        </div>
        <nav className="db-sl-nav">
          <Link to="/"          className="db-sl-icon"              title="Home"      onClick={() => setMobileNavOpen(false)}><IcoFilm /></Link>
          <Link to="/explore"   className="db-sl-icon"              title="Explore"   onClick={() => setMobileNavOpen(false)}><IcoExplore /></Link>
          <Link to="/browse"    className="db-sl-icon db-sl-active" title="Dashboard" onClick={() => setMobileNavOpen(false)}><IcoDash /></Link>
          <Link to="/forums"    className="db-sl-icon"              title="Forums"    onClick={() => setMobileNavOpen(false)}><IcoForum /></Link>
          <Link to="/streaming" className="db-sl-icon"              title="Streaming" onClick={() => setMobileNavOpen(false)}><IcoStream /></Link>
        </nav>
        <div className="db-sl-bottom">
          <button className="db-sl-icon" onClick={handleLogout} title="Logout"><IcoLogout /></button>
        </div>
      </aside>

      {/* ── Center + Right ── */}
      <div className="db-center">

        {/* ── Desktop Topbar ── */}
        <header className="db-topbar">
          <div className="db-topbar-left">
            <p className="db-topbar-greeting">{greeting}, <strong>{displayName}</strong></p>
            <p className="db-topbar-date">
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="db-topbar-right">
            <div className="db-avatar" style={{ background: 'linear-gradient(135deg,#e74c3c,#8b0000)' }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="db-body">

          {/* ──────── LEFT MAIN CONTENT ──────── */}
          <div className="db-main-left">

            {/* Featured Hero + Synopsis + Reading Timer */}
            {featured && (
              <section
                className="db-hero"
                style={{
                  backgroundImage: `url(${IMG_OG}${featured.backdrop_path})`,
                  opacity: heroVisible ? 1 : 0,
                  transition: 'opacity 0.35s ease',
                }}
              >
                <div className="db-hero-grad" />
                <div className="db-hero-content">
                  <div className="db-hero-badges">
                    <span className="db-badge db-badge--trend"> Trending</span>
                    <span className="db-badge db-badge--score"><IcoStar /> {featured.vote_average?.toFixed(1)}</span>
                    <span className="db-badge db-badge--tmdb">TMDB</span>
                  </div>
                  <h1 className="db-hero-title">{featured.title}</h1>
                  <div className="db-hero-meta">
                    <span>{featured.release_date?.slice(0, 4)}</span>
                    <span className="db-dot" />
                    <span>{genreLabel(featured.genre_ids)}</span>
                  </div>
                  <div ref={synopsisRef} className="db-synopsis-wrap">
                    <p className="db-hero-desc">{featured.overview}</p>
                    <div className="db-reading-row">
                      <IcoClock />
                      <span>Est. read: <strong>{fmtTime(estReadSec)}</strong></span>
                      <span
                        className="db-reading-live"
                        style={{ visibility: readingElapsed > 0 ? 'visible' : 'hidden' }}
                      >
                        <span className="db-reading-pulse" />
                        {fmtTime(Math.max(readingElapsed, 1))} reading
                      </span>
                    </div>
                  </div>
                  <button
                    className="db-hero-bm-btn"
                    onClick={() => isBookmarked(featured.id) ? removeBookmark(featured.id) : addBookmark(featured.id)}
                    title={isBookmarked(featured.id) ? 'Remove bookmark' : 'Bookmark this movie'}
                  >
                    {isBookmarked(featured.id) ? <IcoBmFill /> : <IcoBookmark />}
                    {isBookmarked(featured.id) ? 'Bookmarked' : 'Bookmark'}
                  </button>
                </div>
                <div className="db-hero-poster-wrap">
                  {featured.poster_path && (
                    <img src={`${IMG_W500}${featured.poster_path}`} alt={featured.title} className="db-hero-poster" />
                  )}
                </div>

                {/* Pause / play auto-cycle */}
                <button
                  className={`db-hero-pause${!heroPlaying ? ' db-hero-pause--paused' : ''}`}
                  onClick={() => setHeroPlaying(p => !p)}
                  title={heroPlaying ? 'Pause auto-cycle' : 'Resume auto-cycle'}
                >
                  {heroPlaying ? <IcoPause /> : <IcoPlay />}
                </button>
              </section>
            )}

            {/* ── AI Face Scanner ── */}
            <section className="db-section">
              <div className="db-section-row">
                <span className="db-section-title">Find Out Your Favorite Actors!</span>
                <span className="db-section-sub">AWS Rekognition</span>
              </div>

              <div className="db-scanner">
                <div className="db-scanner-view">
                  {/* Camera video */}
                  <video
                    ref={videoRef}
                    className="db-scanner-video"
                    style={{ display: cameraActive ? 'block' : 'none' }}
                    autoPlay muted playsInline
                  />
                  {/* Upload preview */}
                  {uploadPreview && !cameraActive && (
                    <img src={uploadPreview} className="db-scanner-preview" alt="Upload preview" />
                  )}
                  {/* Placeholder */}
                  {!cameraActive && !uploadPreview && (
                    <div className="db-scanner-placeholder">
                      <IcoCamera />
                      <p>Enable camera or upload an image to scan actor faces</p>
                    </div>
                  )}
                  {/* Scanning overlay */}
                  {scanning && (
                    <div className="db-scanner-loading">
                      <span className="db-scanner-spin" />
                      <p>{scanMsg}</p>
                    </div>
                  )}
                  {/* Hidden canvas for capture */}
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>

                <div className="db-scanner-bar">
                  {!cameraActive ? (
                    <button className="db-scan-btn db-scan-btn--cam" onClick={startCamera}>
                      <IcoCamera /> Camera
                    </button>
                  ) : (
                    <button className="db-scan-btn db-scan-btn--stop" onClick={stopCamera}>
                      <IcoX /> Stop
                    </button>
                  )}
                  <button className="db-scan-btn db-scan-btn--upload" onClick={() => fileInputRef.current?.click()}>
                    <IcoScan /> Upload Image
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
                  <button
                    className="db-scan-btn db-scan-btn--go"
                    onClick={captureAndScan}
                    disabled={scanning || (!cameraActive && !uploadBytes)}
                  >
                    <IcoScan /> {scanning ? 'Scanning…' : 'Identify'}
                  </button>
                </div>

                {scanError && (
                  <div className="db-scan-error">
                    {scanError}
                  </div>
                )}

                {scanResults && (
                  <div className="db-scan-results">
                    {scanResults.celebrities.length === 0 ? (
                      <div className="db-scan-empty">
                        <IcoUser />
                        <p>
                          {scanResults.unmatched > 0
                            ? `${scanResults.unmatched} face${scanResults.unmatched > 1 ? 's' : ''} detected but not recognized as a known actor/actress.`
                            : 'No faces detected in this image.'}
                        </p>
                      </div>
                    ) : (
                      scanResults.celebrities.map((celeb, idx) => (
                        <div key={idx} className="db-scan-card">
                          {celeb.tmdb?.profile_path ? (
                            <img src={`${IMG_W200}${celeb.tmdb.profile_path}`} alt={celeb.Name} className="db-scan-photo" />
                          ) : (
                            <div className="db-scan-photo db-scan-photo--ph"><IcoUser /></div>
                          )}
                          <div className="db-scan-info">
                            <p className="db-scan-name">{celeb.Name}</p>
                            <div className="db-scan-conf">
                              <IcoStar />
                              <span>{celeb.MatchConfidence?.toFixed(0)}% confidence</span>
                            </div>
                            {celeb.tmdb?.known_for_department && (
                              <p className="db-scan-dept">{celeb.tmdb.known_for_department}</p>
                            )}
                            {celeb.tmdb?.known_for?.length > 0 && (
                              <p className="db-scan-known">
                                Known for: {celeb.tmdb.known_for.slice(0, 2).map(m => m.title || m.name).join(', ')}
                              </p>
                            )}
                            {celeb.Urls?.[0] && (
                              <a href={celeb.Urls[0]} target="_blank" rel="noopener noreferrer" className="db-scan-link">
                                View on IMDb <IcoArrow />
                              </a>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* ── New Releases ── */}
            <section className="db-section">
              <div className="db-section-row">
                <span className="db-section-title">New Releases</span>
                <Link to="/explore" className="db-section-more">See all</Link>
              </div>
              <div
                className="db-releases"
                style={{ opacity: relVisible ? 1 : 0, transition: 'opacity 0.28s ease' }}
              >
                {releases.map((m, i) => m && (
                  <div
                    key={`${m.id}-${releaseIdx}`}
                    className={`db-rel-card${i === 0 ? ' db-rel-card--large' : ''}`}
                    style={{ backgroundImage: `url(${IMG_W500}${i === 0 ? (m.backdrop_path || m.poster_path) : m.poster_path})` }}
                  >
                    <div className="db-rel-overlay" />
                    <div className="db-rel-foot">
                      <p className="db-rel-title">{m.title}</p>
                      {i === 0 && <p className="db-rel-year">{m.release_date?.slice(0, 4)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>

          {/* ──────── RIGHT PANEL ──────── */}
          <aside className="db-main-right">

            {/* Bookmark List */}
            <div className="db-panel-block">
              <div className="db-section-row">
                <span className="db-section-title">Bookmarks</span>
                <Link to="/explore" className="db-section-more">+ Add</Link>
              </div>
              {bookmarkMovies.length === 0 ? (
                <div className="db-empty">
                  <IcoBookmark />
                  <p>No bookmarks yet. Browse Explore and tap the bookmark icon on any movie.</p>
                </div>
              ) : (
                <div className="db-bm-list">
                  {bookmarkMovies.map(m => (
                    <div key={m.id} className="db-bm-item">
                      {m.poster_path
                        ? <img src={`${IMG_W200}${m.poster_path}`} alt={m.title} className="db-bm-thumb" />
                        : <div className="db-bm-thumb db-bm-thumb--ph">{m.title?.[0]}</div>
                      }
                      <div className="db-bm-info">
                        <p className="db-bm-title">{m.title}</p>
                        <p className="db-bm-sub">
                          {m.release_date?.slice(0, 4)}
                          {m.vote_average ? ` · ${m.vote_average.toFixed(1)}/10` : ''}
                        </p>
                        <p className="db-bm-genre">{genreLabel(m.genres?.map(g => g.id))}</p>
                      </div>
                      <button
                        className="db-bm-remove"
                        onClick={() => removeBookmark(m.id)}
                        title="Remove bookmark"
                      >
                        <IcoX />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cast / Actors List */}
            {cast.length > 0 && (
              <div className="db-panel-block">
                <div className="db-section-row">
                  <span className="db-section-title">Full Cast</span>
                  <span className="db-section-sub db-cast-movie">{featured?.title}</span>
                </div>
                <div className="db-cast-list">
                  {visibleCast.map(actor => (
                    <div key={actor.credit_id} className="db-cast-item">
                      {actor.profile_path
                        ? <img src={`${IMG_W200}${actor.profile_path}`} alt={actor.name} className="db-cast-photo" />
                        : <div className="db-cast-photo db-cast-photo--ph"><IcoUser /></div>
                      }
                      <div className="db-cast-info">
                        <p className="db-cast-name">{actor.name}</p>
                        {actor.character && <p className="db-cast-char">as {actor.character}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                {cast.length > 8 && (
                  <button className="db-cast-toggle" onClick={() => setCastExpanded(e => !e)}>
                    {castExpanded ? 'Show less' : `Show all ${cast.length} cast members`}
                    <IcoArrow />
                  </button>
                )}
              </div>
            )}

            {/* Recent Activity (Comments + Ratings) */}
            <div className="db-panel-block">
              <div className="db-section-row">
                <span className="db-section-title">Your Activity</span>
              </div>
              {myComments.length === 0 && myRatings.length === 0 ? (
                <div className="db-empty">
                  <IcoForum />
                  <p>No activity yet. Comment or rate movies from the Explore page.</p>
                </div>
              ) : (
                <div className="db-activity-list">
                  {myRatings.map((r, i) => (
                    <div key={`r-${i}`} className="db-activity-item">
                      <div className="db-activity-icon db-activity-icon--rating"><IcoStar /></div>
                      <div className="db-activity-body">
                        <p className="db-activity-title">{r.movieTitle || 'Movie'}</p>
                        <p className="db-activity-sub">Rated <strong>{r.score}/10</strong> · {r.date}</p>
                      </div>
                    </div>
                  ))}
                  {myComments.map(c => (
                    <div key={c.id} className="db-activity-item">
                      <div className="db-activity-icon db-activity-icon--comment"><IcoForum /></div>
                      <div className="db-activity-body">
                        <p className="db-activity-title">
                          {c.text.length > 55 ? c.text.slice(0, 55) + '…' : c.text}
                        </p>
                        <p className="db-activity-sub">{c.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </aside>
        </div>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="db-bottom-nav">
        <Link to="/"          className="db-bn-item" title="Home"><IcoFilm /><span>Home</span></Link>
        <Link to="/explore"   className="db-bn-item" title="Explore"><IcoExplore /><span>Explore</span></Link>
        <Link to="/browse"    className="db-bn-item db-bn-item--active" title="Dashboard"><IcoDash /><span>Dashboard</span></Link>
        <Link to="/forums"    className="db-bn-item" title="Forums"><IcoForum /><span>Forums</span></Link>
        <Link to="/streaming" className="db-bn-item" title="Streaming"><IcoStream /><span>Streaming</span></Link>
      </nav>

    </div>
  );
}

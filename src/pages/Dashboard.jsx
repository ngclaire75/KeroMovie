import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { getProfile } from '../lib/authHelpers';
import { useApp } from '../context/AppContext';
import ProfileModal from '../components/ProfileModal/ProfileModal';
import logo from '../../images/keromovielogo.png';
import playlistBg from '../../images/playlistbackground.gif';
import './dashboard.css';

const TMDB_KEY  = import.meta.env.VITE_TMDB_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_W500  = 'https://image.tmdb.org/t/p/w500';
const IMG_OG    = 'https://image.tmdb.org/t/p/original';
const IMG_W200  = 'https://image.tmdb.org/t/p/w185';
const IMG_W342  = 'https://image.tmdb.org/t/p/w342';

const AWS_KEY    = import.meta.env.VITE_AWS_ACCESS_KEY_ID;
const AWS_SECRET = import.meta.env.VITE_AWS_SECRET_ACCESS_KEY;
const AWS_REGION = import.meta.env.VITE_AWS_REGION || 'us-east-1';

const GENRE_MAP = {
  28:'Action', 12:'Adventure', 16:'Animation', 35:'Comedy', 80:'Crime',
  18:'Drama', 14:'Fantasy', 27:'Horror', 10749:'Romance', 878:'Sci-Fi',
  53:'Thriller', 10402:'Music', 99:'Documentary',
};

const GENRE_GROUP_MAP = {
  28:'action', 12:'action', 37:'action', 10752:'war',
  35:'comedy', 16:'animation',
  27:'horror', 53:'thriller', 9648:'crime', 80:'crime',
  10749:'romance', 18:'drama', 10402:'music',
  878:'scifi', 14:'fantasy',
  99:'documentary', 36:'documentary',
};

const PERSONALITY_MAP = {
  action:      { title:'The Adrenaline Seeker',  desc:'High stakes and relentless pace are your fuel. You thrive on cinematic intensity and never back down from a challenge — on screen or off.',                        traits:['Bold','Energetic','Decisive'] },
  comedy:      { title:'The Joy Bringer',         desc:'Life is better with laughter. You appreciate wit, timing, and the rare gift of a story that makes a whole room light up.',                                        traits:['Optimistic','Witty','Social'] },
  drama:       { title:'The Deep Empath',         desc:'You connect with raw human emotion above all else. Complex characters and honest storytelling speak to you on a level most people never reach.',                 traits:['Empathetic','Thoughtful','Introspective'] },
  horror:      { title:'The Shadow Explorer',     desc:"Fear doesn't repel you — it intrigues you. You seek the thrill of the unknown and appreciate stories that dare to go where others won't.",                      traits:['Fearless','Curious','Edgy'] },
  romance:     { title:'The Hopeless Romantic',   desc:'You believe deeply in connection, vulnerability, and the power of love stories. Emotional depth and heartfelt moments are your cinematic language.',            traits:['Passionate','Warm','Idealistic'] },
  scifi:       { title:'The Visionary',           desc:'You think beyond the present. Big ideas, speculative worlds, and the limitless possibilities of what could exist fascinate your ever-curious mind.',            traits:['Imaginative','Analytical','Forward-thinking'] },
  thriller:    { title:'The Edge Walker',         desc:'Suspense and psychological tension are your comfort zone. You love the mental chess game of unravelling a perfectly constructed mystery.',                       traits:['Sharp','Perceptive','Intense'] },
  fantasy:     { title:'The Dreamer',             desc:'You live in worlds built from pure imagination. Myth, magic, and the extraordinary call to you — reality is just a starting point.',                            traits:['Creative','Open-minded','Adventurous'] },
  crime:       { title:'The Detective',           desc:"A sharp analytical mind drives your viewing. You're drawn to moral complexity, power dynamics, and the satisfaction of watching it all unravel.",               traits:['Analytical','Strategic','Discerning'] },
  documentary: { title:'The Truth Seeker',        desc:'You value knowledge, perspective, and the unfiltered truth. Real stories and real people fascinate you more than any fictional narrative ever could.',          traits:['Curious','Grounded','Informed'] },
  animation:   { title:'The Free Spirit',         desc:"You're young at heart and refuse to let imagination be limited by age or logic. Animation speaks a visual language that transcends every boundary.",            traits:['Playful','Creative','Open'] },
  music:       { title:'The Soul',                desc:'Emotion, rhythm, and artistic expression are your compass. You feel stories as much as you watch them, and music gives them their heartbeat.',                  traits:['Expressive','Sensitive','Artistic'] },
  war:         { title:'The Historian',           desc:'You study the weight of human history and the sacrifices that shaped the world. Depth, consequence, and courage in the face of impossibility speak to you.',    traits:['Resilient','Principled','Reflective'] },
};

function derivePersonality(genreIds) {
  if (!genreIds?.length) return null;
  const counts = {};
  for (const id of genreIds) {
    const g = GENRE_GROUP_MAP[id];
    if (g) counts[g] = (counts[g] || 0) + 1;
  }
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  return dominant ? PERSONALITY_MAP[dominant] : null;
}

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

function fmtSec(s) {
  if (!s || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
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
  if (!AWS_KEY || !AWS_SECRET) throw new Error('AWS Rekognition is not able to detect yet.');

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
const IcoMusic   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
const IcoPause   = () => <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>;
const IcoImdb    = () => <svg viewBox="0 0 24 24" fill="currentColor" style={{color:'#f5c518'}}><rect x="2" y="6" width="20" height="12" rx="2"/><text x="4" y="15" fontSize="7" fontWeight="900" fill="#000">IMDb</text></svg>;
const IcoRepeat    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;
const IcoHeart     = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;
const IcoHeartFill = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;

// ── Main Dashboard ─────────────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Dashboard() {
  const navigate  = useNavigate();
  const { bookmarks, removeBookmark, isBookmarked, addBookmark, currentUser,
          preferredCountry, preferredGenres, profilePhoto } = useApp();
  const [profileOpen, setProfileOpen] = useState(false);

  const [authUser, setAuthUser]             = useState(null);
  const [myForumPosts, setMyForumPosts]     = useState([]);
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

  // Soundtrack
  const [soundtrack,     setSoundtrack]     = useState([]);
  const [playingIdx,     setPlayingIdx]     = useState(null);
  const [nowPlaying,     setNowPlaying]     = useState(null);
  const [stSearch,       setStSearch]       = useState('');
  const [stMode,         setStMode]         = useState('featured');
  const [stSearchResults,setStSearchResults]= useState([]);
  const [stSearchMovie,  setStSearchMovie]  = useState('');
  const [stSearching,    setStSearching]    = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioCurSec,   setAudioCurSec]   = useState(0);
  const [audioDurSec,   setAudioDurSec]   = useState(0);
  const [loopTrack,     setLoopTrack]     = useState(false);
  const audioRef  = useRef(null);
  const loopRef   = useRef(false);

  // Persistent user data
  const [recentTracks,      setRecentTracks]      = useState(() => { try { return JSON.parse(localStorage.getItem('kero_recent_tracks') || '[]'); } catch { return []; } });
  const [savedTracks,       setSavedTracks]       = useState(() => { try { return JSON.parse(localStorage.getItem('kero_saved_tracks') || '[]'); } catch { return []; } });
  const [favCast,           setFavCast]           = useState(() => { try { return JSON.parse(localStorage.getItem('kero_fav_cast') || '[]'); } catch { return []; } });

  // Cast search
  const [castSearch,        setCastSearch]        = useState('');
  const [castMode,          setCastMode]          = useState('featured');
  const [castSearchResults, setCastSearchResults] = useState([]);
  const [castSearchMovie,   setCastSearchMovie]   = useState('');
  const [castSearching,     setCastSearching]     = useState(false);

  // Actor modal
  const [viewingActor,      setViewingActor]      = useState(null);
  const [actorDetails,      setActorDetails]      = useState(null);
  const [actorLoading,      setActorLoading]      = useState(false);

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
      setAuthUser(user || null);
      if (!user) return;
      const p = await getProfile(user.uid);
      setProfile(p || {
        firstName: user.displayName?.split(' ')[0] || 'User',
        username:  user.email?.split('@')[0] || 'user',
      });
    });
    return unsub;
  }, []);

  // Real-time listener for this user's forum posts
  useEffect(() => {
    if (!authUser) { setMyForumPosts([]); return; }
    const q = query(
      collection(db, 'forums_posts'),
      where('userId', '==', authUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setMyForumPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, [authUser?.uid]);

  // Fetch movies — when a preferred country is set, filter by origin country
  useEffect(() => {
    if (!TMDB_KEY) return;
    const base    = `${TMDB_BASE}`;
    const safe    = `api_key=${TMDB_KEY}&language=en-US&include_adult=false`;
    const country = preferredCountry;

    let fetches;
    if (country) {
      fetches = [
        fetch(`${base}/discover/movie?${safe}&sort_by=popularity.desc&with_origin_country=${country}`).then(r => r.json()).then(d => d.results || []).catch(() => []),
        fetch(`${base}/discover/movie?${safe}&sort_by=vote_average.desc&vote_count.gte=100&with_origin_country=${country}`).then(r => r.json()).then(d => d.results || []).catch(() => []),
        fetch(`${base}/discover/movie?${safe}&sort_by=revenue.desc&with_origin_country=${country}`).then(r => r.json()).then(d => d.results || []).catch(() => []),
      ];
    } else {
      fetches = [
        fetch(`${base}/trending/movie/day?${safe}`).then(r => r.json()).then(d => d.results || []).catch(() => []),
        fetch(`${base}/movie/now_playing?${safe}`).then(r => r.json()).then(d => d.results || []).catch(() => []),
        fetch(`${base}/movie/top_rated?${safe}`).then(r => r.json()).then(d => d.results || []).catch(() => []),
        fetch(`${base}/movie/popular?${safe}`).then(r => r.json()).then(d => d.results || []).catch(() => []),
      ];
    }

    Promise.all(fetches).then(pages => {
      const seen = new Set();
      const pool = pages
        .flat()
        .filter(m => {
          if (!m.backdrop_path || !m.poster_path || m.adult) return false;
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      setAllTrending(pool);
    });
  }, [preferredCountry]);

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

  // Soundtrack — fetch from iTunes when featured movie changes
  useEffect(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setPlayingIdx(null);
    setNowPlaying(null);
    setAudioProgress(0);
    setAudioCurSec(0);
    setAudioDurSec(0);
    setSoundtrack([]);
    if (!featured?.title) return;
    const term = encodeURIComponent(featured.title + ' original motion picture soundtrack');
    fetch(`/api/itunes?term=${term}&limit=20`)
      .then(r => r.json())
      .then(d => {
        const KW = ['soundtrack', 'score', 'motion picture', 'original'];
        const tracks = (d.results || []).filter(t => {
          if (!t.previewUrl) return false;
          const cn = (t.collectionName || '').toLowerCase();
          return KW.some(kw => cn.includes(kw));
        }).slice(0, 8);
        setSoundtrack(tracks);
      })
      .catch(() => setSoundtrack([]));
  }, [featured?.id]);

  // Stop audio on unmount
  useEffect(() => () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } }, []);

  function playTrackAudio(track, idx) {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (!track?.previewUrl) return;
    const audio = new Audio();
    audio.preload = 'auto';
    audio.loop = loopRef.current;
    audio.ontimeupdate = () => {
      if (!audio.duration) return;
      setAudioProgress(audio.currentTime / audio.duration);
      setAudioCurSec(audio.currentTime);
      setAudioDurSec(audio.duration);
    };
    audio.onloadedmetadata = () => setAudioDurSec(audio.duration);
    audio.onended = () => {
      if (!loopRef.current) {
        audioRef.current = null;
        setPlayingIdx(null);
        setAudioProgress(0);
        setAudioCurSec(0);
      }
    };
    // Set src after attaching listeners so iOS picks up the user-gesture context
    audio.src = track.previewUrl;
    audioRef.current = audio;
    setPlayingIdx(idx);
    audio.load();
    audio.play().catch(err => {
      // NotAllowedError = browser blocked autoplay; user must tap again
      if (err.name !== 'AbortError') {
        audioRef.current = null;
        setPlayingIdx(null);
      }
    });
  }

  function openTrack(idx) {
    const list = stMode === 'search' ? stSearchResults : soundtrack;
    const track = list[idx];
    if (!track) return;
    setAudioProgress(0);
    setAudioCurSec(0);
    setAudioDurSec(0);
    setNowPlaying({ ...track, idx });
    playTrackAudio(track, idx);
    addToRecentTracks(track);
  }

  function toggleNowPlayingPlayback() {
    if (!nowPlaying) return;
    if (!audioRef.current) { playTrackAudio(nowPlaying, nowPlaying.idx); return; }
    if (audioRef.current.paused) {
      audioRef.current.play().catch(() => {});
      setPlayingIdx(nowPlaying.idx);
    } else {
      audioRef.current.pause();
      setPlayingIdx(null);
    }
  }

  function seekAudio(ratio) {
    if (!audioRef.current) return;
    const d = audioRef.current.duration;
    if (!d) return;
    const t = ratio * d;
    audioRef.current.currentTime = t;
    setAudioProgress(ratio);
    setAudioCurSec(t);
  }

  function toggleLoop() {
    const next = !loopTrack;
    setLoopTrack(next);
    loopRef.current = next;
    if (audioRef.current) audioRef.current.loop = next;
  }

  function closeNowPlaying() {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setNowPlaying(null);
    setPlayingIdx(null);
    setAudioProgress(0);
    setAudioCurSec(0);
    setAudioDurSec(0);
  }

  async function searchSoundtrack(e) {
    e.preventDefault();
    if (!stSearch.trim()) return;
    setStSearching(true);
    setStSearchResults([]);
    const term = encodeURIComponent(stSearch.trim() + ' original motion picture soundtrack');
    try {
      const d = await fetch(`/api/itunes?term=${term}&limit=20`).then(r => r.json());
      const KW = ['soundtrack', 'score', 'motion picture', 'original'];
      const tracks = (d.results || []).filter(t => {
        if (!t.previewUrl) return false;
        const cn = (t.collectionName || '').toLowerCase();
        return KW.some(kw => cn.includes(kw));
      }).slice(0, 8);
      setStSearchResults(tracks);
      setStSearchMovie(stSearch.trim());
      setStMode('search');
    } catch {
      setStSearchResults([]);
      setStSearchMovie(stSearch.trim());
      setStMode('search');
    }
    setStSearching(false);
  }

  function clearSoundtrackSearch() {
    closeNowPlaying();
    setStSearch('');
    setStMode('featured');
    setStSearchResults([]);
    setStSearchMovie('');
  }

  function addToRecentTracks(track) {
    setRecentTracks(prev => {
      const filtered = prev.filter(t => t.trackId !== track.trackId);
      const next = [track, ...filtered].slice(0, 12);
      localStorage.setItem('kero_recent_tracks', JSON.stringify(next));
      return next;
    });
  }

  function toggleSaveTrack(track) {
    setSavedTracks(prev => {
      const exists = prev.some(t => t.trackId === track.trackId);
      const next = exists ? prev.filter(t => t.trackId !== track.trackId) : [track, ...prev].slice(0, 24);
      localStorage.setItem('kero_saved_tracks', JSON.stringify(next));
      return next;
    });
  }

  function isSavedTrack(trackId) {
    return savedTracks.some(t => t.trackId === trackId);
  }

  function toggleFavCast(actor) {
    setFavCast(prev => {
      const exists = prev.some(a => a.id === actor.id);
      const next = exists ? prev.filter(a => a.id !== actor.id) : [actor, ...prev].slice(0, 24);
      localStorage.setItem('kero_fav_cast', JSON.stringify(next));
      return next;
    });
  }

  function isFavCastMember(actorId) {
    return favCast.some(a => a.id === actorId);
  }

  function openRecentTrack(track) {
    setAudioProgress(0);
    setAudioCurSec(0);
    setAudioDurSec(0);
    setNowPlaying({ ...track, idx: -1 });
    playTrackAudio(track, -1);
  }

  async function searchCast(e) {
    e.preventDefault();
    if (!castSearch.trim()) return;
    setCastSearching(true);
    setCastSearchResults([]);
    try {
      const movies = await fetch(
        `${TMDB_BASE}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(castSearch.trim())}&language=en-US`
      ).then(r => r.json());
      const movie = movies.results?.[0];
      if (!movie) {
        setCastSearchResults([]);
        setCastSearchMovie(castSearch.trim());
        setCastMode('search');
        setCastSearching(false);
        return;
      }
      const credits = await fetch(
        `${TMDB_BASE}/movie/${movie.id}/credits?api_key=${TMDB_KEY}`
      ).then(r => r.json());
      setCastSearchResults((credits.cast || []).slice(0, 12));
      setCastSearchMovie(castSearch.trim());
      setCastMode('search');
    } catch {
      setCastSearchResults([]);
      setCastSearchMovie(castSearch.trim());
      setCastMode('search');
    }
    setCastSearching(false);
  }

  function clearCastSearch() {
    setCastSearch('');
    setCastMode('featured');
    setCastSearchResults([]);
    setCastSearchMovie('');
  }

  async function openActor(actor) {
    setViewingActor(actor);
    setActorDetails(null);
    setActorLoading(true);
    try {
      const [details, credits] = await Promise.all([
        fetch(`${TMDB_BASE}/person/${actor.id}?api_key=${TMDB_KEY}&language=en-US`).then(r => r.json()),
        fetch(`${TMDB_BASE}/person/${actor.id}/movie_credits?api_key=${TMDB_KEY}&language=en-US`).then(r => r.json()),
      ]);
      setActorDetails({
        ...details,
        movies: (credits.cast || [])
          .filter(m => m.poster_path)
          .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
          .slice(0, 8),
      });
    } catch {
      setActorDetails(null);
    }
    setActorLoading(false);
  }

  function closeActor() {
    setViewingActor(null);
    setActorDetails(null);
  }

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
        <button
          className="db-avatar db-mobile-avatar"
          style={profilePhoto ? {} : { background: 'linear-gradient(135deg,#e74c3c,#8b0000)' }}
          onClick={() => setProfileOpen(true)}
          title="Profile"
        >
          {profilePhoto
            ? <img src={profilePhoto} alt="Profile" className="db-avatar-img" />
            : displayName.charAt(0).toUpperCase()
          }
        </button>
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
            <button
              className="db-avatar"
              style={profilePhoto ? {} : { background: 'linear-gradient(135deg,#e74c3c,#8b0000)' }}
              onClick={() => setProfileOpen(true)}
              title="Profile & Preferences"
            >
              {profilePhoto
                ? <img src={profilePhoto} alt="Profile" className="db-avatar-img" />
                : displayName.charAt(0).toUpperCase()
              }
            </button>
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

            {/* ── Recently Played ── */}
            {recentTracks.length > 0 && (
              <section className="db-section">
                <div className="db-section-row">
                  <span className="db-section-title">Recently Played</span>
                  <button className="db-section-more db-section-more-btn" onClick={() => { setRecentTracks([]); localStorage.removeItem('kero_recent_tracks'); }}>Clear</button>
                </div>
                <div className="db-rp-grid">
                  {recentTracks.slice(0, 6).map(track => (
                    <div key={track.trackId} className="db-rp-item" onClick={() => openRecentTrack(track)}>
                      <img src={track.artworkUrl100} alt={track.trackName} className="db-rp-art" />
                      <p className="db-rp-name">{track.trackName}</p>
                      <p className="db-rp-artist">{track.artistName}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Saved Soundtracks ── */}
            {savedTracks.length > 0 && (
              <section className="db-section">
                <div className="db-section-row">
                  <span className="db-section-title">Saved Soundtracks</span>
                </div>
                <div className="db-rp-grid">
                  {savedTracks.slice(0, 6).map(track => (
                    <div key={track.trackId} className="db-rp-item" onClick={() => openRecentTrack(track)}>
                      <div className="db-rp-art-wrap">
                        <img src={track.artworkUrl100} alt={track.trackName} className="db-rp-art" />
                        <button
                          className="db-rp-remove"
                          onClick={e => { e.stopPropagation(); toggleSaveTrack(track); }}
                          title="Remove from saved"
                        >
                          <IcoX />
                        </button>
                      </div>
                      <p className="db-rp-name">{track.trackName}</p>
                      <p className="db-rp-artist">{track.artistName}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Favourite Cast ── */}
            {favCast.length > 0 && (
              <section className="db-section">
                <div className="db-section-row">
                  <span className="db-section-title">Favourite Cast</span>
                </div>
                <div className="db-fc-grid">
                  {favCast.map(actor => (
                    <div key={actor.id} className="db-fc-item" onClick={() => openActor(actor)}>
                      <div className="db-rp-art-wrap">
                        {actor.profile_path
                          ? <img src={`${IMG_W500}${actor.profile_path}`} alt={actor.name} className="db-fc-photo" />
                          : <div className="db-fc-photo db-fc-photo--ph"><IcoUser /></div>
                        }
                        <button
                          className="db-rp-remove"
                          onClick={e => { e.stopPropagation(); toggleFavCast(actor); }}
                          title="Remove from favourites"
                        >
                          <IcoX />
                        </button>
                      </div>
                      <p className="db-fc-name">{actor.name}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

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
            {(cast.length > 0 || castMode === 'search') && (
              <div className="db-panel-block">
                <div className="db-section-row">
                  <span className="db-section-title">Cast</span>
                  <span className="db-section-sub db-cast-movie">
                    {castMode === 'search' ? castSearchMovie : featured?.title}
                  </span>
                </div>

                {/* Cast search */}
                <form className="db-st-search" onSubmit={searchCast}>
                  <input
                    className="db-st-search-input"
                    type="text"
                    placeholder="Search cast by movie…"
                    value={castSearch}
                    onChange={e => setCastSearch(e.target.value)}
                    enterKeyHint="search"
                    inputMode="search"
                    autoComplete="off"
                  />
                  {castMode === 'search' && (
                    <button type="button" className="db-st-clear-btn" onClick={clearCastSearch} title="Back to featured">
                      <IcoX />
                    </button>
                  )}
                  <button type="submit" className="db-st-search-btn" disabled={castSearching || !castSearch.trim()}>
                    {castSearching ? <span className="db-st-spin" /> : <IcoExplore />}
                  </button>
                </form>

                {/* Cast results */}
                {castSearching ? (
                  <div className="db-st-skeleton">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="db-st-skel-item">
                        <div className="db-st-skel-art db-skel-shimmer" style={{ borderRadius: '50%' }} />
                        <div className="db-st-skel-info">
                          <div className="db-st-skel-line db-st-skel-line--name db-skel-shimmer" />
                          <div className="db-st-skel-line db-st-skel-line--artist db-skel-shimmer" />
                        </div>
                        <div className="db-st-skel-btn db-skel-shimmer" style={{ borderRadius: '50%' }} />
                      </div>
                    ))}
                  </div>
                ) : (castMode === 'search' ? castSearchResults : visibleCast).length === 0 ? (
                  <div className="db-empty">
                    <IcoUser />
                    <p>{castMode === 'search' ? 'No Cast Found' : 'No cast available.'}</p>
                  </div>
                ) : (
                  <>
                    <div className="db-cast-list">
                      {(castMode === 'search' ? castSearchResults : visibleCast).map(actor => (
                        <div key={actor.credit_id || actor.id} className="db-cast-item db-cast-item--clickable" onClick={() => openActor(actor)}>
                          {actor.profile_path
                            ? <img src={`${IMG_W200}${actor.profile_path}`} alt={actor.name} className="db-cast-photo" />
                            : <div className="db-cast-photo db-cast-photo--ph"><IcoUser /></div>
                          }
                          <div className="db-cast-info">
                            <p className="db-cast-name">{actor.name}</p>
                            {actor.character && <p className="db-cast-char">as {actor.character}</p>}
                          </div>
                          <button
                            className={`db-cast-fav-btn${isFavCastMember(actor.id) ? ' db-cast-fav-btn--on' : ''}`}
                            onClick={e => { e.stopPropagation(); toggleFavCast(actor); }}
                            title={isFavCastMember(actor.id) ? 'Remove from favourites' : 'Add to favourites'}
                          >
                            {isFavCastMember(actor.id) ? <IcoHeartFill /> : <IcoHeart />}
                          </button>
                        </div>
                      ))}
                    </div>
                    {castMode === 'featured' && cast.length > 8 && (
                      <button className="db-cast-toggle" onClick={() => setCastExpanded(e => !e)}>
                        {castExpanded ? 'Show less' : `Show all ${cast.length} cast members`}
                        <IcoArrow />
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Soundtrack */}
            {featured && (() => {
              const displayTracks = stMode === 'search' ? stSearchResults : soundtrack;
              const subLabel      = stMode === 'search' ? stSearchMovie : featured.title;
              const emptyMsg      = stMode === 'search' ? 'Soundtrack Not Found' : 'No Soundtrack For This Movie';
              return (
                <div className="db-panel-block">
                  <div className="db-section-row">
                    <span className="db-section-title">Soundtrack <span className="db-title-music-ico"><IcoMusic /></span></span>
                    <span className="db-section-sub">{subLabel}</span>
                  </div>

                  {/* Search bar */}
                  <form className="db-st-search" onSubmit={searchSoundtrack}>
                    <input
                      className="db-st-search-input"
                      type="text"
                      placeholder="Search movie soundtrack…"
                      value={stSearch}
                      onChange={e => setStSearch(e.target.value)}
                      enterKeyHint="search"
                      inputMode="search"
                      autoComplete="off"
                    />
                    {stMode === 'search' && (
                      <button type="button" className="db-st-clear-btn" onClick={clearSoundtrackSearch} title="Back to featured">
                        <IcoX />
                      </button>
                    )}
                    <button type="submit" className="db-st-search-btn" disabled={stSearching || !stSearch.trim()}>
                      {stSearching ? <span className="db-st-spin" /> : <IcoExplore />}
                    </button>
                  </form>

                  {/* Results */}
                  {stSearching ? (
                    <div className="db-st-skeleton">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="db-st-skel-item">
                          <div className="db-st-skel-art db-skel-shimmer" />
                          <div className="db-st-skel-info">
                            <div className="db-st-skel-line db-st-skel-line--name db-skel-shimmer" />
                            <div className="db-st-skel-line db-st-skel-line--artist db-skel-shimmer" />
                          </div>
                          <div className="db-st-skel-btn db-skel-shimmer" />
                        </div>
                      ))}
                    </div>
                  ) : displayTracks.length === 0 ? (
                    <div className="db-empty">
                      <IcoMusic />
                      <p>{emptyMsg}</p>
                    </div>
                  ) : (
                    <div className="db-soundtrack-list">
                      {displayTracks.map((track, idx) => (
                        <div key={track.trackId} className={`db-soundtrack-item${playingIdx === idx ? ' db-soundtrack-item--playing' : ''}`} onClick={() => openTrack(idx)}>
                          <img src={track.artworkUrl100} alt={track.trackName} className="db-soundtrack-art" />
                          <div className="db-soundtrack-info">
                            <p className="db-soundtrack-name">{track.trackName}</p>
                            <p className="db-soundtrack-artist">{track.artistName}</p>
                          </div>
                          <button
                            className={`db-st-heart-btn${isSavedTrack(track.trackId) ? ' db-st-heart-btn--on' : ''}`}
                            onClick={e => { e.stopPropagation(); toggleSaveTrack(track); }}
                            title={isSavedTrack(track.trackId) ? 'Remove from saved' : 'Save'}
                          >
                            {isSavedTrack(track.trackId) ? <IcoHeartFill /> : <IcoHeart />}
                          </button>
                          <span className="db-soundtrack-btn">
                            {playingIdx === idx ? <IcoPause /> : <IcoPlay />}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Taste Profile */}
            {(() => {
              const p = derivePersonality(preferredGenres);
              return p ? (
                <div className="db-panel-block">
                  <div className="db-section-row">
                    <span className="db-section-title">Your Taste Profile</span>
                  </div>
                  <div className="db-taste-card">
                    <p className="db-taste-title">{p.title}</p>
                    <p className="db-taste-desc">{p.desc}</p>
                    <div className="db-taste-traits">
                      {p.traits.map(t => <span key={t} className="db-taste-trait">{t}</span>)}
                    </div>
                    <button className="db-taste-edit" onClick={() => setProfileOpen(true)}>
                      Edit genres
                    </button>
                  </div>
                </div>
              ) : (
                <div className="db-panel-block">
                  <div className="db-section-row">
                    <span className="db-section-title">Your Taste Profile</span>
                  </div>
                  <div className="db-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    <p>Select your preferred genres in Profile &gt; Preferences to unlock your taste profile.</p>
                    <button className="db-taste-edit" onClick={() => setProfileOpen(true)}>Set preferences</button>
                  </div>
                </div>
              );
            })()}

            {/* Recent Activity — sourced from Firestore forums_posts */}
            <div className="db-panel-block">
              <div className="db-section-row">
                <span className="db-section-title">Your Activity</span>
                {myForumPosts.length > 0 && (
                  <Link to="/forums" className="db-section-link">View all</Link>
                )}
              </div>
              {myForumPosts.length === 0 ? (
                <div className="db-empty">
                  <IcoForum />
                  <p>No activity yet. Comment or rate movies from the Forums page.</p>
                </div>
              ) : (
                <div className="db-activity-list">
                  {myForumPosts.slice(0, 6).map(post => (
                    <div key={post.id} className="db-activity-item">
                      {post.moviePoster ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${post.moviePoster}`}
                          alt={post.movieTitle}
                          className="db-activity-poster"
                        />
                      ) : (
                        <div className="db-activity-icon db-activity-icon--comment"><IcoForum /></div>
                      )}
                      <div className="db-activity-body">
                        <p className="db-activity-title">{post.movieTitle}</p>
                        <p className="db-activity-sub">
                          {post.rating != null && <><strong>{post.rating}/10</strong> · </>}
                          {post.comment.length > 50 ? post.comment.slice(0, 50) + '…' : post.comment}
                        </p>
                        <p className="db-activity-date">{formatDate(post.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </aside>
        </div>
      </div>

      {/* ── Now Playing Modal ── */}
      {nowPlaying && (
        <div className="db-np-overlay" onClick={closeNowPlaying}>
          <div className="db-np-bg" style={{ backgroundImage: `url(${playlistBg})` }} />
          <div className="db-np-modal" onClick={e => e.stopPropagation()}>
            <button className="db-np-close" onClick={closeNowPlaying} title="Close"><IcoX /></button>

            <div className="db-np-left">
              {/* Track meta */}
              <div className="db-np-meta">
                <p className="db-np-track">{nowPlaying.trackName}</p>
                <p className="db-np-artist">{nowPlaying.artistName}</p>
                <p className="db-np-album">{nowPlaying.collectionName}</p>
                <div className="db-np-details">
                  {nowPlaying.primaryGenreName && <span>{nowPlaying.primaryGenreName}</span>}
                  {nowPlaying.releaseDate && <span>{new Date(nowPlaying.releaseDate).getFullYear()}</span>}
                </div>
              </div>

              {/* Save button */}
              <button
                className={`db-np-heart-btn${isSavedTrack(nowPlaying.trackId) ? ' db-np-heart-btn--on' : ''}`}
                onClick={() => toggleSaveTrack(nowPlaying)}
                title={isSavedTrack(nowPlaying.trackId) ? 'Remove from saved' : 'Save soundtrack'}
              >
                {isSavedTrack(nowPlaying.trackId) ? <IcoHeartFill /> : <IcoHeart />}
                {isSavedTrack(nowPlaying.trackId) ? 'Saved' : 'Save'}
              </button>

              {/* Contributors */}
              <div className="db-np-contributors">
                <div className="db-np-contrib-row">
                  <span className="db-np-contrib-label">Performed by</span>
                  <span className="db-np-contrib-value">{nowPlaying.artistName}</span>
                </div>
                {nowPlaying.composerName && nowPlaying.composerName !== nowPlaying.artistName && (
                  <div className="db-np-contrib-row">
                    <span className="db-np-contrib-label">Written by</span>
                    <span className="db-np-contrib-value">{nowPlaying.composerName}</span>
                  </div>
                )}
                {nowPlaying.collectionArtistName && nowPlaying.collectionArtistName !== nowPlaying.artistName && (
                  <div className="db-np-contrib-row">
                    <span className="db-np-contrib-label">Album artist</span>
                    <span className="db-np-contrib-value">{nowPlaying.collectionArtistName}</span>
                  </div>
                )}
              </div>

              {/* Progress + time */}
              <div className="db-np-seek-area">
                <div
                  className="db-np-progress-wrap"
                  onClick={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    seekAudio((e.clientX - rect.left) / rect.width);
                  }}
                >
                  <div className="db-np-progress-bar" style={{ width: `${audioProgress * 100}%` }} />
                </div>
                <div className="db-np-time-row">
                  <span>{fmtSec(audioCurSec)}</span>
                  <span>{fmtSec(audioDurSec)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="db-np-controls">
                <button
                  className={`db-np-loop-btn${loopTrack ? ' db-np-loop-btn--on' : ''}`}
                  onClick={toggleLoop}
                  title={loopTrack ? 'Repeat on — click to turn off' : 'Repeat off — click to turn on'}
                >
                  <IcoRepeat />
                </button>
                <button className="db-np-playbtn" onClick={toggleNowPlayingPlayback}>
                  {playingIdx === nowPlaying.idx ? <IcoPause /> : <IcoPlay />}
                </button>
              </div>
            </div>

            <div className="db-np-right">
              <div className={`db-np-disc${playingIdx === nowPlaying.idx ? ' db-np-disc--spinning' : ''}`}>
                <img
                  src={(nowPlaying.artworkUrl100 || '').replace(/\d+x\d+bb/, '600x600bb')}
                  alt={nowPlaying.trackName}
                  className="db-np-disc-img"
                />
                <div className="db-np-disc-hole" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Actor Detail Modal ── */}
      {viewingActor && (
        <div className="db-actor-overlay" onClick={closeActor}>
          <div className="db-np-bg" style={{ backgroundImage: `url(${playlistBg})` }} />
          <div className="db-actor-modal" onClick={e => e.stopPropagation()}>
            <button className="db-np-close" onClick={closeActor} title="Close"><IcoX /></button>

            <div className="db-actor-left">
              {viewingActor.profile_path
                ? <img src={`${IMG_W500}${viewingActor.profile_path}`} alt={viewingActor.name} className="db-actor-photo" />
                : <div className="db-actor-photo db-actor-photo--ph"><IcoUser /></div>
              }
              <button
                className={`db-actor-fav-btn${isFavCastMember(viewingActor.id) ? ' db-actor-fav-btn--on' : ''}`}
                onClick={() => toggleFavCast(viewingActor)}
                title={isFavCastMember(viewingActor.id) ? 'Remove from favourites' : 'Add to favourites'}
              >
                {isFavCastMember(viewingActor.id) ? <IcoHeartFill /> : <IcoHeart />}
                {isFavCastMember(viewingActor.id) ? 'Favourited' : 'Favourite'}
              </button>
            </div>

            <div className="db-actor-right">
              {actorLoading ? (
                <div className="db-actor-loading"><span className="db-scanner-spin" /></div>
              ) : actorDetails ? (
                <>
                  <h2 className="db-actor-name">{actorDetails.name}</h2>
                  {actorDetails.birthday && (
                    <p className="db-actor-meta">
                      Born {actorDetails.birthday}
                      {actorDetails.place_of_birth ? ` · ${actorDetails.place_of_birth}` : ''}
                    </p>
                  )}
                  {actorDetails.biography ? (
                    <p className="db-actor-bio">
                      {actorDetails.biography.length > 600 ? actorDetails.biography.slice(0, 600) + '…' : actorDetails.biography}
                    </p>
                  ) : null}
                  {actorDetails.movies?.length > 0 && (
                    <div className="db-actor-movies">
                      <p className="db-actor-movies-label">Known for</p>
                      <div className="db-actor-movies-grid">
                        {actorDetails.movies.map(m => (
                          <div key={m.id} className="db-actor-movie-item">
                            <img src={`${IMG_W342}${m.poster_path}`} alt={m.title} className="db-actor-movie-poster" />
                            <p className="db-actor-movie-title">{m.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="db-empty"><IcoUser /><p>Could not load actor details.</p></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Profile Modal ── */}
      {profileOpen && (
        <ProfileModal
          profile={profile}
          onClose={() => setProfileOpen(false)}
          onProfileUpdate={p => setProfile(p)}
        />
      )}

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

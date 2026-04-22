import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  collection, addDoc, onSnapshot, query, orderBy,
  deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { getProfile } from '../lib/authHelpers';
import { useApp } from '../context/AppContext';
import logo from '../../images/keromovielogo.png';
import './forums.css';

const TMDB_KEY  = import.meta.env.VITE_TMDB_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_W92   = 'https://image.tmdb.org/t/p/w92';

// ── Icons ──────────────────────────────────────────────────────────────────
const IcoFilm    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5"/></svg>;
const IcoExplore = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>;
const IcoDash    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
const IcoForum   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
const IcoSearch  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>;
const IcoX       = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoStar    = () => <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const IcoMenu    = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
const IcoTrash   = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
const IcoFilter  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;

const FORUMS_COL = 'forums_posts';

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function Forums() {
  const navigate = useNavigate();
  const { profilePhoto } = useApp();

  const [authUser,  setAuthUser]  = useState(null);
  const [profile,   setProfile]   = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // Post form
  const [movieSearch,    setMovieSearch]    = useState('');
  const [searchResults,  setSearchResults]  = useState([]);
  const [searchOpen,     setSearchOpen]     = useState(false);
  const [selectedMovie,  setSelectedMovie]  = useState(null);
  const [hoverRating,    setHoverRating]    = useState(0);
  const [rating,         setRating]         = useState(0);
  const [comment,        setComment]        = useState('');
  const [submitting,     setSubmitting]     = useState(false);
  const [formError,      setFormError]      = useState('');

  // Feed
  const [posts,       setPosts]       = useState([]);
  const [filterMovie, setFilterMovie] = useState(null);
  const [mobileNav,   setMobileNav]   = useState(false);

  const searchRef    = useRef(null);
  const searchTimer  = useRef(null);

  // Auth
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async user => {
      setAuthReady(true);
      if (!user) { navigate('/login'); return; }
      setAuthUser(user);
      const p = await getProfile(user.uid);
      setProfile(p);
    });
    return unsub;
  }, []);

  // Firestore real-time listener
  useEffect(() => {
    const q = query(collection(db, FORUMS_COL), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return unsub;
  }, []);

  // TMDB debounced search
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!movieSearch.trim() || movieSearch.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res  = await fetch(
          `${TMDB_BASE}/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(movieSearch)}&include_adult=false&language=en-US`
        );
        const data = await res.json();
        const hits = (data.results || []).filter(m => m.poster_path).slice(0, 7);
        setSearchResults(hits);
        setSearchOpen(hits.length > 0);
      } catch {}
    }, 320);
    return () => clearTimeout(searchTimer.current);
  }, [movieSearch]);

  // Close search dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function selectMovie(movie) {
    setSelectedMovie(movie);
    setMovieSearch('');
    setSearchResults([]);
    setSearchOpen(false);
  }

  function clearMovie() {
    setSelectedMovie(null);
    setMovieSearch('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    if (!selectedMovie) { setFormError('Please select a movie first.'); return; }
    if (!comment.trim()) { setFormError('Please write a comment.'); return; }
    if (!authUser) { navigate('/login'); return; }

    setSubmitting(true);
    try {
      await addDoc(collection(db, FORUMS_COL), {
        movieId:     selectedMovie.id,
        movieTitle:  selectedMovie.title,
        moviePoster: selectedMovie.poster_path || '',
        movieYear:   selectedMovie.release_date?.slice(0, 4) || '—',
        userId:      authUser.uid,
        username:    profile?.username || authUser.email?.split('@')[0] || 'User',
        rating:      rating || null,
        comment:     comment.trim(),
        createdAt:   serverTimestamp(),
      });
      setSelectedMovie(null);
      setMovieSearch('');
      setRating(0);
      setHoverRating(0);
      setComment('');
    } catch (err) {
      setFormError('Failed to post. Please try again.');
    }
    setSubmitting(false);
  }

  async function handleDelete(postId) {
    try { await deleteDoc(doc(db, FORUMS_COL, postId)); } catch {}
  }

  const displayPosts = filterMovie
    ? posts.filter(p => p.movieId === filterMovie.id)
    : posts;

  const displayName = profile?.firstName || profile?.username || authUser?.email?.split('@')[0] || 'User';
  const initial     = displayName.charAt(0).toUpperCase();

  if (!authReady) return null;

  return (
    <div className="fr-root">

      {/* ── Topbar ── */}
      <header className="fr-topbar">
        <Link to="/"><img src={logo} alt="KeroMovie" className="fr-logo" /></Link>

        <nav className={`fr-nav${mobileNav ? ' fr-nav--open' : ''}`}>
          <Link to="/"        className="fr-nav-link" onClick={() => setMobileNav(false)}><IcoFilm />Home</Link>
          <Link to="/explore" className="fr-nav-link" onClick={() => setMobileNav(false)}><IcoExplore />Explore</Link>
          <Link to="/browse"  className="fr-nav-link" onClick={() => setMobileNav(false)}><IcoDash />Dashboard</Link>
          <Link to="/forums"  className="fr-nav-link fr-nav-link--active" onClick={() => setMobileNav(false)}><IcoForum />Forums</Link>
        </nav>
        {mobileNav && <div className="fr-nav-backdrop" onClick={() => setMobileNav(false)} />}

        <div className="fr-topbar-right">
          <span className="fr-topbar-name">{displayName}</span>
          <button
            className="fr-avatar"
            style={profilePhoto ? {} : { background: 'linear-gradient(135deg,#e74c3c,#8b0000)' }}
            onClick={() => navigate('/browse')}
            title="Dashboard"
          >
            {profilePhoto
              ? <img src={profilePhoto} alt="Profile" className="fr-avatar-img" />
              : initial
            }
          </button>
          <button className="fr-hamburger" onClick={() => setMobileNav(o => !o)} aria-label="Menu">
            {mobileNav ? <IcoX /> : <IcoMenu />}
          </button>
        </div>
      </header>

      {/* ── Page heading ── */}
      <div className="fr-page-head">
        <h1 className="fr-page-title"><IcoForum />Community Forums</h1>
        <p className="fr-page-sub">Rate and review movies. Share your take with everyone.</p>
      </div>

      {/* ── Main layout ── */}
      <main className="fr-main">

        {/* ── Compose panel ── */}
        <aside className="fr-compose">
          <h2 className="fr-compose-title">Write a Review</h2>

          <form className="fr-form" onSubmit={handleSubmit}>

            {/* Movie picker */}
            <div className="fr-label">Movie</div>
            {selectedMovie ? (
              <div className="fr-sel-movie">
                <img src={`${IMG_W92}${selectedMovie.poster_path}`} alt={selectedMovie.title} className="fr-sel-poster" />
                <div className="fr-sel-info">
                  <p className="fr-sel-title">{selectedMovie.title}</p>
                  <p className="fr-sel-year">{selectedMovie.release_date?.slice(0, 4)}</p>
                </div>
                <button type="button" className="fr-sel-clear" onClick={clearMovie}><IcoX /></button>
              </div>
            ) : (
              <div className="fr-search-wrap" ref={searchRef}>
                <div className="fr-search-input-wrap">
                  <IcoSearch />
                  <input
                    type="text"
                    className="fr-search-input"
                    placeholder="Search for a movie…"
                    value={movieSearch}
                    onChange={e => setMovieSearch(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                    autoComplete="off"
                  />
                </div>
                {searchOpen && searchResults.length > 0 && (
                  <div className="fr-search-drop">
                    {searchResults.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        className="fr-search-row"
                        onClick={() => selectMovie(m)}
                      >
                        <img src={`${IMG_W92}${m.poster_path}`} alt={m.title} className="fr-search-thumb" />
                        <div className="fr-search-info">
                          <span className="fr-search-title">{m.title}</span>
                          <span className="fr-search-year">{m.release_date?.slice(0, 4)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Star rating */}
            <div className="fr-label">
              Rating <span className="fr-label-opt">optional</span>
            </div>
            <div className="fr-stars" onMouseLeave={() => setHoverRating(0)}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  type="button"
                  className={`fr-star${(hoverRating || rating) >= n ? ' fr-star--lit' : ''}`}
                  onMouseEnter={() => setHoverRating(n)}
                  onClick={() => setRating(rating === n ? 0 : n)}
                  aria-label={`${n} stars`}
                >
                  ★
                </button>
              ))}
              {rating > 0 && <span className="fr-stars-val">{rating}/10</span>}
            </div>

            {/* Comment */}
            <div className="fr-label">Comment</div>
            <textarea
              className="fr-textarea"
              placeholder="What did you think?"
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={4}
            />

            {formError && <p className="fr-form-error">{formError}</p>}

            <button
              type="submit"
              className="fr-submit"
              disabled={submitting || !selectedMovie || !comment.trim()}
            >
              {submitting ? 'Posting…' : 'Post Review'}
            </button>
          </form>
        </aside>

        {/* ── Feed ── */}
        <section className="fr-feed">
          <div className="fr-feed-bar">
            <span className="fr-feed-heading">
              {filterMovie ? (
                <><IcoFilter />Reviews for <em>{filterMovie.title}</em></>
              ) : (
                <><IcoForum />All Reviews</>
              )}
            </span>
            <span className="fr-post-count">{displayPosts.length} post{displayPosts.length !== 1 ? 's' : ''}</span>
            {filterMovie && (
              <button className="fr-clear-filter" onClick={() => setFilterMovie(null)}>
                <IcoX /> Clear filter
              </button>
            )}
          </div>

          {displayPosts.length === 0 ? (
            <div className="fr-empty">
              <IcoForum />
              <p>{filterMovie ? `No reviews for ${filterMovie.title} yet.` : 'No reviews yet. Be the first!'}</p>
            </div>
          ) : (
            <div className="fr-posts">
              {displayPosts.map(post => (
                <article key={post.id} className="fr-post">

                  {/* Movie row — click to filter */}
                  <div
                    className="fr-post-movie"
                    onClick={() => setFilterMovie({ id: post.movieId, title: post.movieTitle })}
                    title={`Filter by ${post.movieTitle}`}
                  >
                    {post.moviePoster && (
                      <img src={`${IMG_W92}${post.moviePoster}`} alt={post.movieTitle} className="fr-post-thumb" />
                    )}
                    <div className="fr-post-movie-info">
                      <p className="fr-post-movie-title">{post.movieTitle}</p>
                      <p className="fr-post-movie-year">{post.movieYear}</p>
                    </div>
                    {post.rating != null && (
                      <div className="fr-post-badge">
                        <IcoStar />{post.rating}/10
                      </div>
                    )}
                  </div>

                  {/* Comment body */}
                  <p className="fr-post-body">{post.comment}</p>

                  {/* Footer */}
                  <div className="fr-post-foot">
                    <span className="fr-post-user">@{post.username}</span>
                    <span className="fr-post-time">{formatDate(post.createdAt)}</span>
                    {authUser && post.userId === authUser.uid && (
                      <button
                        className="fr-post-del"
                        onClick={() => handleDelete(post.id)}
                        title="Delete"
                      >
                        <IcoTrash />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}

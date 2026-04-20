import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { movies } from '../data/movies';
import { useApp } from '../context/AppContext';

export default function Forums() {
  const navigate = useNavigate();
  const { comments, addComment, addToRecent } = useApp();
  const [selectedId, setSelectedId] = useState(null);
  const [text, setText] = useState('');
  const [userName, setUserName] = useState('');
  const [filterMovieId, setFilterMovieId] = useState(null);

  const allComments = movies.flatMap((m) =>
    (comments[m.id] || []).map((c) => ({ ...c, movieId: m.id, movieTitle: m.title, movieColor: m.colorClass }))
  ).sort((a, b) => b.id - a.id);

  const displayed = filterMovieId
    ? allComments.filter((c) => c.movieId === filterMovieId)
    : allComments;

  const handlePost = (e) => {
    e.preventDefault();
    if (!text.trim() || !selectedId) return;
    addComment(selectedId, text.trim(), userName.trim() || 'Guest');
    setText('');
    setUserName('');
  };

  return (
    <div className="inner-page">
      {/* Nav */}
      <nav className="inner-nav">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
        <div className="inner-logo" onClick={() => navigate('/')}>
          <span className="h-logo-mark">K</span>
          <span className="h-logo-name">KeroMovie</span>
        </div>
        <div className="inner-nav-links">
          <Link to="/browse">Movies</Link>
          <Link to="/forums" className="nav-link-active">Forums</Link>
          <Link to="/bookmarks">Bookmarks</Link>
        </div>
      </nav>

      <div className="forums-layout">
        {/* Left: movie list */}
        <aside className="forums-sidebar">
          <h2 className="forums-sidebar-title">Movies</h2>
          <button
            className={`forum-movie-btn ${!filterMovieId ? 'fmb-active' : ''}`}
            onClick={() => setFilterMovieId(null)}
          >
            <span className="fmb-title">All Discussions</span>
            <span className="fmb-count">{allComments.length}</span>
          </button>
          {movies.map((m) => {
            const count = (comments[m.id] || []).length;
            return (
              <button
                key={m.id}
                className={`forum-movie-btn ${filterMovieId === m.id ? 'fmb-active' : ''}`}
                onClick={() => { setFilterMovieId(m.id); setSelectedId(m.id); }}
              >
                <div className={`fmb-poster ${m.colorClass}`} />
                <div className="fmb-info">
                  <span className="fmb-title">{m.title}</span>
                  <span className="fmb-year">{m.year}</span>
                </div>
                <span className="fmb-count">{count}</span>
              </button>
            );
          })}
        </aside>

        {/* Right: comment feed + form */}
        <div className="forums-main">
          <div className="forums-header">
            <h1 className="forums-title">
              {filterMovieId ? movies.find((m) => m.id === filterMovieId)?.title : 'All Discussions'}
            </h1>
            <span className="forums-total">{displayed.length} comments</span>
          </div>

          {/* Post form */}
          <form className="comment-form" onSubmit={handlePost}>
            <div className="forum-selects">
              <select
                className="movie-select"
                value={selectedId || ''}
                onChange={(e) => setSelectedId(Number(e.target.value))}
              >
                <option value="">— Select a movie to comment on —</option>
                {movies.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
              <input
                className="comment-name-input"
                placeholder="Your name (optional)"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                maxLength={30}
              />
            </div>
            <div className="comment-input-row">
              <textarea
                className="comment-input"
                placeholder="Share your thoughts with the community..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <button type="submit" className="comment-submit" disabled={!text.trim() || !selectedId}>
                Post
              </button>
            </div>
          </form>

          {/* Feed */}
          <div className="comments-list">
            {displayed.length === 0 && (
              <p className="no-comments">No comments yet. Start the conversation!</p>
            )}
            {displayed.map((c) => (
              <div key={c.id} className="comment-card">
                <div className="comment-av" style={{ background: `hsl(${c.id * 37 % 360}, 50%, 35%)` }}>
                  {c.user[0].toUpperCase()}
                </div>
                <div className="comment-body">
                  <div className="comment-header">
                    <span className="comment-user">{c.user}</span>
                    <span
                      className="comment-movie-tag"
                      onClick={() => { addToRecent(c.movieId); navigate(`/movie/${c.movieId}`); }}
                    >
                      {c.movieTitle}
                    </span>
                    <span className="comment-date">{c.date}</span>
                  </div>
                  <p className="comment-text">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

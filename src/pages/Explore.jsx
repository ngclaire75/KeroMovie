import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import logo from '../../images/keromovielogo.png';
import Sidebar from '../components/sidebar/Sidebar';
import MovieGrid from '../components/MovieGrid/MovieGrid';

const GENRES = ['Trending Now', 'Action', 'Comedy', 'Horror', 'Romance', 'Sci-Fi', 'Thriller'];

export default function Explore() {
  const [selectedGenre, setSelectedGenre] = useState('Trending Now');
  const [inputValue, setInputValue]       = useState('');
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchOpen, setSearchOpen]       = useState(false);
  const debounceRef = useRef(null);
  const searchInputRef = useRef(null);

  function handleSearchChange(e) {
    const val = e.target.value;
    setInputValue(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(val.trim());
    }, 350);
  }

  function clearSearch() {
    setInputValue('');
    setSearchQuery('');
    clearTimeout(debounceRef.current);
  }

  function openSearch() {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 30);
  }

  function handleSearchBlur() {
    if (!inputValue) setSearchOpen(false);
  }

  return (
    <div className="home">
      <div className="home-bg-glow" />

      {/* Navbar */}
      <nav className="h-nav">
        <div className="h-logo">
          <img src={logo} alt="KeroMovie" className="h-logo-img" />
        </div>
        <ul className="h-center-links">
          <li className="h-nav-item active">
            <a href="#">Explore</a>
          </li>
          <li className="h-nav-item">
            <Link to="/browse">Movies</Link>
          </li>
          <li className="h-nav-item">
            <Link to="/forums">Forum</Link>
          </li>
        </ul>

        <div className={`h-search${searchOpen ? ' h-search-open' : ''}`}>
          <button className="h-search-icon-btn" onClick={openSearch} aria-label="Search">
            <svg className="h-search-icon" width="15" height="15" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <input
            ref={searchInputRef}
            className="h-search-input"
            type="text"
            placeholder="Search movies..."
            value={inputValue}
            onChange={handleSearchChange}
            onBlur={handleSearchBlur}
          />
          {inputValue && (
            <button className="h-search-clear" onClick={clearSearch} aria-label="Clear">
              <svg width="12" height="12" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </nav>

      {/* Mobile genre strip */}
      <div className="mobile-genre-strip">
        {GENRES.map(g => (
          <button
            key={g}
            className={`mobile-genre-pill${selectedGenre === g ? ' active' : ''}`}
            onClick={() => { setSelectedGenre(g); clearSearch(); }}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Below nav: sidebar + scrollable content */}
      <div className="home-body">
        <Sidebar selectedGenre={selectedGenre} onSelect={setSelectedGenre} />
        <main className="home-main">
          <MovieGrid genre={selectedGenre} searchQuery={searchQuery} />
        </main>
      </div>
    </div>
  );
}

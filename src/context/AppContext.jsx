import { createContext, useContext, useState, useEffect } from 'react';
import { initialComments } from '../data/movies';
import { auth } from '../lib/firebase';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [bookmarks, setBookmarks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('km_bookmarks')) || []; } catch { return []; }
  });

  const [comments, setComments] = useState(() => {
    try { return JSON.parse(localStorage.getItem('km_comments')) || initialComments; } catch { return initialComments; }
  });

  const [ratings, setRatings] = useState(() => {
    try { return JSON.parse(localStorage.getItem('km_ratings')) || {}; } catch { return {}; }
  });

  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('km_recent')) || []; } catch { return []; }
  });

  const [currentUser, setCurrentUser] = useState('Guest');

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(user => {
      if (user) {
        setCurrentUser(
          user.displayName?.split(' ')[0] ||
          user.email?.split('@')[0] ||
          'User'
        );
      } else {
        setCurrentUser('Guest');
      }
    });
    return unsub;
  }, []);

  useEffect(() => { localStorage.setItem('km_bookmarks', JSON.stringify(bookmarks)); }, [bookmarks]);
  useEffect(() => { localStorage.setItem('km_comments', JSON.stringify(comments)); }, [comments]);
  useEffect(() => { localStorage.setItem('km_ratings', JSON.stringify(ratings)); }, [ratings]);
  useEffect(() => { localStorage.setItem('km_recent', JSON.stringify(recentlyViewed)); }, [recentlyViewed]);

  const addBookmark    = (id) => { if (!bookmarks.includes(id)) setBookmarks(p => [...p, id]); };
  const removeBookmark = (id) => setBookmarks(p => p.filter(b => b !== id));
  const isBookmarked   = (id) => bookmarks.includes(id);

  const addComment = (movieId, text) => {
    const comment = {
      id: Date.now(),
      user: currentUser,
      text,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    };
    setComments(p => ({ ...p, [movieId]: [...(p[movieId] || []), comment] }));
  };

  const addRating = (movieId, score, movieTitle) => {
    setRatings(p => ({
      ...p,
      [movieId]: {
        score,
        movieTitle,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      },
    }));
  };

  const addToRecent = (id) => {
    setRecentlyViewed(p => [id, ...p.filter(x => x !== id)].slice(0, 6));
  };

  return (
    <AppContext.Provider value={{
      bookmarks, addBookmark, removeBookmark, isBookmarked,
      comments, addComment,
      ratings, addRating,
      recentlyViewed, addToRecent,
      currentUser,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);

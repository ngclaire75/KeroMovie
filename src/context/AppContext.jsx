import { createContext, useContext, useState, useEffect } from 'react';
import { initialComments } from '../data/movies';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [bookmarks, setBookmarks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('km_bookmarks')) || []; } catch { return []; }
  });

  const [comments, setComments] = useState(() => {
    try { return JSON.parse(localStorage.getItem('km_comments')) || initialComments; } catch { return initialComments; }
  });

  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('km_recent')) || []; } catch { return []; }
  });

  const [currentUser] = useState('Guest');

  useEffect(() => { localStorage.setItem('km_bookmarks', JSON.stringify(bookmarks)); }, [bookmarks]);
  useEffect(() => { localStorage.setItem('km_comments', JSON.stringify(comments)); }, [comments]);
  useEffect(() => { localStorage.setItem('km_recent', JSON.stringify(recentlyViewed)); }, [recentlyViewed]);

  const addBookmark = (id) => { if (!bookmarks.includes(id)) setBookmarks((p) => [...p, id]); };
  const removeBookmark = (id) => setBookmarks((p) => p.filter((b) => b !== id));
  const isBookmarked = (id) => bookmarks.includes(id);

  const addComment = (movieId, text) => {
    const comment = { id: Date.now(), user: currentUser, text, date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) };
    setComments((p) => ({ ...p, [movieId]: [...(p[movieId] || []), comment] }));
  };

  const addToRecent = (id) => {
    setRecentlyViewed((p) => [id, ...p.filter((x) => x !== id)].slice(0, 6));
  };

  return (
    <AppContext.Provider value={{ bookmarks, addBookmark, removeBookmark, isBookmarked, comments, addComment, recentlyViewed, addToRecent, currentUser }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);

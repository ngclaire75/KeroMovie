export const movies = [
  {
    id: 1,
    title: 'The Dark Knight',
    year: 2008,
    genre: ['Action', 'Crime'],
    director: 'Christopher Nolan',
    rating: 9.0,
    duration: '152 min',
    synopsis:
      'When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice. As the Joker pushes Gotham to anarchy, Batman must decide whether he can protect the city without compromising his ideals.',
    cast: ['Christian Bale', 'Heath Ledger', 'Aaron Eckhart', 'Michael Caine'],
    colorClass: 'poster-dk',
    featured: true,
  },
  {
    id: 2,
    title: 'Inception',
    year: 2010,
    genre: ['Sci-Fi', 'Thriller'],
    director: 'Christopher Nolan',
    rating: 8.8,
    duration: '148 min',
    synopsis:
      'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a CEO. But the deeper they go, the more dangerous the dream becomes — and the line between reality and imagination blurs.',
    cast: ['Leonardo DiCaprio', 'Joseph Gordon-Levitt', 'Elliot Page', 'Tom Hardy'],
    colorClass: 'poster-inception',
    featured: false,
  },
  {
    id: 3,
    title: 'Interstellar',
    year: 2014,
    genre: ['Sci-Fi', 'Drama'],
    director: 'Christopher Nolan',
    rating: 8.6,
    duration: '169 min',
    synopsis:
      "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival. With Earth's future bleak, Cooper joins a mission through a wormhole to find a new home for humanity before time runs out.",
    cast: ['Matthew McConaughey', 'Anne Hathaway', 'Jessica Chastain', 'Matt Damon'],
    colorClass: 'poster-interstellar',
    featured: false,
  },
  {
    id: 4,
    title: 'Parasite',
    year: 2019,
    genre: ['Thriller', 'Drama'],
    director: 'Bong Joon-ho',
    rating: 8.5,
    duration: '132 min',
    synopsis:
      'Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan. All four members of the Kim family con their way into becoming employed by the Parks, but a discovery leads to an unexpected, irreversible chain of events.',
    cast: ['Song Kang-ho', 'Lee Sun-kyun', 'Cho Yeo-jeong', 'Choi Woo-shik'],
    colorClass: 'poster-parasite',
    featured: false,
  },
  {
    id: 5,
    title: 'Dune',
    year: 2021,
    genre: ['Sci-Fi', 'Adventure'],
    director: 'Denis Villeneuve',
    rating: 8.0,
    duration: '155 min',
    synopsis:
      'Paul Atreides, a brilliant and gifted young man born into a great destiny beyond his understanding, must travel to the most dangerous planet in the universe to ensure the future of his family and his people. As malevolent forces explode into conflict, only those who can conquer their fear will survive.',
    cast: ['Timothée Chalamet', 'Rebecca Ferguson', 'Oscar Isaac', 'Zendaya'],
    colorClass: 'poster-dune',
    featured: false,
  },
  {
    id: 6,
    title: 'The Matrix',
    year: 1999,
    genre: ['Sci-Fi', 'Action'],
    director: 'The Wachowskis',
    rating: 8.7,
    duration: '136 min',
    synopsis:
      'When a beautiful stranger leads computer hacker Neo to a forbidding underworld, he discovers the shocking truth — the life he knows is the elaborate deception of an evil cyber-intelligence. Neo joins a group of rebels to fight back against the machines controlling reality itself.',
    cast: ['Keanu Reeves', 'Laurence Fishburne', 'Carrie-Anne Moss', 'Hugo Weaving'],
    colorClass: 'poster-matrix',
    featured: false,
  },
];

export const getMovie = (id) => movies.find((m) => m.id === parseInt(id));

export const initialComments = {
  1: [
    { id: 1, user: 'MovieFan99', text: "Heath Ledger's Joker is the greatest villain performance in cinema history. Absolutely terrifying!", date: 'Jan 15, 2024' },
    { id: 2, user: 'CinephileX', text: 'The screenplay is flawless. Every scene serves the story. A masterpiece that holds up perfectly.', date: 'Jan 20, 2024' },
    { id: 3, user: 'NightOwl', text: 'The Joker\'s "why so serious" scene still gives me chills. Rewatched it 10+ times.', date: 'Feb 3, 2024' },
  ],
  2: [
    { id: 4, user: 'DreamWalker', text: 'Still debating whether the top fell at the end. The ambiguity is what makes it perfect.', date: 'Feb 1, 2024' },
    { id: 5, user: 'FilmScholar', text: 'The rotating hallway fight scene alone is worth the price of admission. Incredible practical effects.', date: 'Feb 12, 2024' },
  ],
  3: [
    { id: 6, user: 'StargazerX', text: "The docking scene with Zimmer's score made me cry in the cinema. Absolute emotional devastation.", date: 'Feb 10, 2024' },
    { id: 7, user: 'ScienceFan', text: 'Kip Thorne ensured the black hole depiction was scientifically accurate. This film educated as much as it entertained.', date: 'Feb 18, 2024' },
  ],
  4: [
    { id: 8, user: 'WorldCinema', text: 'Bong Joon-ho is a genius. The way the film transitions from comedy to horror is unmatched.', date: 'Mar 5, 2024' },
  ],
  6: [
    { id: 9, user: 'RetroFan', text: '"There is no spoon." Still one of the greatest lines in film history. A genre-defining masterpiece.', date: 'Mar 10, 2024' },
  ],
};

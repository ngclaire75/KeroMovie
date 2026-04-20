import { useState } from 'react';
import './sidebar.css';
import * as TrendingNow from './items/TrendingNow';
import * as Action from './items/Action';
import * as Comedy from './items/Comedy';
import * as Horror from './items/Horror';
import * as Romance from './items/Romance';
import * as SciFi from './items/SciFi';
import * as Thriller from './items/Thriller';

const EXPANDABLE_ITEMS = [Action, Comedy, Horror, Romance, SciFi, Thriller];

export default function Sidebar({ selectedGenre, onSelect }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside className="h-sidebar">
      <div className="h-sidebar-wrap">
        <ul className="h-sidebar-links">

          {/* Always visible: Trending Now */}
          <li className={`h-nav-item${selectedGenre === TrendingNow.label ? ' active' : ''}`}>
            <button className="h-sidebar-link" onClick={() => onSelect(TrendingNow.label)}>
              <span className="h-sidebar-icon">{TrendingNow.icon}</span>
              {TrendingNow.label}
            </button>
          </li>

          {/* Expandable genre items */}
          <div className={`sidebar-expandable${expanded ? ' open' : ''}`}>
            {EXPANDABLE_ITEMS.map(({ label, icon }) => (
              <li key={label} className={`h-nav-item${selectedGenre === label ? ' active' : ''}`}>
                <button className="h-sidebar-link" onClick={() => onSelect(label)}>
                  <span className="h-sidebar-icon">{icon}</span>
                  {label}
                </button>
              </li>
            ))}
          </div>

        </ul>

        {/* Toggle chevron — outside the glass panel */}
        <div className="sidebar-chevron-item">
          <button
            className="sidebar-chevron-btn"
            onClick={() => setExpanded((p) => !p)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              style={{
                transition: 'transform 0.45s cubic-bezier(0.4,0,0.2,1)',
                transform: expanded ? 'rotate(180deg)' : 'none',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}

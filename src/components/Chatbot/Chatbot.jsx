import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import chatbotImg from '../../../images/chatbot2.png';
import miffyImg from '../../../images/miffy.png';
import './Chatbot.css';

const IcoClose = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IcoSend = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const IcoArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);
const IcoAttach = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
);
const IcoX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="10" height="10">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const WELCOME = "Hi! I'm KeroBot. Ask me anything about KeroMovie — exploring movies, the soundtrack player, community forum, or your account. You can also drop an image or audio file for me to analyze!";

async function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result.split(',')[1];
      resolve({ name: file.name, type: file.type, base64: b64, preview: reader.result });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Chatbot({ onHome = false }) {
  const navigate = useNavigate();
  const [open, setOpen]           = useState(false);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [messages, setMessages]   = useState([{ role: 'assistant', content: WELCOME }]);
  const [attachments, setAttachments] = useState([]);
  const [dragging, setDragging]   = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);
  const fileRef     = useRef(null);
  const dragCounter = useRef(0);

  const bubbleTimer = useRef(null);

  useEffect(() => () => clearTimeout(bubbleTimer.current), []);

  // Auto-show bubble on mobile on every page visit
  useEffect(() => {
    if (window.matchMedia('(max-width: 480px)').matches) {
      bubbleTimer.current = setTimeout(() => setShowBubble(true), 600);
    }
  }, []);

  function showHint() {
    if (open || window.matchMedia('(max-width: 480px)').matches) return;
    setShowBubble(true);
  }
  function hideHint() {
    setShowBubble(false);
    clearTimeout(bubbleTimer.current);
  }
  function touchHint() {}

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [messages, open]);

  const processFiles = useCallback(async (files) => {
    const MAX = 5 * 1024 * 1024;
    const valid = Array.from(files).filter(f => f.size <= MAX);
    if (!valid.length) return;
    const processed = await Promise.all(valid.map(readFileAsBase64));
    setAttachments(prev => [...prev, ...processed].slice(0, 4));
  }, []);

  function onDragEnter(e) {
    e.preventDefault();
    dragCounter.current++;
    setDragging(true);
  }
  function onDragLeave(e) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }
  function onDragOver(e) { e.preventDefault(); }
  function onDrop(e) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  }

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if ((!text && attachments.length === 0) || loading) return;
    setInput('');
    const sentAttachments = attachments;
    setAttachments([]);

    const history = messages
      .filter(m => m.role !== 'system')
      .slice(-8)
      .map(({ role, content }) => ({ role, content }));

    const displayContent = text || `[${sentAttachments.map(a => a.name).join(', ')}]`;
    setMessages(prev => [...prev, { role: 'user', content: displayContent, attachments: sentAttachments }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history,
          attachments: sentAttachments.map(({ name, type, base64 }) => ({ name, type, base64 })),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        navigate: data.navigate ?? null,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I'm having trouble right now. Please try again in a moment.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  function goTo(nav) {
    navigate(nav.path);
    setOpen(false);
  }

  return (
    <>
      {showBubble && !open && (
        <div className="kb-bubble-hint">Ask KeroBot for Help!</div>
      )}

      <button
        className={`kb-fab${onHome ? ' kb-fab--home' : ''}`}
        onClick={() => { setOpen(o => !o); hideHint(); }}
        onMouseEnter={showHint}
        onMouseLeave={hideHint}
        onTouchStart={touchHint}
        aria-label={open ? 'Close KeroBot' : 'Open KeroBot'}
      >
        <img src={chatbotImg} alt="KeroBot" className="kb-fab-img" />
      </button>

      {open && (
        <div
          className={`kb-panel${dragging ? ' kb-panel--drag' : ''}`}
          role="dialog"
          aria-label="KeroBot chat"
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          {dragging && <div className="kb-drag-overlay">Drop file here</div>}

          <div className="kb-header">
            <div className="kb-header-left">
              <img src={miffyImg} alt="KeroBot" className="kb-avatar" />
              <div className="kb-header-text">
                <p className="kb-bot-name">KeroBot</p>
                <p className="kb-bot-sub">KeroMovie Assistant</p>
              </div>
            </div>
            <button className="kb-header-close" onClick={() => setOpen(false)} aria-label="Close">
              <IcoClose />
            </button>
          </div>

          <div className="kb-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`kb-bubble-row kb-bubble-row--${msg.role}`}>
                <div className={`kb-bubble kb-bubble--${msg.role}`}>
                  {msg.attachments?.length > 0 && (
                    <div className="kb-attach-preview">
                      {msg.attachments.map((a, j) =>
                        a.type.startsWith('image/') ? (
                          <img key={j} src={a.preview} alt={a.name} className="kb-attach-thumb" />
                        ) : (
                          <span key={j} className="kb-attach-file">{a.name}</span>
                        )
                      )}
                    </div>
                  )}
                  <p>{msg.content}</p>
                  {msg.navigate && (
                    <button className="kb-nav-btn" onClick={() => goTo(msg.navigate)}>
                      Go to {msg.navigate.label} <IcoArrow />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="kb-bubble-row kb-bubble-row--assistant">
                <div className="kb-bubble kb-bubble--assistant kb-bubble--typing">
                  <span className="kb-dot" /><span className="kb-dot" /><span className="kb-dot" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {attachments.length > 0 && (
            <div className="kb-attachments-row">
              {attachments.map((a, i) => (
                <div key={i} className="kb-attach-chip">
                  {a.type.startsWith('image/') ? (
                    <img src={a.preview} alt={a.name} className="kb-chip-thumb" />
                  ) : (
                    <span className="kb-chip-name">{a.name}</span>
                  )}
                  <button
                    className="kb-chip-remove"
                    onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                    aria-label="Remove"
                  >
                    <IcoX />
                  </button>
                </div>
              ))}
            </div>
          )}

          <form className="kb-input-row" onSubmit={send}>
            <input
              ref={inputRef}
              className="kb-input"
              type="text"
              placeholder="Ask about KeroMovie…"
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
              autoComplete="off"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*,audio/*,.txt,.pdf"
              multiple
              style={{ display: 'none' }}
              onChange={e => { processFiles(e.target.files); e.target.value = ''; }}
            />
            <button
              type="button"
              className="kb-attach-btn"
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              aria-label="Attach file"
            >
              <IcoAttach />
            </button>
            <button
              type="submit"
              className="kb-send-btn"
              disabled={loading || (!input.trim() && attachments.length === 0)}
              aria-label="Send"
            >
              <IcoSend />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

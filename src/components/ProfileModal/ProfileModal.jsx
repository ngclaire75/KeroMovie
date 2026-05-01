import { useState, useRef, useEffect } from 'react';
import { auth } from '../../lib/firebase';
import { getProfile, updateUsername, updateUserPassword, updateUserEmail } from '../../lib/authHelpers';
import { useApp } from '../../context/AppContext';
import './ProfileModal.css';

const COUNTRIES = [
  { code: '', label: 'All Countries' },
  { code: 'AU', label: 'Australia' },
  { code: 'BR', label: 'Brazil' },
  { code: 'CA', label: 'Canada' },
  { code: 'CN', label: 'China' },
  { code: 'EG', label: 'Egypt' },
  { code: 'FR', label: 'France' },
  { code: 'DE', label: 'Germany' },
  { code: 'HK', label: 'Hong Kong' },
  { code: 'IN', label: 'India' },
  { code: 'ID', label: 'Indonesia' },
  { code: 'IT', label: 'Italy' },
  { code: 'JP', label: 'Japan' },
  { code: 'MY', label: 'Malaysia' },
  { code: 'MX', label: 'Mexico' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'PH', label: 'Philippines' },
  { code: 'PT', label: 'Portugal' },
  { code: 'RU', label: 'Russia' },
  { code: 'SA', label: 'Saudi Arabia' },
  { code: 'SG', label: 'Singapore' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'KR', label: 'South Korea' },
  { code: 'ES', label: 'Spain' },
  { code: 'SE', label: 'Sweden' },
  { code: 'TW', label: 'Taiwan' },
  { code: 'TH', label: 'Thailand' },
  { code: 'TR', label: 'Turkey' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
];

const GENRES = [
  { id: 28,    label: 'Action' },
  { id: 12,    label: 'Adventure' },
  { id: 16,    label: 'Animation' },
  { id: 35,    label: 'Comedy' },
  { id: 80,    label: 'Crime' },
  { id: 99,    label: 'Documentary' },
  { id: 18,    label: 'Drama' },
  { id: 14,    label: 'Fantasy' },
  { id: 27,    label: 'Horror' },
  { id: 10402, label: 'Music' },
  { id: 9648,  label: 'Mystery' },
  { id: 10749, label: 'Romance' },
  { id: 878,   label: 'Sci-Fi' },
  { id: 53,    label: 'Thriller' },
  { id: 10752, label: 'War' },
  { id: 37,    label: 'Western' },
];

const IcoX      = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcoCheck  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>;
const IcoCamera = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
const IcoPhoto  = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const IcoGlobe= () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const IcoUser = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IcoLock = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IcoMail = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 8l10 6 10-6"/></svg>;

export default function ProfileModal({ profile, onClose, onProfileUpdate }) {
  const { preferredCountry, setPreferredCountry, preferredGenres, setPreferredGenres,
          profilePhoto, setProfilePhoto } = useApp();
  const [tab, setTab] = useState('account');

  // Camera state
  const [cameraOpen, setCameraOpen] = useState(false);
  const cameraVideoRef  = useRef(null);
  const cameraStreamRef = useRef(null);
  const photoInputRef   = useRef(null);

  // Country dropdown state
  const [countryOpen, setCountryOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!countryOpen) return;
    function onOutsideClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setCountryOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutsideClick);
    return () => document.removeEventListener('mousedown', onOutsideClick);
  }, [countryOpen]);

  useEffect(() => {
    if (cameraOpen && cameraVideoRef.current && cameraStreamRef.current) {
      cameraVideoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [cameraOpen]);

  useEffect(() => {
    return () => { cameraStreamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  // Account form state
  const [newUsername,      setNewUsername]      = useState('');
  const [currentPw,        setCurrentPw]        = useState('');
  const [newPw,            setNewPw]            = useState('');
  const [confirmPw,        setConfirmPw]        = useState('');
  const [newEmail,         setNewEmail]         = useState('');
  const [emailPw,          setEmailPw]          = useState('');
  const [saving,           setSaving]           = useState('');
  const [successMsg,       setSuccessMsg]       = useState('');
  const [errorMsg,         setErrorMsg]         = useState('');

  function flashSuccess(msg) {
    setSuccessMsg(msg); setErrorMsg('');
    setTimeout(() => setSuccessMsg(''), 3500);
  }
  function flashError(msg) {
    setErrorMsg(msg); setSuccessMsg('');
    setTimeout(() => setErrorMsg(''), 4000);
  }

  async function handleUsernameChange(e) {
    e.preventDefault();
    if (!newUsername.trim()) return;
    setSaving('username');
    try {
      await updateUsername(auth.currentUser.uid, newUsername.trim());
      onProfileUpdate?.({ ...profile, username: newUsername.trim() });
      setNewUsername('');
      flashSuccess('Username updated successfully.');
    } catch (err) {
      flashError(err.message || 'Failed to update username.');
    } finally { setSaving(''); }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (!currentPw || !newPw) return;
    if (newPw !== confirmPw) { flashError('New passwords do not match.'); return; }
    if (newPw.length < 6)    { flashError('Password must be at least 6 characters.'); return; }
    setSaving('password');
    try {
      await updateUserPassword(currentPw, newPw);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      flashSuccess('Password updated successfully.');
    } catch (err) {
      flashError(err.code === 'auth/wrong-password' ? 'Current password is incorrect.' : err.message || 'Failed to update password.');
    } finally { setSaving(''); }
  }

  async function handleEmailChange(e) {
    e.preventDefault();
    if (!newEmail.trim() || !emailPw) return;
    setSaving('email');
    try {
      await updateUserEmail(emailPw, newEmail.trim());
      setNewEmail(''); setEmailPw('');
      flashSuccess('Verification email sent. Click the link in your inbox to complete the change.');
    } catch (err) {
      flashError(err.code === 'auth/wrong-password' ? 'Current password is incorrect.' : err.message || 'Failed to update email.');
    } finally { setSaving(''); }
  }

  function resizeToDataUrl(source) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const MAX = 320;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else       { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.src = typeof source === 'string' ? source : URL.createObjectURL(source);
    });
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeToDataUrl(file);
    setProfilePhoto(dataUrl);
    flashSuccess('Profile photo updated.');
    e.target.value = '';
  }

  async function openCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
    } catch {
      flashError('Camera access denied. Enable camera permission.');
    }
  }

  function closeCamera() {
    cameraStreamRef.current?.getTracks().forEach(t => t.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
  }

  async function capturePhoto() {
    const video = cameraVideoRef.current;
    if (!video) return;
    const MAX = 320;
    let w = video.videoWidth || 320, h = video.videoHeight || 320;
    if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
    else       { w = Math.round(w * MAX / h); h = MAX; }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(video, 0, 0, w, h);
    setProfilePhoto(canvas.toDataURL('image/jpeg', 0.82));
    closeCamera();
    flashSuccess('Profile photo updated.');
  }

  function toggleGenre(id) {
    setPreferredGenres(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  }

  const displayName = profile?.username || profile?.firstName || 'User';
  const initial     = displayName.charAt(0).toUpperCase();

  return (
    <>
      <div className="pm-overlay" onClick={onClose} />
      <div className="pm-panel">

        {/* Header */}
        <div className="pm-header">
          <div className="pm-avatar pm-avatar--clickable" onClick={() => photoInputRef.current?.click()} title="Change photo">
            {profilePhoto
              ? <img src={profilePhoto} alt="Profile" className="pm-avatar-img" />
              : initial
            }
            <span className="pm-avatar-edit-overlay"><IcoCamera /></span>
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
          <div className="pm-user-info">
            <span className="pm-display-name">{displayName}</span>
            <span className="pm-user-email">{profile?.email || auth.currentUser?.email || ''}</span>
          </div>
          <button className="pm-close-btn" onClick={onClose} aria-label="Close"><IcoX /></button>
        </div>

        {/* Tabs */}
        <div className="pm-tabs">
          <button className={`pm-tab${tab === 'account' ? ' pm-tab--active' : ''}`} onClick={() => setTab('account')}>Account</button>
          <button className={`pm-tab${tab === 'prefs'   ? ' pm-tab--active' : ''}`} onClick={() => setTab('prefs')}>Preferences</button>
        </div>

        {/* Feedback messages */}
        {successMsg && <div className="pm-feedback pm-feedback--success"><IcoCheck />{successMsg}</div>}
        {errorMsg   && <div className="pm-feedback pm-feedback--error"><IcoX />{errorMsg}</div>}

        <div className="pm-body">

          {/* ── Account Tab ── */}
          {tab === 'account' && (
            <div className="pm-sections">

              {/* Profile Photo */}
              <div className="pm-section">
                <div className="pm-section-label"><IcoPhoto />Profile Photo</div>
                <div className="pm-photo-actions">
                  <button type="button" className="pm-photo-btn" onClick={() => photoInputRef.current?.click()}>
                    <IcoPhoto /> Upload
                  </button>
                  <button type="button" className="pm-photo-btn" onClick={cameraOpen ? closeCamera : openCamera}>
                    <IcoCamera /> {cameraOpen ? 'Cancel' : 'Camera'}
                  </button>
                  {profilePhoto && (
                    <button type="button" className="pm-photo-btn pm-photo-btn--remove" onClick={() => { setProfilePhoto(''); flashSuccess('Photo removed.'); }}>
                      <IcoX /> Remove
                    </button>
                  )}
                </div>
                {cameraOpen && (
                  <div className="pm-camera-wrap">
                    <video ref={cameraVideoRef} autoPlay muted playsInline className="pm-camera-video" />
                    <button type="button" className="pm-btn pm-btn--primary" style={{ marginTop: '10px' }} onClick={capturePhoto}>
                      Capture Photo
                    </button>
                  </div>
                )}
              </div>

              {/* Username */}
              <div className="pm-section">
                <div className="pm-section-label"><IcoUser />Change Username</div>
                <p className="pm-current-val">Current: <strong>{profile?.username || '—'}</strong></p>
                <form className="pm-form" onSubmit={handleUsernameChange}>
                  <div className="pm-field">
                    <input
                      className="pm-input"
                      type="text"
                      placeholder="New username"
                      value={newUsername}
                      onChange={e => setNewUsername(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                  <button type="submit" className="pm-btn pm-btn--primary" disabled={saving === 'username' || !newUsername.trim()}>
                    {saving === 'username' ? 'Saving…' : 'Update Username'}
                  </button>
                </form>
              </div>

              {/* Password */}
              <div className="pm-section">
                <div className="pm-section-label"><IcoLock />Change Password</div>
                <form className="pm-form" onSubmit={handlePasswordChange}>
                  <div className="pm-field">
                    <input className="pm-input" type="password" placeholder="Current password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} autoComplete="current-password" />
                  </div>
                  <div className="pm-field">
                    <input className="pm-input" type="password" placeholder="New password" value={newPw} onChange={e => setNewPw(e.target.value)} autoComplete="new-password" />
                  </div>
                  <div className="pm-field">
                    <input className="pm-input" type="password" placeholder="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} autoComplete="new-password" />
                  </div>
                  <button type="submit" className="pm-btn pm-btn--primary" disabled={saving === 'password' || !currentPw || !newPw || !confirmPw}>
                    {saving === 'password' ? 'Saving…' : 'Update Password'}
                  </button>
                </form>
              </div>

              {/* Email */}
              <div className="pm-section">
                <div className="pm-section-label"><IcoMail />Change Email</div>
                <p className="pm-current-val">Current: <strong>{profile?.email || auth.currentUser?.email || '—'}</strong></p>
                <form className="pm-form" onSubmit={handleEmailChange}>
                  <div className="pm-field">
                    <input className="pm-input" type="email" placeholder="New email address" value={newEmail} onChange={e => setNewEmail(e.target.value)} autoComplete="email" />
                  </div>
                  <div className="pm-field">
                    <input className="pm-input" type="password" placeholder="Current password to confirm" value={emailPw} onChange={e => setEmailPw(e.target.value)} autoComplete="current-password" />
                  </div>
                  <button type="submit" className="pm-btn pm-btn--primary" disabled={saving === 'email' || !newEmail.trim() || !emailPw}>
                    {saving === 'email' ? 'Saving…' : 'Update Email'}
                  </button>
                </form>
              </div>

            </div>
          )}

          {/* ── Preferences Tab ── */}
          {tab === 'prefs' && (
            <div className="pm-sections">

              {/* Country */}
              <div className="pm-section">
                <div className="pm-section-label"><IcoGlobe />Preferred Country</div>
                <p className="pm-section-hint">Movies on the dashboard and explore page will be tailored to this country.</p>
                <div className="pm-dropdown" ref={dropdownRef}>
                  <button
                    type="button"
                    className="pm-dropdown-trigger"
                    onClick={() => setCountryOpen(o => !o)}
                  >
                    <span>{COUNTRIES.find(c => c.code === preferredCountry)?.label || 'All Countries'}</span>
                    <span className={`pm-dropdown-arrow${countryOpen ? ' pm-dropdown-arrow--open' : ''}`} />
                  </button>
                  <div className={`pm-dropdown-menu${countryOpen ? ' pm-dropdown-menu--open' : ''}`}>
                    {COUNTRIES.map(c => (
                      <button
                        key={c.code}
                        type="button"
                        className={`pm-dropdown-item${preferredCountry === c.code ? ' pm-dropdown-item--active' : ''}`}
                        onClick={() => { setPreferredCountry(c.code); setCountryOpen(false); }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                {preferredCountry && (
                  <p className="pm-active-flag">
                    Showing movies from <strong>{COUNTRIES.find(c => c.code === preferredCountry)?.label}</strong>
                  </p>
                )}
              </div>

              {/* Genres */}
              <div className="pm-section">
                <div className="pm-section-label">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  Preferred Genres
                </div>
                <p className="pm-section-hint">Select all that apply. Your taste profile on the dashboard updates based on your picks.</p>
                <div className="pm-genre-grid">
                  {GENRES.map(g => (
                    <button
                      key={g.id}
                      type="button"
                      className={`pm-genre-chip${preferredGenres.includes(g.id) ? ' pm-genre-chip--active' : ''}`}
                      onClick={() => toggleGenre(g.id)}
                    >
                      {preferredGenres.includes(g.id) && <IcoCheck />}
                      {g.label}
                    </button>
                  ))}
                </div>
                {preferredGenres.length > 0 && (
                  <button type="button" className="pm-btn pm-btn--ghost" onClick={() => setPreferredGenres([])}>
                    Clear all genres
                  </button>
                )}
              </div>

            </div>
          )}

        </div>
      </div>
    </>
  );
}

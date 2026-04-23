import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../../images/keromovielogo.png';
import bgGif from '../../images/loginbackground.gif';
import {
  signUp, signIn, signInWithGoogle, signInWithApple,
  forgotPassword, forgotUsername,
  checkRedirectResult,
} from '../lib/authHelpers';
import './login.css';

const GoogleIcon = () => (
  <svg className="lp-social-icon" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const AppleIcon = () => (
  <svg className="lp-social-icon" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

const SocialButtons = ({ onGoogle, onApple, loading }) => (
  <div className="lp-social-inline">
    <p className="lp-social-title">Or continue with</p>
    <button type="button" className="lp-social-btn" onClick={onGoogle} disabled={loading}>
      <GoogleIcon /> Sign in with Google
    </button>
    <button type="button" className="lp-social-btn" onClick={onApple} disabled={loading}>
      <AppleIcon /> Sign in with Apple
    </button>
  </div>
);

export default function Login() {
  const navigate = useNavigate();
  const [view, setView]       = useState('signup');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [info, setInfo]       = useState('');
  const [toast, setToast]     = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const [foundUsername, setFoundUsername] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', username: '', email: '', password: '' });

  // Allow document scroll on login page (overrides explore.css height:100% on html/body)
  useEffect(() => {
    document.documentElement.classList.add('lp-scroll-unlock');
    document.body.classList.add('lp-scroll-unlock');
    return () => {
      document.documentElement.classList.remove('lp-scroll-unlock');
      document.body.classList.remove('lp-scroll-unlock');
    };
  }, []);

  // Handle redirect result on mount (fallback for popup-blocked browsers)
  useEffect(() => {
    checkRedirectResult()
      .then(user => { if (user) navigate('/browse'); })
      .catch(e => setError(e.message || 'Sign-in failed.'));
  }, []);

  // Toast display
  useEffect(() => {
    if (!error) return;
    setToast(error);
    setToastVisible(true);
    const hide  = setTimeout(() => setToastVisible(false), 4000);
    const clear = setTimeout(() => { setToast(''); setError(''); }, 4400);
    return () => { clearTimeout(hide); clearTimeout(clear); };
  }, [error]);

  function change(e) { setForm(f => ({ ...f, [e.target.name]: e.target.value })); }
  function reset() { setError(''); setInfo(''); }
  function go(v) { reset(); setView(v); }

  async function handleOAuth(fn) {
    reset(); setLoading(true);
    try {
      const user = await fn();
      if (user) navigate('/browse');
      // null means redirect was triggered — page will reload
    } catch (e) {
      setError(e.message || 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e) {
    e.preventDefault(); reset();
    if (!form.firstName.trim()) { setError('Please enter your first name.'); return; }
    if (!form.lastName.trim())  { setError('Please enter your last name.'); return; }
    if (!form.username.trim())  { setError('Please enter a username.'); return; }
    if (!form.email.trim())     { setError('Please enter your email.'); return; }
    if (!form.password)         { setError('Please enter a password.'); return; }
    setLoading(true);
    try {
      await signUp(form);
      go('login');
      setInfo('Account created! You can now log in.');
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Try logging in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err.message || 'Sign up failed. Please try again.');
      }
    } finally { setLoading(false); }
  }

  async function handleSignIn(e) {
    e.preventDefault(); reset();
    if (!form.email.trim()) { setError('Please enter your email.'); return; }
    if (!form.password)     { setError('Please enter your password.'); return; }
    setLoading(true);
    try {
      await signIn({ email: form.email, password: form.password });
      navigate('/browse');
    } catch (err) {
      if (err.message === 'INVALID_CREDENTIALS') setError('Incorrect email or password.');
      else setError(err.message || 'Login failed. Please try again.');
    } finally { setLoading(false); }
  }

  async function handleForgotPassword(e) {
    e.preventDefault(); reset();
    if (!form.email.trim()) { setError('Please enter your email.'); return; }
    setLoading(true);
    try {
      await forgotPassword(form.email);
      setInfo('Password reset email sent! Check your inbox.');
      go('sent');
    } catch (err) {
      if (err.message === 'NO_ACCOUNT') setError('No account found with this email.');
      else setError(err.message || 'Failed to send reset email.');
    } finally { setLoading(false); }
  }

  async function handleForgotUsername(e) {
    e.preventDefault(); reset();
    if (!form.email.trim()) { setError('Please enter your email.'); return; }
    setLoading(true);
    try {
      const username = await forgotUsername(form.email);
      setFoundUsername(username);
      go('username-found');
    } catch (err) {
      if (err.message === 'NO_ACCOUNT') setError('No account found with this email.');
      else setError(err.message || 'Failed to look up username.');
    } finally { setLoading(false); }
  }

  return (
    <>
      <div className="lp-bg">
        <img src={bgGif} alt="" className="lp-bg-img" />
        <div className="lp-bg-overlay" />
      </div>

      <div className="lp-page">
        <nav className="lp-nav">
          <Link to="/" className="lp-logo">
            <img src={logo} alt="KeroMovie" className="lp-logo-img" />
            <span className="lp-logo-text">
              <span className="lp-logo-kero">Kero</span><span className="lp-logo-movie">Movie</span>
            </span>
          </Link>
          <div className="lp-nav-tabs">
            <Link to="/" className="lp-tab">Home</Link>
            <Link to="/privacy" className="lp-tab">Privacy Notice</Link>
          </div>
        </nav>

        <div className="lp-layout">
          <div className="lp-left">

            {/* ── Sign Up ── */}
            {view === 'signup' && (
              <>
                <p className="lp-start">Start For Free</p>
                <h1 className="lp-heading">Create New Account</h1>
                <p className="lp-switch">
                  Already a member?{' '}
                  <button className="lp-switch-btn" onClick={() => go('login')}>Log In</button>
                </p>
                <form className="lp-form" onSubmit={handleSignUp} noValidate>
                  <div className="lp-row">
                    <div className="lp-field">
                      <label className="lp-label">First name</label>
                      <div className="lp-input-wrap">
                        <input className="lp-input" name="firstName" value={form.firstName} onChange={change} placeholder="First name" autoComplete="given-name" />
                        <svg className="lp-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                      </div>
                    </div>
                    <div className="lp-field">
                      <label className="lp-label">Last name</label>
                      <div className="lp-input-wrap">
                        <input className="lp-input" name="lastName" value={form.lastName} onChange={change} placeholder="Last name" autoComplete="family-name" />
                        <svg className="lp-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                      </div>
                    </div>
                  </div>
                  <div className="lp-field">
                    <label className="lp-label">Username</label>
                    <div className="lp-input-wrap">
                      <input className="lp-input" name="username" value={form.username} onChange={change} placeholder="Username" autoComplete="username" />
                      <svg className="lp-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    </div>
                  </div>
                  <div className="lp-field">
                    <label className="lp-label">Email</label>
                    <div className="lp-input-wrap">
                      <input className="lp-input" name="email" type="email" value={form.email} onChange={change} placeholder="Email" autoComplete="email" />
                      <svg className="lp-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 8l10 6 10-6"/></svg>
                    </div>
                  </div>
                  <div className="lp-field">
                    <label className="lp-label">Password</label>
                    <div className="lp-input-wrap">
                      <input className="lp-input" name="password" type="password" value={form.password} onChange={change} placeholder="Password" autoComplete="new-password" />
                    </div>
                  </div>
                  <button type="submit" className="lp-btn" disabled={loading}>{loading ? 'Creating…' : 'Create Account'}</button>
                  <SocialButtons onGoogle={() => handleOAuth(signInWithGoogle)} onApple={() => handleOAuth(signInWithApple)} loading={loading} />
                </form>
              </>
            )}

            {/* ── Log In ── */}
            {view === 'login' && (
              <>
                <p className="lp-start">Welcome Back</p>
                <h1 className="lp-heading">Log In</h1>
                <p className="lp-switch">
                  Not a member?{' '}
                  <button className="lp-switch-btn" onClick={() => go('signup')}>Sign Up</button>
                </p>
                {info && <p className="lp-info">{info}</p>}
                <form className="lp-form" onSubmit={handleSignIn} noValidate>
                  <div className="lp-field">
                    <label className="lp-label">Email</label>
                    <div className="lp-input-wrap">
                      <input className="lp-input" name="email" type="email" value={form.email} onChange={change} placeholder="Email" autoComplete="email" />
                      <svg className="lp-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 8l10 6 10-6"/></svg>
                    </div>
                  </div>
                  <div className="lp-field">
                    <label className="lp-label">Password</label>
                    <div className="lp-input-wrap">
                      <input className="lp-input" name="password" type="password" value={form.password} onChange={change} placeholder="Password" autoComplete="current-password" />
                    </div>
                  </div>
                  <div className="lp-forgot-row">
                    <button type="button" className="lp-link-btn" onClick={() => go('forgot-password')}>Forgot password?</button>
                    <button type="button" className="lp-link-btn" onClick={() => go('forgot-username')}>Forgot username?</button>
                  </div>
                  <button type="submit" className="lp-btn" disabled={loading}>{loading ? 'Logging in…' : 'Log In'}</button>
                  <SocialButtons onGoogle={() => handleOAuth(signInWithGoogle)} onApple={() => handleOAuth(signInWithApple)} loading={loading} />
                </form>
              </>
            )}

            {/* ── Forgot Password ── */}
            {view === 'forgot-password' && (
              <>
                <p className="lp-start">No worries</p>
                <h1 className="lp-heading">Reset Password</h1>
                <p className="lp-switch">
                  Remembered it?{' '}
                  <button className="lp-switch-btn" onClick={() => go('login')}>Back to Log In</button>
                </p>
                <form className="lp-form" onSubmit={handleForgotPassword} noValidate>
                  <div className="lp-field">
                    <label className="lp-label">Email</label>
                    <div className="lp-input-wrap">
                      <input className="lp-input" name="email" type="email" value={form.email} onChange={change} placeholder="Your email address" autoComplete="email" />
                      <svg className="lp-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 8l10 6 10-6"/></svg>
                    </div>
                  </div>
                  <button type="submit" className="lp-btn" disabled={loading}>{loading ? 'Sending…' : 'Send Reset Email'}</button>
                </form>
              </>
            )}

            {/* ── Forgot Username ── */}
            {view === 'forgot-username' && (
              <>
                <p className="lp-start">Let us help</p>
                <h1 className="lp-heading">Find Username</h1>
                <p className="lp-switch">
                  Remembered it?{' '}
                  <button className="lp-switch-btn" onClick={() => go('login')}>Back to Log In</button>
                </p>
                <form className="lp-form" onSubmit={handleForgotUsername} noValidate>
                  <div className="lp-field">
                    <label className="lp-label">Email</label>
                    <div className="lp-input-wrap">
                      <input className="lp-input" name="email" type="email" value={form.email} onChange={change} placeholder="Your email address" autoComplete="email" />
                      <svg className="lp-input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 8l10 6 10-6"/></svg>
                    </div>
                  </div>
                  {error && <p className="lp-error">{error}</p>}
                  <button type="submit" className="lp-btn" disabled={loading}>{loading ? 'Looking up…' : 'Find My Username'}</button>
                </form>
              </>
            )}

            {/* ── Email Sent ── */}
            {view === 'sent' && (
              <>
                <p className="lp-start">Email sent</p>
                <h1 className="lp-heading">Check Your Inbox</h1>
                <p className="lp-body-msg">
                  We've sent a password reset link to <strong>{form.email}</strong>.<br />
                  Follow the link in the email to set a new password.
                </p>
                <div className="lp-form" style={{ marginTop: '20px' }}>
                  <button type="button" className="lp-link-btn" onClick={() => go('login')}>Back to Log In</button>
                </div>
              </>
            )}

            {/* ── Username Found ── */}
            {view === 'username-found' && (
              <>
                <p className="lp-start">Found it</p>
                <h1 className="lp-heading">Your Username</h1>
                <p className="lp-body-msg">
                  The username linked to <strong>{form.email}</strong> is:
                </p>
                <p className="lp-username-display">{foundUsername}</p>
                <div className="lp-form" style={{ marginTop: '20px' }}>
                  <button type="button" className="lp-btn" onClick={() => go('login')}>Log In</button>
                </div>
              </>
            )}

          </div>

          {/* Desktop right panel */}
          <div className="lp-right">
            <div className="lp-social-box">
              <p className="lp-social-title">Or continue with</p>
              <div className="lp-social-divider" />
              <button type="button" className="lp-social-btn" onClick={() => handleOAuth(signInWithGoogle)} disabled={loading}>
                <GoogleIcon /> Sign in with Google
              </button>
              <button type="button" className="lp-social-btn" onClick={() => handleOAuth(signInWithApple)} disabled={loading}>
                <AppleIcon /> Sign in with Apple
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Toast error pill */}
      {toast && (
        <div className={`lp-toast${toastVisible ? ' lp-toast-show' : ''}`}>
          {toast}
        </div>
      )}
    </>
  );
}

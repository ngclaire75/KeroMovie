import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../lib/firebase';
import logo from '../../images/keromovielogo.png';
import bgGif from '../../images/loginbackground.gif';
import './login.css';

export default function ResetPassword() {
  const navigate  = useNavigate();
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [done, setDone]           = useState(false);

  const oobCode = new URLSearchParams(window.location.search).get('oobCode');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await verifyPasswordResetCode(auth, oobCode);
      await confirmPasswordReset(auth, oobCode, password);
      setDone(true);
    } catch {
      setError('Reset link is invalid or expired. Please request a new one.');
    } finally {
      setLoading(false);
    }
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
        </nav>

        <div className="lp-layout">
          <div className="lp-left">
            {done ? (
              <>
                <p className="lp-start">All done</p>
                <h1 className="lp-heading">Password Reset!</h1>
                <p className="lp-switch">
                  Your password has been updated.{' '}
                  <button className="lp-switch-btn" onClick={() => navigate('/login')}>Log In</button>
                </p>
              </>
            ) : (
              <>
                <p className="lp-start">Choose a new password</p>
                <h1 className="lp-heading">Reset Password</h1>
                <form className="lp-form" onSubmit={handleSubmit}>
                  <div className="lp-field">
                    <label className="lp-label">New Password</label>
                    <div className="lp-input-wrap">
                      <input
                        className="lp-input"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="New password"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  <div className="lp-field">
                    <label className="lp-label">Confirm Password</label>
                    <div className="lp-input-wrap">
                      <input
                        className="lp-input"
                        type="password"
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        placeholder="Re-enter new password"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  {error && <p className="lp-error">{error}</p>}
                  <button type="submit" className="lp-btn" disabled={loading}>
                    {loading ? 'Updating…' : 'Set New Password'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

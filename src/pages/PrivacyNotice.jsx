import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import logo from '../../images/keromovielogo.png';
import './login.css';
import './privacyNotice.css';

export default function PrivacyNotice() {
  useEffect(() => {
    document.documentElement.classList.add('lp-scroll-unlock');
    document.body.classList.add('lp-scroll-unlock');
    return () => {
      document.documentElement.classList.remove('lp-scroll-unlock');
      document.body.classList.remove('lp-scroll-unlock');
    };
  }, []);

  return (
    <>
      <div className="pn-page">
        <nav className="lp-nav">
          <Link to="/" className="lp-logo">
            <img src={logo} alt="KeroMovie" className="lp-logo-img" />
            <span className="lp-logo-text">
              <span className="lp-logo-kero">Kero</span><span className="lp-logo-movie">Movie</span>
            </span>
          </Link>
          <div className="lp-nav-tabs">
            <Link to="/" className="lp-tab">Home</Link>
            <Link to="/login" className="lp-tab">Log In</Link>
          </div>
        </nav>

        <div className="pn-body">
          <div className="pn-container">
            <p className="lp-start">Legal</p>
            <h1 className="lp-heading">Privacy Notice</h1>
            <p className="pn-effective">Effective date: April 2026</p>

            <p className="pn-intro">
              KeroMovie is committed to protecting your personal information. This Privacy Notice explains what data we collect, how we use it, and your rights as a user of our platform.
            </p>

            <div className="pn-sections">

              <section className="pn-section">
                <h2 className="pn-section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Information We Collect
                </h2>
                <div className="pn-items">
                  <div className="pn-item">
                    <span className="pn-item-label">Account Information</span>
                    <span className="pn-item-desc">When you create an account, we collect your first name, last name, username, and email address. This is used solely to identify your account and personalise your experience.</span>
                  </div>
                  <div className="pn-item">
                    <span className="pn-item-label">Authentication Credentials</span>
                    <span className="pn-item-desc">Passwords are never stored in plain text. If you sign in via Google or Apple, we receive only your name and email as provided by those services — we do not receive your password.</span>
                  </div>
                  <div className="pn-item">
                    <span className="pn-item-label">Usage Data</span>
                    <span className="pn-item-desc">We collect data about your in-app activity, including movies you bookmark, ratings you submit, and comments you post in the forum.</span>
                  </div>
                  <div className="pn-item">
                    <span className="pn-item-label">Camera &amp; Image Data (AI Scanner)</span>
                    <span className="pn-item-desc">If you use the AI Face Scanner, your camera feed or uploaded image is sent to AWS Rekognition for facial recognition processing. This image data is transmitted and processed in real-time and is not stored by KeroMovie.</span>
                  </div>
                </div>
              </section>

              <section className="pn-section">
                <h2 className="pn-section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                  How We Use Your Information
                </h2>
                <ul className="pn-list">
                  <li>To create and manage your account</li>
                  <li>To save your bookmarks, ratings, and comments across sessions</li>
                  <li>To display a personalised dashboard with your activity</li>
                  <li>To send account-related emails such as email verification and password resets</li>
                  <li>To identify actors and actresses via the AI Face Scanner feature</li>
                  <li>To improve the platform based on general usage patterns</li>
                </ul>
                <p className="pn-note">We do not sell, rent, or share your personal information with third parties for marketing purposes.</p>
              </section>

              <section className="pn-section">
                <h2 className="pn-section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                  Third-Party Services
                </h2>
                <div className="pn-items">
                  <div className="pn-item">
                    <span className="pn-item-label">Firebase (Google)</span>
                    <span className="pn-item-desc">We use Firebase Authentication and Firestore to manage accounts and store user data. Google's privacy policy applies to data handled by Firebase. See <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="pn-link">policies.google.com/privacy</a>.</span>
                  </div>
                  <div className="pn-item">
                    <span className="pn-item-label">TMDB (The Movie Database)</span>
                    <span className="pn-item-desc">Movie information, posters, and cast data are fetched from the TMDB API. No personal user data is shared with TMDB. See <a href="https://www.themoviedb.org/privacy-policy" target="_blank" rel="noopener noreferrer" className="pn-link">themoviedb.org/privacy-policy</a>.</span>
                  </div>
                  <div className="pn-item">
                    <span className="pn-item-label">AWS Rekognition (Amazon)</span>
                    <span className="pn-item-desc">The AI Face Scanner sends image data to Amazon Web Services Rekognition for celebrity recognition. AWS processes this data under Amazon's privacy policy. See <a href="https://aws.amazon.com/privacy/" target="_blank" rel="noopener noreferrer" className="pn-link">aws.amazon.com/privacy</a>.</span>
                  </div>
                  <div className="pn-item">
                    <span className="pn-item-label">Google Sign-In &amp; Apple Sign-In</span>
                    <span className="pn-item-desc">If you choose to sign in via Google or Apple, those providers share your name and email with us. Their respective privacy policies govern how they handle your data during that flow.</span>
                  </div>
                </div>
              </section>

              <section className="pn-section">
                <h2 className="pn-section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  Local Storage &amp; Cookies
                </h2>
                <p className="pn-text">KeroMovie stores your bookmarks, ratings, comments, and recently viewed items in your browser's local storage so they persist between sessions on the same device. This data is stored locally on your device and is not transmitted to our servers.</p>
                <p className="pn-text">We use session cookies where required for authentication. We do not use advertising or tracking cookies.</p>
              </section>

              <section className="pn-section">
                <h2 className="pn-section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  Data Security
                </h2>
                <p className="pn-text">We take reasonable measures to protect your personal information from unauthorised access, alteration, or disclosure. Authentication is handled by Firebase, which applies industry-standard security protocols including encrypted data transmission (HTTPS) and secure password hashing.</p>
                <p className="pn-text">No system is completely secure. If you become aware of any security concern, please contact us immediately.</p>
              </section>

              <section className="pn-section">
                <h2 className="pn-section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.61 0 3.12.43 4.42 1.17"/></svg>
                  Your Rights
                </h2>
                <ul className="pn-list">
                  <li><strong>Access:</strong> You can view the personal information linked to your account at any time.</li>
                  <li><strong>Correction:</strong> You may update your account details through your profile settings.</li>
                  <li><strong>Deletion:</strong> You may request deletion of your account and associated data by contacting us. Local storage data can be cleared directly in your browser settings.</li>
                  <li><strong>Withdrawal of consent:</strong> You may revoke camera access for the AI Scanner at any time through your browser or device settings.</li>
                </ul>
              </section>

              <section className="pn-section">
                <h2 className="pn-section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Children's Privacy
                </h2>
                <p className="pn-text">KeroMovie is not directed at children under the age of 13. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us and we will take steps to remove it.</p>
              </section>

              <section className="pn-section">
                <h2 className="pn-section-title">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  Contact Us
                </h2>
                <p className="pn-text">If you have any questions, concerns, or requests regarding this Privacy Notice or how we handle your personal information, please contact us through the KeroMovie platform or via the details provided in your account settings.</p>
              </section>

            </div>

          </div>
        </div>
      </div>
    </>
  );
}


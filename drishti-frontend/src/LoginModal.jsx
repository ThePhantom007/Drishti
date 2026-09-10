import React, { useState } from 'react';
import { 
  Lock, 
  User, 
  Stethoscope, 
  ShieldCheck, 
  HeartHandshake, 
  X, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles,
  KeyRound,
  Eye,
  AlertTriangle,
  UserPlus
} from 'lucide-react';

import { ROLE_PROFILES, apiLogin } from './api';

const ROLE_ICONS = {
  doctor: Stethoscope,
  admin: ShieldCheck,
  asha: HeartHandshake
};

// These accounts are created by drishti-backend/scripts/seed_demo_patients.py
// (see README) purely so judges/testers can try each role instantly without
// registering three accounts by hand. They are real accounts authenticated
// through the same /api/auth/login endpoint as everyone else -- not a
// separate fake code path -- so if you delete/change them, this stops
// working exactly like any other login would.
const DEMO_ACCOUNTS = {
  doctor: { username: 'dr_sharma', password: 'Demo@123' },
  admin: { username: 'admin_deshmukh', password: 'Demo@123' },
  asha: { username: 'asha_worker_17', password: 'Demo@123' },
};

export default function LoginModal({ isOpen, onClose, onLogin, onSwitchToRegister, dismissable = true }) {
  const [authMode, setAuthMode] = useState('quick'); // 'quick' (seeded demo accounts) or 'custom' (real credentials)
  const [selectedRole, setSelectedRole] = useState('doctor');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleOverlayClick = () => {
    if (dismissable) onClose();
  };

  const handleQuickLogin = async (roleKey) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const demo = DEMO_ACCOUNTS[roleKey];
      const user = await apiLogin(demo.username, demo.password);
      onLogin(user);
      onClose();
    } catch (err) {
      setError(
        `Couldn't sign in with the seeded demo account (${err.message}). ` +
        `Have you run "python scripts/seed_demo_patients.py" in drishti-backend yet? ` +
        `That's what creates these three demo logins.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Enter both a username and password.');
      return;
    }
    setIsSubmitting(true);
    try {
      const user = await apiLogin(username.trim(), password);
      onLogin(user);
      onClose();
    } catch (err) {
      setError(err.message || 'Sign-in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-modal-overlay" onClick={handleOverlayClick}>
      <div className="login-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="login-modal-header">
          <div className="login-brand-group">
            <div className="brand-logo-icon-sm">
              <Eye size={20} className="text-primary" />
            </div>
            <div>
              <h2>DRISHTI Tele-Ophthalmology Portal</h2>
              <span className="login-sub-heading">National Health Mission • AI Tele-Screening Access</span>
            </div>
          </div>
          {dismissable && (
            <button className="btn-icon-close" onClick={onClose} aria-label="Close login dialog">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Tab Switcher: Quick Demo vs Real Credentials */}
        <div className="login-auth-tabs">
          <button 
            className={`auth-tab-btn ${authMode === 'quick' ? 'active' : ''}`}
            onClick={() => { setAuthMode('quick'); setError(null); }}
          >
            <Sparkles size={14} /> Seeded Demo Accounts
          </button>
          <button 
            className={`auth-tab-btn ${authMode === 'custom' ? 'active' : ''}`}
            onClick={() => { setAuthMode('custom'); setError(null); }}
          >
            <KeyRound size={14} /> Sign In
          </button>
        </div>

        <div className="login-modal-body">
          {authMode === 'quick' ? (
            <div className="role-cards-container">
              <p className="role-selection-prompt">
                Try each role with a seeded demo account (username shown on each card, password <strong>Demo@123</strong>):
              </p>

              <div className="role-profiles-grid">
                {ROLE_PROFILES.map((profile) => {
                  const Icon = ROLE_ICONS[profile.role] || User;
                  const demo = DEMO_ACCOUNTS[profile.role];
                  return (
                    <div key={profile.role} className={`role-profile-card ${profile.color}`}>
                      <div className="role-card-top">
                        <div className={`role-avatar-icon ${profile.color}`}>
                          <Icon size={22} />
                        </div>
                        <div className="role-info-meta">
                          <strong className="role-person-name">{profile.title}</strong>
                          <span className="role-person-title">{demo.username}</span>
                        </div>
                      </div>

                      <p className="role-card-desc">{profile.description}</p>

                      <button 
                        className="btn-launch-role primary"
                        onClick={() => handleQuickLogin(profile.role)}
                        disabled={isSubmitting}
                      >
                        <span>{isSubmitting ? 'Signing in...' : `Sign in as ${demo.username}`}</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <form onSubmit={handleCustomSubmit} className="login-custom-form">
              <div className="form-group">
                <label>Username</label>
                <div className="input-icon-group">
                  <User size={16} className="input-icon" />
                  <input 
                    type="text" 
                    placeholder="your.username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="form-input"
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="input-icon-group">
                  <Lock size={16} className="input-icon" />
                  <input 
                    type="password" 
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              {error && (
                <div className="login-error-banner">
                  <AlertTriangle size={14} /> <span>{error}</span>
                </div>
              )}

              <button 
                type="submit" 
                className="btn-primary full-width mt-3"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Signing in...' : 'Sign In'}
              </button>

              <button
                type="button"
                className="btn-ghost full-width mt-2 flex-center-gap"
                onClick={onSwitchToRegister}
              >
                <UserPlus size={14} /> New here? Create an account
              </button>
            </form>
          )}

          {authMode === 'quick' && error && (
            <div className="login-error-banner mt-3">
              <AlertTriangle size={14} /> <span>{error}</span>
            </div>
          )}
        </div>

        <div className="login-modal-footer">
          <div className="security-notice">
            <ShieldCheck size={14} className="text-emerald" />
            <span>Passwords hashed server-side (PBKDF2-HMAC-SHA256) • Role-Based Access Control (RBAC) Enforced</span>
          </div>
        </div>
      </div>
    </div>
  );
}

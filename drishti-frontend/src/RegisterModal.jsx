import React, { useState } from 'react';
import { 
  Lock, 
  User, 
  Stethoscope, 
  ShieldCheck, 
  HeartHandshake, 
  X, 
  CheckCircle2, 
  Eye, 
  AlertTriangle,
  Building2,
  MapPin,
  UserPlus,
  LogIn
} from 'lucide-react';

import { ROLE_PROFILES, apiRegister } from './api';

const ROLE_ICONS = {
  doctor: Stethoscope,
  admin: ShieldCheck,
  asha: HeartHandshake
};

export default function RegisterModal({ isOpen, onClose, onRegistered, onSwitchToLogin, dismissable = true }) {
  const [role, setRole] = useState('asha');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [district, setDistrict] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleOverlayClick = () => {
    if (dismissable) onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !username.trim() || !password) {
      setError('Full name, username, and password are all required.');
      return;
    }
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await apiRegister({
        username: username.trim(),
        password,
        fullName: fullName.trim(),
        role,
        district: district.trim() || null,
        facilityId: facilityId.trim() || null,
      });
      onRegistered(user);
      onClose();
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-modal-overlay" onClick={handleOverlayClick}>
      <div className="login-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="login-modal-header">
          <div className="login-brand-group">
            <div className="brand-logo-icon-sm">
              <Eye size={20} className="text-primary" />
            </div>
            <div>
              <h2>Create a DRISHTI Account</h2>
              <span className="login-sub-heading">Registered accounts are real -- password hashed server-side, no shortcuts</span>
            </div>
          </div>
          {dismissable && (
            <button className="btn-icon-close" onClick={onClose} aria-label="Close registration dialog">
              <X size={18} />
            </button>
          )}
        </div>

        <div className="login-modal-body">
          <form onSubmit={handleSubmit} className="login-custom-form">
            <div className="form-group">
              <label>I am a...</label>
              <div className="role-profiles-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
                {ROLE_PROFILES.map((profile) => {
                  const Icon = ROLE_ICONS[profile.role] || User;
                  const isSelected = role === profile.role;
                  return (
                    <div
                      key={profile.role}
                      className={`role-profile-card ${profile.color} ${isSelected ? 'selected' : ''}`}
                      style={{ padding: '0.85rem', cursor: 'pointer' }}
                      onClick={() => setRole(profile.role)}
                    >
                      <div className="role-card-top">
                        <div className={`role-avatar-icon ${profile.color}`} style={{ width: 32, height: 32 }}>
                          <Icon size={16} />
                        </div>
                        {isSelected && <CheckCircle2 size={16} className="text-primary" />}
                      </div>
                      <strong className="role-person-name" style={{ fontSize: '0.8rem' }}>
                        {profile.role === 'doctor' && 'Ophthalmologist'}
                        {profile.role === 'admin' && 'Program Admin'}
                        {profile.role === 'asha' && 'ASHA / Field Worker'}
                      </strong>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label>Full Name</label>
              <div className="input-icon-group">
                <User size={16} className="input-icon" />
                <input
                  type="text"
                  placeholder="e.g. Priya Nair"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Username</label>
              <div className="input-icon-group">
                <User size={16} className="input-icon" />
                <input
                  type="text"
                  placeholder="chosen.username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="form-input"
                  autoComplete="username"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label>Password</label>
                <div className="input-icon-group">
                  <Lock size={16} className="input-icon" />
                  <input
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <div className="input-icon-group">
                  <Lock size={16} className="input-icon" />
                  <input
                    type="password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="form-input"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="form-group">
                <label>District (optional)</label>
                <div className="input-icon-group">
                  <MapPin size={16} className="input-icon" />
                  <input
                    type="text"
                    placeholder="e.g. Nanded"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Facility ID (optional)</label>
                <div className="input-icon-group">
                  <Building2 size={16} className="input-icon" />
                  <input
                    type="text"
                    placeholder="e.g. PHC-NANDED-04"
                    value={facilityId}
                    onChange={(e) => setFacilityId(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="login-error-banner">
                <AlertTriangle size={14} /> <span>{error}</span>
              </div>
            )}

            <button type="submit" className="btn-primary full-width mt-3" disabled={isSubmitting}>
              <UserPlus size={16} /> {isSubmitting ? 'Creating account...' : 'Create Account'}
            </button>

            <button
              type="button"
              className="btn-ghost full-width mt-2 flex-center-gap"
              onClick={onSwitchToLogin}
            >
              <LogIn size={14} /> Already have an account? Sign in
            </button>
          </form>
        </div>

        <div className="login-modal-footer">
          <div className="security-notice">
            <ShieldCheck size={14} className="text-emerald" />
            <span>Your role determines which tabs you can access after signing in</span>
          </div>
        </div>
      </div>
    </div>
  );
}

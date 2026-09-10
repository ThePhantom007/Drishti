import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  Search, 
  Bell, 
  UploadCloud, 
  ChevronDown, 
  User, 
  Volume2,
  Award,
  LogOut,
  MapPin,
} from 'lucide-react';
import { SUPPORTED_LANGUAGES, ROLE_PROFILES } from './api';

const ROLE_TITLES = {
  doctor: 'Ophthalmologist Reviewer',
  admin: 'Program Administrator',
  asha: 'ASHA Field Screener',
};

export default function Navbar({ 
  onSearch, 
  searchQuery, 
  onOpenUpload, 
  unreadCount = 0,
  onToggleNotifications,
  currentUser,
  onLogout,
  selectedLanguage = 'hi',
  onLanguageChange
}) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('global-search-input');
        if (searchInput) searchInput.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const roleMeta = ROLE_PROFILES.find(p => p.role === currentUser?.role) || ROLE_PROFILES[0];
  const avatarInitials = currentUser?.role === 'doctor' ? 'DOC' : currentUser?.role === 'admin' ? 'ADM' : 'ASH';

  return (
    <header className="top-navbar">
      {/* Brand & Left Section */}
      <div className="nav-brand-section">
        <div className="brand-logo-container">
          <div className="brand-icon-wrapper">
            <Eye className="brand-icon" size={24} />
            <span className="brand-pulse-dot"></span>
          </div>
          <div className="brand-text-wrapper">
            <div className="brand-title">
              <span className="brand-name">DRISHTI</span>
              <span className="sih-ps-badge" title="Smart India Hackathon SIH26038">
                <Award size={11} /> SIH26038
              </span>
              <span className="mathworks-badge" title="MathWorks Sponsored Technology">
                MathWorks
              </span>
            </div>
            <span className="brand-subtitle">Explainable AI Diabetic Retinopathy Screening • Rural India</span>
          </div>
        </div>
      </div>

      {/* Center Search Section */}
      <div className={`nav-search-container ${isSearchFocused ? 'focused' : ''}`}>
        <Search size={16} className="search-icon" />
        <input 
          id="global-search-input"
          type="text" 
          placeholder="Search patient MRN, ID (e.g. 9f1c2a01), or District PHC..." 
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          className="search-input"
        />
        <div className="keyboard-shortcut">
          <kbd className="kbd-key">Ctrl</kbd>
          <kbd className="kbd-key">K</kbd>
        </div>
      </div>

      {/* Right Controls Section */}
      <div className="nav-actions-section">
        {/* Native Audio Language Selector (23 Languages) */}
        <div className="lang-selector-pill" title="Native-Language Voice Read-Out (22 8th Schedule Languages + English)">
          <Volume2 size={14} className="text-primary" />
          <select 
            value={selectedLanguage}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="lang-select-dropdown"
          >
            {SUPPORTED_LANGUAGES.map(lang => (
              <option key={lang.code} value={lang.code}>
                {lang.name} ({lang.native})
              </option>
            ))}
          </select>
        </div>

        {/* Quick Upload Scan Button -- only meaningful for roles that can screen */}
        {(currentUser?.role === 'asha' || currentUser?.role === 'doctor' || currentUser?.role === 'admin') && (
          <button className="btn-nav-upload" onClick={onOpenUpload}>
            <UploadCloud size={16} />
            <span>ASHA Scan</span>
          </button>
        )}

        {/* Notification Center Trigger */}
        <button 
          className="icon-nav-btn notification-btn" 
          onClick={onToggleNotifications}
          aria-label="Notifications"
          title="Clinical Alerts & Urgent Referrals"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="notification-badge-pulse">{unreadCount}</span>
          )}
        </button>

        {/* Divider */}
        <div className="nav-divider"></div>

        {/* Logged-in user & logout */}
        <div className="clinician-profile-wrapper">
          <button 
            className="clinician-profile-card"
            onClick={() => setProfileOpen(!profileOpen)}
            aria-expanded={profileOpen}
          >
            <div className={`avatar-chip ${roleMeta.color || 'blue'}`}>
              <span className="avatar-text">{avatarInitials}</span>
              <span className="avatar-status-dot"></span>
            </div>
            <div className="clinician-meta">
              <span className="clinician-name">{currentUser?.full_name || currentUser?.username}</span>
              <span className="clinician-role">{ROLE_TITLES[currentUser?.role] || currentUser?.role}</span>
            </div>
            <ChevronDown size={14} className={`dropdown-chevron ${profileOpen ? 'open' : ''}`} />
          </button>

          {profileOpen && (
            <div className="profile-dropdown-menu">
              <div className="dropdown-header">
                <strong>{currentUser?.full_name || currentUser?.username}</strong>
                <span>{ROLE_TITLES[currentUser?.role] || currentUser?.role} • @{currentUser?.username}</span>
                {(currentUser?.district || currentUser?.facility_id) && (
                  <div className="dropdown-jurisdiction-tag">
                    <MapPin size={11} /> {currentUser?.facility_id || currentUser?.district}
                  </div>
                )}
              </div>
              <div className="dropdown-divider"></div>

              <button 
                className="btn-dropdown-auth"
                onClick={() => {
                  setProfileOpen(false);
                  onLogout();
                }}
              >
                <LogOut size={14} /> Log Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

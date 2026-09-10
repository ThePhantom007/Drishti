import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import ReviewQueue from './ReviewQueue';
import CaseDetail from './CaseDetail';
import AdminDashboard from './AdminDashboard';
import CapacityPlanner from './CapacityPlanner';
import ScreeningPortal from './ScreeningPortal';
import BenchmarkViewer from './BenchmarkViewer';
import PatientHistory from './PatientHistory';
import UploadModal from './UploadModal';
import NotificationDrawer from './NotificationDrawer';
import ReportModal from './ReportModal';
import LoginModal from './LoginModal';
import RegisterModal from './RegisterModal';
import { Eye, ShieldCheck } from 'lucide-react';
import {
  INITIAL_NOTIFICATIONS, API_BASE_URL, authFetch, apiLogout, apiFetchCurrentUser,
  setOnUnauthorized, getAuthToken, ROLE_ALLOWED_VIEWS, getDefaultViewForRole,
} from './api';
import './styles.css';

export default function App() {
  // --- Auth state ---------------------------------------------------
  // null while we haven't checked/don't have a logged-in user yet.
  // authChecked distinguishes "still checking a saved token" from
  // "checked, and there's genuinely no one logged in" -- without it the
  // login screen would flash even when a valid session is about to load.
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const currentRole = currentUser?.role || null;
  const [currentView, setCurrentView] = useState('queue');

  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [reportCase, setReportCase] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Restore a saved session on load, and wire up automatic logout if any
  // authFetch call comes back 401 (expired/revoked session token).
  useEffect(() => {
    setOnUnauthorized(() => handleLogout(true));

    const token = getAuthToken();
    if (!token) {
      setAuthChecked(true);
      return;
    }
    apiFetchCurrentUser().then(user => {
      if (user) {
        setCurrentUser(user);
        setCurrentView(getDefaultViewForRole(user.role));
      }
      setAuthChecked(true);
    });
  }, []);

  // Fetch Live Queue from FastAPI (doctor/admin only -- matches the
  // backend's own role check on GET /api/queue)
  useEffect(() => {
    const fetchQueue = async () => {
      try {
        // Both requests: the pending review queue AND recently-reviewed
        // cases. /api/queue only ever returns pending screenings by
        // design (it's a review queue), so a case that just got
        // confirmed/overridden would previously vanish entirely the
        // moment this effect re-ran (e.g. navigating back here after
        // reviewing one) -- there was no second source to still show it
        // as reviewed, which is what broke the "Reviewed & Signed" tab
        // and the signed-today count. Fetching both and merging means a
        // reviewed case has a real place to live instead of just an
        // optimistic local update that the next fetch would overwrite.
        const [pendingRes, reviewedRes] = await Promise.all([
          authFetch('/api/queue?limit=100'),
          authFetch('/api/queue?status=reviewed&limit=100'),
        ]);
        const pending = pendingRes.ok ? await pendingRes.json() : [];
        const reviewed = reviewedRes.ok ? await reviewedRes.json() : [];
        setCases([...pending, ...reviewed]);
      } catch (error) {
        console.error('Failed to fetch review queue:', error);
      }
    };

    if ((currentRole === 'doctor' || currentRole === 'admin') && currentView === 'queue') {
      fetchQueue();
    }
  }, [currentRole, currentView]);

  // Guard against a stale/deep-linked view that this role isn't allowed
  // to see (e.g. an ASHA account somehow lands on 'dashboard') -- redirect
  // to that role's default view instead of rendering it. This mirrors the
  // Sidebar's own filtering, so there's no way to reach a disallowed tab
  // even by manipulating client state.
  useEffect(() => {
    if (!currentRole) return;
    const allowed = ROLE_ALLOWED_VIEWS[currentRole] || [];
    if (!allowed.includes(currentView)) {
      setCurrentView(getDefaultViewForRole(currentRole));
    }
  }, [currentRole, currentView]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const pendingCasesCount = cases.filter(c => (c.review_status ?? c.status) === 'pending').length;

  const navigateToCase = (caseItem) => {
    setSelectedCase(caseItem);
    setCurrentView('detail');
  };

  const handleUpdateCase = (updatedCase) => {
    setCases(prev => prev.map(c => (c.screening_id === updatedCase.screening_id || c.id === updatedCase.id) ? updatedCase : c));
    setSelectedCase(updatedCase);
  };

  const handleAddNewCase = (newCase) => {
    setCases(prev => [newCase, ...prev]);
  };

  const handleMarkNotificationAsRead = (notifId) => {
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleNotificationSelectCase = (caseId, notifId) => {
    if (notifId) handleMarkNotificationAsRead(notifId);
    if (!caseId) {
      setCurrentView('queue');
      return;
    }
    const found = cases.find(c => 
      c.screening_id === caseId || c.id === caseId || c.screening_id === `scr_${caseId}` || c.patient_id === caseId
    );
    if (found) {
      navigateToCase(found);
    } else {
      setCurrentView('queue');
    }
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
    setCurrentView(getDefaultViewForRole(user.role));
  };

  const handleLogout = async (silent = false) => {
    if (!silent) {
      try { await apiLogout(); } catch { /* clear local state regardless */ }
    }
    setCurrentUser(null);
    setCases([]);
    setSelectedCase(null);
  };

  // --- Not logged in: show a sign-in screen, not the app shell -------
  if (!authChecked) {
    return (
      <div className="auth-loading-screen">
        <Eye size={28} className="text-primary" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="auth-gate-screen">
        <div className="auth-gate-card">
          <div className="brand-logo-icon-sm" style={{ width: 56, height: 56, margin: '0 auto 1rem' }}>
            <Eye size={28} className="text-primary" />
          </div>
          <h1>DRISHTI Tele-Ophthalmology Portal</h1>
          <p className="dashboard-subtitle">Explainable AI Diabetic Retinopathy Screening for Rural India</p>
          <button className="btn-primary" style={{ marginTop: '1.5rem', width: '100%' }} onClick={() => setIsLoginOpen(true)}>
            Sign In
          </button>
          <button className="btn-ghost" style={{ marginTop: '0.6rem', width: '100%' }} onClick={() => setIsRegisterOpen(true)}>
            Create an Account
          </button>
          <div className="security-notice" style={{ justifyContent: 'center', marginTop: '1.25rem' }}>
            <ShieldCheck size={14} className="text-emerald" />
            <span>Role-Based Access Control Enforced</span>
          </div>
        </div>

        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          onLogin={handleLogin}
          onSwitchToRegister={() => { setIsLoginOpen(false); setIsRegisterOpen(true); }}
        />
        <RegisterModal
          isOpen={isRegisterOpen}
          onClose={() => setIsRegisterOpen(false)}
          onRegistered={handleLogin}
          onSwitchToLogin={() => { setIsRegisterOpen(false); setIsLoginOpen(true); }}
        />
      </div>
    );
  }

  // --- Logged in: the real app shell ----------------------------------
  return (
    <div className="app-container">
      <Navbar 
        onSearch={setSearchQuery}
        searchQuery={searchQuery}
        onOpenUpload={() => setIsUploadOpen(true)}
        unreadCount={unreadCount}
        onToggleNotifications={() => setIsNotificationsOpen(!isNotificationsOpen)}
        currentUser={currentUser}
        onLogout={handleLogout}
        selectedLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
      />

      <div className="app-body-layout">
        <Sidebar 
          currentView={currentView}
          setCurrentView={setCurrentView}
          pendingCount={pendingCasesCount}
          currentRole={currentRole}
        />

        <main className="main-content">
          {currentView === 'queue' && (
            <ReviewQueue cases={cases} onSelectCase={navigateToCase} searchQuery={searchQuery} />
          )}

          {currentView === 'detail' && (
            selectedCase ? (
              <CaseDetail 
                caseData={selectedCase}
                onBack={() => setCurrentView('queue')}
                onUpdateCase={handleUpdateCase}
                selectedLanguage={selectedLanguage}
              />
            ) : (
              <ReviewQueue cases={cases} onSelectCase={navigateToCase} searchQuery={searchQuery} />
            )
          )}

          {currentView === 'dashboard' && <AdminDashboard />}
          {currentView === 'capacity' && <CapacityPlanner />}
          {currentView === 'history' && (
            <PatientHistory 
              currentRole={currentRole}
              currentUser={currentUser}
              onSelectCase={navigateToCase}
              onOpenReport={(c) => { setReportCase(c); setIsReportOpen(true); }}
              selectedLanguage={selectedLanguage}
            />
          )}
          {currentView === 'screening' && <ScreeningPortal onCaseAdded={handleAddNewCase} selectedLanguage={selectedLanguage} currentUser={currentUser} />}
          {currentView === 'benchmarks' && <BenchmarkViewer />}
        </main>
      </div>

      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onCaseAdded={handleAddNewCase} />
      <NotificationDrawer 
        isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} notifications={notifications}
        onMarkAsRead={handleMarkNotificationAsRead} onMarkAllAsRead={handleMarkAllNotificationsAsRead} onSelectNotificationCase={handleNotificationSelectCase}
      />
      <ReportModal 
        isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} caseData={reportCase || selectedCase || cases[0]} selectedLanguage={selectedLanguage}
      />
    </div>
  );
}

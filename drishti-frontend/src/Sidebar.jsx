import React from 'react';
import { 
  Users, 
  LayoutDashboard, 
  Cpu, 
  CheckCircle2, 
  Building2, 
  Layers,
  History,
  Camera
} from 'lucide-react';
import { ROLE_ALLOWED_VIEWS } from './api';

export default function Sidebar({ currentView, setCurrentView, pendingCount = 3, currentRole }) {
  const allowed = ROLE_ALLOWED_VIEWS[currentRole] || [];
  const canSee = (view) => allowed.includes(view);

  // Nothing in "Clinical & Screening Registry" or "District Administration"
  // or "Field Operations" below renders unless the current role's allowed
  // list includes it -- this is what actually restricts each login to its
  // own domain (ASHA won't see Review Queue or Program Analytics buttons
  // at all, not just a disabled version of them). The backend enforces the
  // same boundary independently on the corresponding endpoints, so this
  // isn't the only thing standing between a role and data it shouldn't see.
  const showClinicalGroup = canSee('queue') || canSee('history');
  const showAdminGroup = canSee('dashboard') || canSee('capacity');
  const showFieldGroup = canSee('screening') || canSee('benchmarks');

  return (
    <aside className="sidebar">
      <div className="sidebar-content">
        {showClinicalGroup && (
          <div className="nav-group">
            <div className="nav-group-title">Clinical & Screening Registry</div>
            <nav className="sidebar-nav">
              {canSee('queue') && (
                <button 
                  className={`nav-btn ${currentView === 'queue' || currentView === 'detail' ? 'active' : ''}`}
                  onClick={() => setCurrentView('queue')}
                >
                  <div className="nav-btn-icon-wrapper">
                    <Users size={18} />
                  </div>
                  <span className="nav-btn-label">Prioritized Review Queue</span>
                  {pendingCount > 0 && (
                    <span className="nav-counter-pill pending">{pendingCount}</span>
                  )}
                </button>
              )}

              {canSee('history') && (
                <button 
                  className={`nav-btn ${currentView === 'history' ? 'active' : ''}`}
                  onClick={() => setCurrentView('history')}
                >
                  <div className="nav-btn-icon-wrapper">
                    <History size={18} />
                  </div>
                  <span className="nav-btn-label">Patient History & Trends</span>
                  <span className={`nav-tag ${currentRole === 'asha' ? 'tag-emerald' : 'tag-blue'}`}>
                    {currentRole === 'asha' ? 'own patients' : 'full database'}
                  </span>
                </button>
              )}
            </nav>
          </div>
        )}

        {showAdminGroup && (
          <div className="nav-group">
            <div className="nav-group-title">District Administration</div>
            <nav className="sidebar-nav">
              {canSee('dashboard') && (
                <button 
                  className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
                  onClick={() => setCurrentView('dashboard')}
                >
                  <div className="nav-btn-icon-wrapper">
                    <LayoutDashboard size={18} />
                  </div>
                  <span className="nav-btn-label">Program Analytics</span>
                  <span className="nav-counter-pill normal">KPIs</span>
                </button>
              )}

              {canSee('capacity') && (
                <button 
                  className={`nav-btn ${currentView === 'capacity' ? 'active' : ''}`}
                  onClick={() => setCurrentView('capacity')}
                >
                  <div className="nav-btn-icon-wrapper">
                    <Building2 size={18} />
                  </div>
                  <span className="nav-btn-label">Simulink Capacity Model</span>
                  <span className="nav-tag tag-blue">100k/yr</span>
                </button>
              )}
            </nav>
          </div>
        )}

        {showFieldGroup && (
          <div className="nav-group">
            <div className="nav-group-title">Field Operations</div>
            <nav className="sidebar-nav">
              {canSee('screening') && (
                <button 
                  className={`nav-btn ${currentView === 'screening' ? 'active' : ''}`}
                  onClick={() => setCurrentView('screening')}
                >
                  <div className="nav-btn-icon-wrapper">
                    <Camera size={18} />
                  </div>
                  <span className="nav-btn-label">ASHA Capture Simulator</span>
                  <span className="nav-tag tag-emerald">6-Stage</span>
                </button>
              )}

              {canSee('benchmarks') && (
                <button 
                  className={`nav-btn ${currentView === 'benchmarks' ? 'active' : ''}`}
                  onClick={() => setCurrentView('benchmarks')}
                >
                  <div className="nav-btn-icon-wrapper">
                    <Cpu size={18} />
                  </div>
                  <span className="nav-btn-label">Messidor-2 Benchmarks</span>
                  <span className="nav-tag tag-purple">Validation</span>
                </button>
              )}
            </nav>
          </div>
        )}
      </div>

      {/* Sidebar Footer with SIH26038 & MathWorks Tech */}
      <div className="sidebar-footer">
        <div className="system-compliance-card">
          <div className="compliance-header">
            <div className="compliance-icon-box">
              <Layers size={16} />
            </div>
            <div>
              <div className="compliance-title">MATLAB + Python Hybrid</div>
              <div className="compliance-sub">ONNX Deep Learning Toolbox</div>
            </div>
          </div>
          <div className="compliance-footer-stat">
            <CheckCircle2 size={12} className="text-emerald" />
            <span>Dual-Path 4-2-1 Verification Active</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

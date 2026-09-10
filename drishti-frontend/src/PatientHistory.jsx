import React, { useState, useMemo, useEffect } from 'react';
import { 
  History, 
  User, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  AlertOctagon, 
  Eye, 
  Filter, 
  Search, 
  Layers, 
  Activity, 
  HeartPulse, 
  ChevronRight, 
  Clock, 
  MapPin, 
  Printer, 
  ArrowRight,
  ShieldAlert,
  Send,
  Sparkles
} from 'lucide-react';
import { 
  filterCasesByRole, 
  getGradeLevel, 
  getGradeLabel, 
  getPatientId, 
  getPatientName, 
  getPHC,
  SUPPORTED_LANGUAGES,
  getLocalizedSummary,
  API_BASE_URL,
  authFetch,
  withAuthToken
} from './api';
import PatientResultCard from './PatientResultCard';

export default function PatientHistory({ 
  currentRole = 'doctor',
  currentUser,
  onSelectCase,
  onOpenReport,
  selectedLanguage = 'hi'
}) {
  // Real patient directory + per-patient screening history, fetched from
  // drishti-backend (GET /api/patients, GET /api/patients/{id}) -- this used
  // to receive the review queue's `cases` prop, which only ever contains
  // screenings still PENDING review and has none of the fields this view
  // needs (age, screening history, lesion counts), which is what caused the
  // "Cannot read properties of undefined (reading 'age')" crash.
  const [patients, setPatients] = useState([]);
  const [patientsLoaded, setPatientsLoaded] = useState(false);
  const [activeDetail, setActiveDetail] = useState(null); // PatientDetail for the selected patient
  const [detailLoading, setDetailLoading] = useState(false);

  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline', 'table', 'result_card'

  useEffect(() => {
    authFetch('/api/patients?limit=200')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => {
        setPatients(data.patients || []);
        if ((data.patients || []).length > 0) {
          setSelectedPatientId(data.patients[0].id);
        }
      })
      .catch(err => console.error('Failed to load patient directory:', err))
      .finally(() => setPatientsLoaded(true));
  }, []);

  useEffect(() => {
    if (!selectedPatientId) { setActiveDetail(null); return; }
    setDetailLoading(true);
    authFetch(`/api/patients/${selectedPatientId}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => setActiveDetail(data))
      .catch(err => { console.error('Failed to load patient detail:', err); setActiveDetail(null); })
      .finally(() => setDetailLoading(false));
  }, [selectedPatientId]);

  // Trajectory is computed from the patient's own real screening history
  // (consecutive ICDR levels) rather than a stored/fabricated field.
  const computeTrajectory = (screenings = []) => {
    const graded = screenings.filter(s => s.status === 'graded' && s.icdr_level != null);
    if (graded.length < 2) return 'stable';
    const first = graded[0].icdr_level;
    const last = graded[graded.length - 1].icdr_level;
    const delta = last - first;
    if (last === 4) return 'sight_threatening';
    if (delta >= 2) return 'rapid_progression';
    if (delta === 1) return 'moderate_progression';
    return 'stable';
  };

  // Filter based on role (ASHA sees own patients, Admin/Doctor sees full database).
  // The backend already scopes GET /api/patients to the logged-in ASHA
  // account's own patients server-side, so this is defense-in-depth, not
  // the real security boundary -- but it must use the actual logged-in
  // user, not a hardcoded name, or it would incorrectly filter out a real
  // ASHA account's own (correctly-returned) patients.
  const roleFilteredPatients = useMemo(() => {
    return filterCasesByRole(patients, currentRole, currentUser?.username);
  }, [patients, currentRole, currentUser]);

  const displayedPatients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return roleFilteredPatients;
    return roleFilteredPatients.filter(p => {
      const name = (getPatientName(p) || '').toLowerCase();
      const pId = (getPatientId(p) || '').toLowerCase();
      const phc = (getPHC(p) || '').toLowerCase();
      return name.includes(q) || pId.includes(q) || phc.includes(q);
    });
  }, [roleFilteredPatients, searchQuery]);

  const activePatient = activeDetail; // PatientDetail | null
  const activeTrajectory = useMemo(
    () => activePatient ? computeTrajectory(activePatient.screenings) : 'stable',
    [activePatient]
  );

  const historyRecords = useMemo(() => {
    const screenings = (activePatient?.screenings || [])
      .filter(s => s.status === 'graded')
      .slice()
      .reverse(); // API returns newest-first; timeline wants oldest-first
    return screenings.map(s => ({
      visit_id: s.screening_id,
      date: (s.created_at || '').slice(0, 10) || 'Unknown date',
      eye: s.eye || 'OD',
      icdr_level: s.icdr_level ?? 0,
      icdr_label: s.icdr_label || 'No DR',
      referable: !!s.referable,
      hba1c: 'Not recorded',
      blood_pressure: 'Not recorded',
      microaneurysms: s.microaneurysm_count ?? '—',
      hemorrhages: s.hemorrhage_count ?? '—',
      grading_paths: s.grading_paths,
      clinician_notes: s.grading_paths?.disagreement
        ? `Rule-based estimate (${s.grading_paths.rule_based_label}) disagreed with the trained model (${s.grading_paths.learned_label}) -- flagged for review.`
        : (s.review_status === 'confirmed' ? 'Ophthalmologist confirmed the AI grade.'
          : s.review_status === 'overridden' ? 'Ophthalmologist overrode the AI grade on review.'
          : 'Awaiting or not requiring ophthalmologist review.'),
      imageUrl: s.annotated_image_url ? withAuthToken(`${API_BASE_URL}${s.annotated_image_url}`) : null,
    }));
  }, [activePatient]);

  const getTrajectoryBadge = (traj) => {
    switch (traj) {
      case 'rapid_progression':
        return { label: 'Rapid Progression (High Alert)', color: 'tag-red', icon: TrendingUp };
      case 'moderate_progression':
        return { label: 'Moderate Progression', color: 'tag-amber', icon: TrendingUp };
      case 'sight_threatening':
        return { label: 'Sight-Threatening (PDR)', color: 'tag-purple', icon: AlertOctagon };
      case 'stable':
      default:
        return { label: 'Stable (Non-Progressive)', color: 'tag-emerald', icon: CheckCircle2 };
    }
  };

  const trajBadge = getTrajectoryBadge(activeTrajectory);
  const TrajIcon = trajBadge.icon;

  return (
    <div className="view-container">
      {/* Header */}
      <div className="dashboard-header-flex">
        <div>
          <div className="flex-center-gap mb-1">
            <h1 className="dashboard-main-title">Longitudinal Patient Registry & Repeat Screening Trends</h1>
            <span className={`role-badge ${currentRole === 'asha' ? 'badge-asha' : 'badge-admin'}`}>
              {currentRole === 'asha' ? 'ASHA Mode: (Own Assigned Patients)' : 'Full Database Registry (All Districts)'}
            </span>
          </div>
          <p className="dashboard-subtitle">
            Track multi-visit DR progression trajectories, compare serial retinal fundus images, and manage annual repeat screening recall schedules (SIH26038).
          </p>
        </div>

        <div className="dashboard-header-controls">
          <div className="mathworks-chip">
            <History size={14} className="text-primary" />
            <span>Serial Screening Analytics Active</span>
          </div>
        </div>
      </div>

      {/* Role Notice Banner */}
      <div className={`role-context-banner ${currentRole === 'asha' ? 'asha-notice' : 'admin-notice'}`}>
        <div className="flex-center-gap">
          <Activity size={16} />
          <span>
            {currentRole === 'asha' 
              ? 'Showing patients you registered.' 
              : 'Showing the full patient registry from drishti-backend.'}
          </span>
        </div>
        <div className="total-count-pill">
          {displayedPatients.length} Patients Displayed
        </div>
      </div>

      {!patientsLoaded && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          Loading patient directory from drishti-backend&hellip;
        </div>
      )}

      {patientsLoaded && patients.length === 0 && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          No patients registered yet. Run a screening from the ASHA Screening Portal to create the first patient record.
        </div>
      )}

      {patientsLoaded && patients.length > 0 && (
      <div className="history-layout-grid">
        {/* Left Column: Patient Selector & Filters */}
        <div className="card history-patient-list-card">
          <div className="card-header-clean">
            <h3 className="card-title flex-center-gap">
              <User size={16} className="text-primary" /> Patient Directory
            </h3>
          </div>

          <div className="history-search-box">
            <div className="search-input-wrapper">
              <Search size={14} className="search-icon" />
              <input 
                type="text" 
                placeholder="Search patient name, ID, or district..." 
                className="form-control"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="patient-cards-scroll">
            {displayedPatients.map(p => {
              const isSelected = p.id === selectedPatientId;

              return (
                <div 
                  key={p.id} 
                  className={`patient-nav-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedPatientId(p.id)}
                >
                  <div className="patient-nav-top">
                    <div className="patient-nav-name">{getPatientName(p)}</div>
                  </div>
                  <div className="patient-nav-sub">
                    <span>ID: {getPatientId(p).slice(0, 12)}</span> • <span>{getPHC(p)}</span>
                  </div>
                  <div className="patient-nav-footer">
                    <span className="visit-count-tag">
                      {p.screening_count || 0} Visit{p.screening_count === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              );
            })}

            {displayedPatients.length === 0 && (
              <div className="empty-state-small">
                <p>No patients matched your filter criteria.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Longitudinal Timeline, Serial Imagery, and Simple Card */}
        <div className="history-main-content">
          {detailLoading && (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>Loading patient history&hellip;</div>
          )}

          {!detailLoading && activePatient && (
          <>
          {/* Top Tabs */}
          <div className="history-tab-bar">
            <button 
              className={`history-tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('timeline')}
            >
              <History size={15} /> Longitudinal Progression Timeline
            </button>
            <button 
              className={`history-tab-btn ${activeTab === 'result_card' ? 'active' : ''}`}
              onClick={() => setActiveTab('result_card')}
            >
              <Sparkles size={15} /> Simple Patient Result Card
            </button>
            <button 
              className={`history-tab-btn ${activeTab === 'table' ? 'active' : ''}`}
              onClick={() => setActiveTab('table')}
            >
              <Layers size={15} /> Repeat Screening Protocol & Recalls
            </button>
          </div>

          {/* TAB 1: Longitudinal Timeline & Serial Comparison */}
          {activeTab === 'timeline' && (
            <div className="timeline-workspace">
              {/* Patient Summary Header Card */}
              <div className="card patient-profile-header-card">
                <div className="profile-header-flex">
                  <div className="profile-main-meta">
                    <div className="profile-avatar">
                      <User size={24} className="text-primary" />
                    </div>
                    <div>
                      <div className="profile-name-row">
                        <h2 className="profile-patient-name">{getPatientName(activePatient)}</h2>
                        <span className={`trajectory-pill ${trajBadge.color}`}>
                          <TrajIcon size={14} /> {trajBadge.label}
                        </span>
                      </div>
                      <div className="profile-meta-sub">
                        <span><strong>Patient ID:</strong> {getPatientId(activePatient)}</span>
                        <span>•</span>
                        <span>{activePatient.age ?? 'Age not recorded'}{activePatient.age ? ' Yrs' : ''} / {activePatient.sex || 'Sex not recorded'}</span>
                        <span>•</span>
                        <span className="flex-center-gap"><MapPin size={13} /> {getPHC(activePatient)}</span>
                        <span>•</span>
                        <span>Preferred Lang: <strong>{(activePatient.preferred_language || 'en').toUpperCase()}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="profile-actions-right">
                    {onSelectCase && (
                      <button className="btn-primary btn-sm" onClick={() => onSelectCase(activePatient)}>
                        <Eye size={14} /> Retinal Studio
                      </button>
                    )}
                    {onOpenReport && (
                      <button className="btn-secondary btn-sm" onClick={() => onOpenReport(activePatient)}>
                        <Printer size={14} /> PDF Report
                      </button>
                    )}
                  </div>
                </div>

                {/* Trajectory Alert Callout */}
                {historyRecords.length > 0 && (
                  <div className="progression-callout-box">
                    <div className="callout-icon">
                      <AlertTriangle size={18} className="text-primary" />
                    </div>
                    <div className="callout-text">
                      <strong>Longitudinal Clinical Finding:</strong> Patient has {historyRecords.length} recorded graded screening{historyRecords.length === 1 ? '' : 's'}.
                      {activeTrajectory === 'rapid_progression' && ' Progression velocity is high across recorded visits. Fast-tracked referral recommended.'}
                      {activeTrajectory === 'moderate_progression' && ' Moderate advancement observed between visits.'}
                      {activeTrajectory === 'sight_threatening' && ' Latest visit graded Proliferative DR -- urgent referral recommended.'}
                      {activeTrajectory === 'stable' && ' Grade has not worsened across recorded visits.'}
                    </div>
                  </div>
                )}
              </div>

              {historyRecords.length === 0 && (
                <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                  No graded screenings recorded for this patient yet.
                </div>
              )}

              {/* Serial Fundus Comparison (Baseline vs Current) */}
              {historyRecords.length >= 2 && (
                <div className="card serial-comparison-card">
                  <div className="card-header-clean">
                    <h3 className="card-title flex-center-gap">
                      <Eye size={16} className="text-primary" />
                      Serial Retinal Fundus Comparison (Baseline vs Latest Visit)
                    </h3>
                  </div>

                  <div className="serial-images-grid">
                    {/* Baseline Image */}
                    <div className="serial-image-box">
                      <div className="serial-image-header">
                        <span className="visit-badge">Baseline Visit: {historyRecords[0].date}</span>
                        <span className={`icdr-badge-sm level-${historyRecords[0].icdr_level}`}>
                          Level {historyRecords[0].icdr_level}: {historyRecords[0].icdr_label}
                        </span>
                      </div>
                      <div className="serial-img-frame">
                        {historyRecords[0].imageUrl ? (
                          <img src={historyRecords[0].imageUrl} alt="Baseline annotated fundus" />
                        ) : (
                          <div className="empty-state-small">Annotated image not available</div>
                        )}
                      </div>
                      <div className="serial-meta-bar">
                        <span>HbA1c: <strong>{historyRecords[0].hba1c}</strong></span>
                        <span>MA Count: <strong>{historyRecords[0].microaneurysms}</strong></span>
                        <span>BP: <strong>{historyRecords[0].blood_pressure}</strong></span>
                      </div>
                    </div>

                    {/* Latest Image */}
                    <div className="serial-image-box latest-visit">
                      <div className="serial-image-header">
                        <span className="visit-badge latest">Latest Visit: {historyRecords[historyRecords.length - 1].date}</span>
                        <span className={`icdr-badge-sm level-${historyRecords[historyRecords.length - 1].icdr_level}`}>
                          Level {historyRecords[historyRecords.length - 1].icdr_level}: {historyRecords[historyRecords.length - 1].icdr_label}
                        </span>
                      </div>
                      <div className="serial-img-frame">
                        {historyRecords[historyRecords.length - 1].imageUrl ? (
                          <img src={historyRecords[historyRecords.length - 1].imageUrl} alt="Latest annotated fundus" />
                        ) : (
                          <div className="empty-state-small">Annotated image not available</div>
                        )}
                      </div>
                      <div className="serial-meta-bar">
                        <span>HbA1c: <strong>{historyRecords[historyRecords.length - 1].hba1c}</strong></span>
                        <span>MA Count: <strong>{historyRecords[historyRecords.length - 1].microaneurysms}</strong></span>
                        <span>BP: <strong>{historyRecords[historyRecords.length - 1].blood_pressure}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Longitudinal Chronological Timeline Nodes */}
              {historyRecords.length > 0 && (
              <div className="card timeline-nodes-card">
                <div className="card-header-clean">
                  <h3 className="card-title flex-center-gap">
                    <History size={16} className="text-primary" />
                    Visit History & Biomarker Trajectory
                  </h3>
                </div>

                <div className="vertical-timeline">
                  {historyRecords.map((visit, index) => {
                    const isLatest = index === historyRecords.length - 1;
                    return (
                      <div key={visit.visit_id || index} className={`timeline-step-row ${isLatest ? 'current-step' : ''}`}>
                        <div className="timeline-left-marker">
                          <div className={`step-dot level-${visit.icdr_level}`}>
                            {visit.icdr_level}
                          </div>
                          {index < historyRecords.length - 1 && <div className="step-connector-line"></div>}
                        </div>

                        <div className="timeline-node-body card">
                          <div className="timeline-node-header">
                            <div className="node-title-box">
                              <span className="node-visit-date">
                                <Calendar size={13} /> {visit.date}
                              </span>
                              <span className={`icdr-badge-sm level-${visit.icdr_level}`}>
                                Level {visit.icdr_level}: {visit.icdr_label}
                              </span>
                              <span className="node-eye-badge">Eye: {visit.eye}</span>
                              {visit.grading_paths?.disagreement && (
                                <span className="badge-disagree" title={`Rule-based: ${visit.grading_paths.rule_based_label} · Model: ${visit.grading_paths.learned_label}`}>
                                  <AlertTriangle size={11} /> Disagreement
                                </span>
                              )}
                            </div>

                            <div className={`node-referral-tag ${visit.referable ? 'tag-referral' : 'tag-routine'}`}>
                              {visit.referable ? 'Referral Recommended' : 'Routine Monitoring'}
                            </div>
                          </div>

                          <div className="biomarker-chips-grid">
                            <div className="biomarker-chip">
                              <span className="bio-label">HbA1c:</span>
                              <strong className="bio-val text-primary">{visit.hba1c}</strong>
                            </div>
                            <div className="biomarker-chip">
                              <span className="bio-label">Blood Pressure:</span>
                              <strong className="bio-val">{visit.blood_pressure}</strong>
                            </div>
                            <div className="biomarker-chip">
                              <span className="bio-label">Microaneurysms:</span>
                              <strong className="bio-val">{visit.microaneurysms}</strong>
                            </div>
                            <div className="biomarker-chip">
                              <span className="bio-label">Hemorrhages:</span>
                              <strong className="bio-val">{visit.hemorrhages}</strong>
                            </div>
                          </div>

                          <div className="node-notes">
                            <strong>Clinician / Model Notes:</strong> {visit.clinician_notes}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              )}
            </div>
          )}

          {/* TAB 2: Simple Patient Result Card */}
          {activeTab === 'result_card' && (
            <div className="result-card-tab-workspace">
              <PatientResultCard 
                caseData={activePatient}
                onViewStudio={onSelectCase}
                onOpenReport={onOpenReport}
                onViewHistory={() => setActiveTab('timeline')}
                selectedLanguage={selectedLanguage}
              />
            </div>
          )}

          {/* TAB 3: Repeat Screening Recall Schedule */}
          {activeTab === 'table' && (
            <div className="card recall-schedule-card">
              <div className="card-header-clean">
                <h3 className="card-title flex-center-gap">
                  <Calendar size={16} className="text-primary" />
                  Annual Repeat Screening Schedule & Recalls
                </h3>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Patient Name & ID</th>
                      <th>Last Screened</th>
                      <th>Current Grade</th>
                      <th>Repeat Interval</th>
                      <th>Recall Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPatients.map(p => {
                      const isDue = p.id === activePatient?.id ? activeTrajectory !== 'stable' : false;
                      return (
                        <tr key={p.id}>
                          <td>
                            <strong>{getPatientName(p)}</strong>
                            <div className="text-muted small">ID: {getPatientId(p).slice(0, 12)}</div>
                          </td>
                          <td>{(p.created_at || '').slice(0, 10) || '—'}</td>
                          <td>
                            {p.id === activePatient?.id && historyRecords.length > 0 ? (
                              <span className={`icdr-badge-sm level-${historyRecords[historyRecords.length - 1].icdr_level}`}>
                                Level {historyRecords[historyRecords.length - 1].icdr_level} ({historyRecords[historyRecords.length - 1].icdr_label})
                              </span>
                            ) : (
                              <span className="text-muted small">Select patient to view</span>
                            )}
                          </td>
                          <td>{p.screening_count > 1 ? 'As advised by reviewer' : '12 Months (Annual)'}</td>
                          <td>
                            <span className={`status-pill ${isDue ? 'urgent' : 'normal'}`}>
                              {isDue ? 'Action Due' : 'Scheduled'}
                            </span>
                          </td>
                          <td>
                            <button 
                              className="btn-ghost btn-sm flex-center-gap"
                              onClick={() => {
                                alert(`Recall notification dispatched via SMS to patient ${getPatientName(p)} (Phone: ${p.phone || 'not on file'}) and assigned ASHA worker.`);
                              }}
                            >
                              <Send size={12} /> Send Reminder
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { 
  Eye, 
  AlertTriangle, 
  CheckCircle, 
  Search, 
  Filter, 
  Clock, 
  User, 
  ArrowUpDown, 
  Sparkles, 
  ShieldAlert, 
  CheckCheck,
  Building2,
  ChevronRight,
  Info,
  Flame,
  Zap,
  Target,
  Check,
  RefreshCw
} from 'lucide-react';

export default function ReviewQueue({ cases = [], onSelectCase, onQuickConfirm, searchQuery, onRefresh, isRefreshing = false }) {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending', 'urgent', 'reviewed', 'all'
  const [severityFilter, setSeverityFilter] = useState('all');
  const [phcFilter, setPhcFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('urgency'); // 'urgency', 'confidence', 'chronological', 'disagreement'

  // Safe Property Extractors
  const getGradeLevel = (item) => item?.grading?.icdr_level ?? item?.icdr_level ?? 0;
  const getGradeLabel = (item) => item?.grading?.icdr_label ?? item?.icdr_label ?? 'No DR';
  const getConfidence = (item) => item?.grading?.confidence ?? item?.confidence ?? item?.calibrated_confidence ?? 0.85;
  const isReferable = (item) => item?.grading?.referable ?? item?.referable ?? (getGradeLevel(item) >= 2);
  const getPatientId = (item) => item?.patientId ?? item?.patient_id ?? item?.external_id ?? item?.id ?? 'P-UNKNOWN';
  const getPatientName = (item) => item?.patientName ?? item?.patient_name ?? getPatientId(item);
  const getPHC = (item) => item?.phc ?? item?.district ?? 'PHC Wardha Rural';

  // Filter & Search Logic with Urgency-First Priority
  const filteredCases = useMemo(() => {
    return (cases || []).filter(item => {
      const status = item?.review_status ?? item?.status ?? 'pending';
      const level = getGradeLevel(item);
      const label = getGradeLabel(item);
      const patientId = getPatientId(item);
      const phc = getPHC(item);

      // Tab filter
      if (activeTab === 'pending' && status !== 'pending') return false;
      if (activeTab === 'urgent' && (status !== 'pending' || level < 3)) return false;
      if (activeTab === 'reviewed' && status !== 'reviewed' && status !== 'confirmed' && status !== 'overridden') return false;

      // Severity filter
      if (severityFilter !== 'all' && level.toString() !== severityFilter) return false;

      // PHC filter
      if (phcFilter !== 'all' && phc !== phcFilter) return false;

      // Global Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesId = patientId.toLowerCase().includes(query);
        const matchesPhc = phc.toLowerCase().includes(query);
        const matchesGrade = label.toLowerCase().includes(query);
        if (!matchesId && !matchesPhc && !matchesGrade) return false;
      }

      return true;
    }).sort((a, b) => {
      const statusA = a?.review_status ?? a?.status ?? 'pending';
      const statusB = b?.review_status ?? b?.status ?? 'pending';
      if (statusA === 'pending' && statusB !== 'pending') return -1;
      if (statusB === 'pending' && statusA !== 'pending') return 1;

      if (sortOrder === 'chronological') {
        const dateA = new Date(a?.date || '2026-09-01').getTime();
        const dateB = new Date(b?.date || '2026-09-01').getTime();
        return dateB - dateA;
      }

      if (sortOrder === 'confidence') {
        return getConfidence(a) - getConfidence(b);
      }

      if (sortOrder === 'disagreement') {
        const isDisagreedA = a?.grading_paths?.disagreement === true;
        const isDisagreedB = b?.grading_paths?.disagreement === true;
        if (isDisagreedA && !isDisagreedB) return -1;
        if (!isDisagreedA && isDisagreedB) return 1;
      }

      // Default: Strict Urgency-First (High Risk Levels 4/3 first, then low-confidence / borderline cases)
      const levelA = getGradeLevel(a);
      const levelB = getGradeLevel(b);
      if (levelB !== levelA) {
        return levelB - levelA;
      }
      return getConfidence(a) - getConfidence(b);
    });
  }, [cases, activeTab, severityFilter, phcFilter, searchQuery, sortOrder]);

  // Statistics & Doctor Pacing Metrics
  const totalPending = (cases || []).filter(c => (c?.review_status ?? c?.status) === 'pending').length;
  const totalUrgent = (cases || []).filter(c => (c?.review_status ?? c?.status) === 'pending' && getGradeLevel(c) >= 3).length;
  const todayStr = new Date().toDateString();
  const reviewedToday = (cases || []).filter(c => {
    const s = c?.review_status ?? c?.status;
    const isReviewed = s === 'reviewed' || s === 'confirmed' || s === 'overridden';
    if (!isReviewed) return false;
    // Genuinely scoped to today's calendar date via the real reviewed_at
    // timestamp, not just "every reviewed case currently loaded" --
    // meaningful now that reviewed cases actually persist in this list
    // instead of disappearing after the next queue fetch.
    if (!c?.reviewed_at && !c?.reviewedAt) return true; // fall back gracefully if timestamp is ever missing
    const reviewedDate = new Date(c.reviewed_at || c.reviewedAt);
    return !isNaN(reviewedDate) && reviewedDate.toDateString() === todayStr;
  }).length;
  
  const dailyTarget = 20;
  const progressPercent = Math.min(Math.round((reviewedToday / dailyTarget) * 100), 100);
  const avgReviewPaceMins = 3.4;

  const avgConfidence = (
    (cases || []).reduce((acc, c) => acc + getConfidence(c), 0) / ((cases || []).length || 1) * 100
  ).toFixed(0);

  // Helper for Severity Badge Styling
  const getSeverityBadgeClass = (level) => {
    switch (level) {
      case 0: return 'severity-level-0';
      case 1: return 'severity-level-1';
      case 2: return 'severity-level-2';
      case 3: return 'severity-level-3';
      case 4: return 'severity-level-4';
      default: return 'severity-level-2';
    }
  };

  return (
    <div className="view-container">
      {/* Clinician Workflow Pacing Banner ("Reviewed Today") */}
      <div className="doctor-pacing-banner">
        <div className="pacing-card-main">
          <div className="pacing-icon-box">
            <Target size={24} className="text-primary" />
          </div>
          <div className="pacing-details">
            <div className="pacing-header-row">
              <span className="pacing-title">Ophthalmologist Daily Review Pacing</span>
              <span className="pacing-streak-badge">
                <Flame size={14} className="text-amber" /> 5-Day Active Streak
              </span>
            </div>
            <div className="pacing-progress-bar-wrap">
              <div 
                className="pacing-progress-fill" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="pacing-stats-meta">
              <strong>{reviewedToday} / {dailyTarget} Cases Signed Today ({progressPercent}%)</strong>
              <span>• Avg Pace: ~{avgReviewPaceMins} mins/case • {totalPending} Remaining in Queue</span>
            </div>
          </div>
        </div>

        <div className="pacing-urgent-callout">
          <div className="urgent-badge-icon">
            <AlertTriangle size={20} className="text-danger" />
          </div>
          <div className="urgent-callout-text">
            <strong>{totalUrgent} Urgent Cases</strong>
            <span>Severe NPDR/PDR awaiting specialist scrutiny</span>
          </div>
        </div>

        {onRefresh && (
          <button
            type="button"
            className="btn-ghost btn-sm flex-center-gap"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="New screenings from other logged-in ASHA/doctor sessions don't push into this view automatically -- refresh to pull the latest"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        )}
      </div>

      {/* Top Clinical KPI Bar */}
      <div className="queue-kpi-banner">
        <div className="kpi-mini-card">
          <div className="kpi-mini-icon text-primary bg-primary-subtle">
            <Clock size={18} />
          </div>
          <div className="kpi-mini-data">
            <span className="kpi-mini-label">Pending Tele-Review</span>
            <span className="kpi-mini-val">{totalPending} Cases</span>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="kpi-mini-icon text-danger bg-danger-subtle">
            <AlertTriangle size={18} />
          </div>
          <div className="kpi-mini-data">
            <span className="kpi-mini-label">High Priority (Severe/PDR)</span>
            <span className="kpi-mini-val text-danger">{totalUrgent} Cases</span>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="kpi-mini-icon text-emerald bg-emerald-subtle">
            <CheckCheck size={18} />
          </div>
          <div className="kpi-mini-data">
            <span className="kpi-mini-label">Reviewed & Signed Today</span>
            <span className="kpi-mini-val text-emerald">{reviewedToday} Cases</span>
          </div>
        </div>

        <div className="kpi-mini-card">
          <div className="kpi-mini-icon text-azure bg-azure-subtle">
            <Sparkles size={18} />
          </div>
          <div className="kpi-mini-data">
            <span className="kpi-mini-label">Avg AI Confidence</span>
            <span className="kpi-mini-val">{avgConfidence}%</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card table-card-container">
        {/* Table Filter Toolbar */}
        <div className="table-toolbar">
          {/* Navigation Tabs */}
          <div className="tab-pill-group">
            <button 
              className={`tab-pill ${activeTab === 'pending' ? 'active' : ''}`}
              onClick={() => setActiveTab('pending')}
            >
              Pending Reviews
              {totalPending > 0 && <span className="tab-badge">{totalPending}</span>}
            </button>
            <button 
              className={`tab-pill ${activeTab === 'urgent' ? 'active' : ''}`}
              onClick={() => setActiveTab('urgent')}
            >
              Urgent Priority
              {totalUrgent > 0 && <span className="tab-badge badge-urgent">{totalUrgent}</span>}
            </button>
            <button 
              className={`tab-pill ${activeTab === 'reviewed' ? 'active' : ''}`}
              onClick={() => setActiveTab('reviewed')}
            >
              Reviewed & Signed
              {reviewedToday > 0 && <span className="tab-badge badge-success">{reviewedToday}</span>}
            </button>
            <button 
              className={`tab-pill ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All Records ({(cases || []).length})
            </button>
          </div>

          {/* Secondary Dropdown & Sorting Filters */}
          <div className="filter-dropdowns-group">
            {/* Sorting Mode Selector */}
            <div className="select-wrapper sort-mode-wrapper">
              <ArrowUpDown size={13} className="select-icon" />
              <select 
                value={sortOrder} 
                onChange={(e) => setSortOrder(e.target.value)}
                className="filter-select sort-select"
                title="Review Queue Sorting Strategy"
              >
                <option value="urgency">⚡ Urgency-First (High Risk & Low Conf)</option>
                <option value="disagreement">⚠️ Dual-Path Disagreements First</option>
                <option value="confidence">🔍 Lowest AI Confidence First</option>
                <option value="chronological">📅 Chronological (Newest First)</option>
              </select>
            </div>

            <div className="select-wrapper">
              <select 
                value={severityFilter} 
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All ICDR Severity</option>
                <option value="0">Level 0: No DR</option>
                <option value="1">Level 1: Mild NPDR</option>
                <option value="2">Level 2: Moderate NPDR</option>
                <option value="3">Level 3: Severe NPDR</option>
                <option value="4">Level 4: Proliferative (PDR)</option>
              </select>
            </div>

            <div className="select-wrapper">
              <select 
                value={phcFilter} 
                onChange={(e) => setPhcFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All District PHCs</option>
                <option value="PHC Nanded Rural">PHC Nanded</option>
                <option value="PHC Wardha Rural">PHC Wardha</option>
                <option value="PHC Yavatmal Center">PHC Yavatmal</option>
                <option value="PHC Amravati Tele-Clinic">PHC Amravati</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sorting Status Banner */}
        <div className="queue-sorting-indicator-bar">
          <Zap size={13} className="text-primary" />
          <span>
            Queue Strategy: <strong>{sortOrder === 'urgency' ? 'Urgency-First Triage (Severe Grades 4 & 3 Prioritized)' : sortOrder === 'disagreement' ? 'Dual-Path Disagreement Audit' : sortOrder === 'confidence' ? 'Lowest Calibrated Confidence' : 'Chronological Receipt'}</strong>
          </span>
        </div>

        {/* Data Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient Details</th>
                <th>Origin / District</th>
                <th>AI ICDR Grade</th>
                <th>Calibrated Confidence</th>
                <th>Urgency & Referral</th>
                <th>Clinical Status</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredCases.map((item) => {
                const level = getGradeLevel(item);
                const label = getGradeLabel(item);
                const conf = getConfidence(item);
                const referable = isReferable(item);
                const patientId = getPatientId(item);
                const phc = getPHC(item);
                const status = item?.review_status ?? item?.status ?? 'pending';
                const isReviewed = status === 'reviewed' || status === 'confirmed' || status === 'overridden';
                const hasDisagreement = item?.grading_paths?.disagreement === true;

                return (
                  <tr key={item.screening_id || item.id || patientId} className={isReviewed ? 'row-completed' : level >= 3 ? 'row-urgent-flag' : ''}>
                    {/* Patient Info */}
                    <td>
                      <div className="patient-cell">
                        <div className="patient-avatar-box">
                          <User size={16} />
                        </div>
                        <div className="patient-meta">
                          <div className="patient-id-row">
                            <strong className="patient-id-text">{patientId}</strong>
                            <span className={`eye-badge ${item.eye === 'OD' ? 'od-badge' : 'os-badge'}`}>
                              {item.eye || 'OD'}
                            </span>
                            {hasDisagreement && (
                              <span
                                className="badge-disagree"
                                title={`Rule-based: ${item.grading_paths.rule_based_label} · Model: ${item.grading_paths.learned_label}`}
                              >
                                <AlertTriangle size={11} /> Disagreement
                              </span>
                            )}
                          </div>
                          <span className="patient-sub-text">
                            {item.patient_name || item.patientName ? `${item.patient_name || item.patientName} • ` : ''}
                            {item.age || '54'}y • {item.sex === 'M' || item.gender === 'Male' ? 'Male' : 'Female'} • {item.date || '2026-09-02'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* PHC Center */}
                    <td>
                      <div className="phc-cell">
                        <Building2 size={14} className="text-muted" />
                        <span>{phc}</span>
                      </div>
                    </td>

                    {/* AI ICDR Grade */}
                    <td>
                      <div className={`severity-tag ${getSeverityBadgeClass(level)}`}>
                        <span className="severity-dot"></span>
                        <span>Level {level}: {label}</span>
                      </div>
                    </td>

                    {/* Confidence */}
                    <td>
                      <div className="confidence-cell">
                        <div className="confidence-bar-wrap">
                          <div 
                            className={`confidence-bar-fill ${conf >= 0.85 ? 'fill-high' : conf >= 0.70 ? 'fill-med' : 'fill-low'}`}
                            style={{ width: `${Math.min(conf * 100, 100)}%` }}
                          ></div>
                        </div>
                        <span className="confidence-percent-text">
                          {(conf * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>

                    {/* Urgency */}
                    <td>
                      {level >= 3 ? (
                        <span className="urgency-badge high">
                          <AlertTriangle size={13} /> Immediate Referral
                        </span>
                      ) : referable ? (
                        <span className="urgency-badge moderate">
                          Referral Advised
                        </span>
                      ) : (
                        <span className="urgency-badge normal">
                          Annual Follow-up
                        </span>
                      )}
                    </td>

                    {/* Clinical Status */}
                    <td>
                      {isReviewed ? (
                        <span className="status-pill signed">
                          <CheckCircle size={13} /> {item.isOverridden || status === 'overridden' ? 'Overridden' : 'Signed'}
                        </span>
                      ) : (
                        <span className="status-pill pending">
                          <Clock size={13} /> Needs Review
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="text-right">
                      <button 
                        className={isReviewed ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
                        onClick={() => onSelectCase(item)}
                      >
                        <span>{isReviewed ? 'View Case' : 'Review Case'}</span>
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredCases.length === 0 && (
                <tr>
                  <td colSpan="7">
                    <div className="empty-state-box">
                      <div className="empty-icon-circle">
                        <CheckCircle size={28} className="text-emerald" />
                      </div>
                      <h3>No cases matching current filter</h3>
                      <p className="text-muted">
                        All pending tele-screening images have been reviewed or no records match your query.
                      </p>
                      <button 
                        className="btn-secondary btn-sm mt-3"
                        onClick={() => {
                          setActiveTab('all');
                          setSeverityFilter('all');
                          setPhcFilter('all');
                          setSortOrder('urgency');
                        }}
                      >
                        Reset All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
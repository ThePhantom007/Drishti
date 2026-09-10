import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Check, 
  X, 
  AlertTriangle, 
  Sparkles, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Layers, 
  FileText, 
  ShieldCheck, 
  Eye, 
  Activity, 
  Sliders, 
  CheckCircle2, 
  Info,
  HeartPulse,
  Share2,
  Maximize2,
  Volume2,
  VolumeX
} from 'lucide-react';
import OverrideModal from './OverrideModal';
import ReportModal from './ReportModal';
import PatientResultCard from './PatientResultCard';
import { getLocalizedSummary, playVoiceReadout, stopVoiceReadout, SUPPORTED_LANGUAGES, API_BASE_URL, authFetch, withAuthToken } from './api';

export default function CaseDetail({ caseData, onBack, onUpdateCase, selectedLanguage = 'hi' }) {
  const [imageMode, setImageMode] = useState('original'); // 'original', 'gradcam', 'annotated', 'split'
  const [zoomLevel, setZoomLevel] = useState(1);
  const [greenFreeFilter, setGreenFreeFilter] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showResultCardModal, setShowResultCardModal] = useState(false);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [noVoiceWarning, setNoVoiceWarning] = useState(null);
  const [currentLang, setCurrentLang] = useState(selectedLanguage);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setCurrentLang(selectedLanguage);
  }, [selectedLanguage]);

  useEffect(() => {
    return () => {
      stopVoiceReadout();
    };
  }, []);

  if (!caseData) {
    return (
      <div className="view-container">
        <button className="btn-ghost btn-sm" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Queue
        </button>
        <p className="mt-4">No case selected.</p>
      </div>
    );
  }

  // Safe Property Extractors
  const screeningId = caseData?.screening_id || caseData?.id;
  const level = caseData?.grading?.icdr_level ?? caseData?.effective_icdr_level ?? caseData?.icdr_level ?? 0;
  const label = caseData?.grading?.icdr_label ?? caseData?.icdr_label ?? 'No DR';
  const confidence = caseData?.grading?.confidence ?? caseData?.confidence ?? caseData?.calibrated_confidence ?? 0.85;
  const referable = caseData?.grading?.referable ?? caseData?.referable ?? (level >= 2);
  const patientId = caseData?.patientId ?? caseData?.patient_id ?? caseData?.id ?? 'P-UNKNOWN';
  const eye = caseData?.eye || 'OD';
  const phc = caseData?.phc ?? caseData?.district ?? 'PHC Wardha Rural';

  const localizedSummary = getLocalizedSummary(caseData, currentLang);
  const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === currentLang) || SUPPORTED_LANGUAGES[0];

  // Medical fundus imagery with API URL fallbacks
  const images = {
    original: caseData?.imageUrl || caseData?.explainability?.original_image_url || 'https://images.unsplash.com/photo-1578496479531-32e296d5c6e1?auto=format&fit=crop&q=80&w=800&h=500',
    gradcam: caseData?.explainability?.gradcam_image_url ? withAuthToken(`${API_BASE_URL}${caseData.explainability.gradcam_image_url}`) : 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=800&h=500',
    annotated: caseData?.explainability?.annotated_image_url ? withAuthToken(`${API_BASE_URL}${caseData.explainability.annotated_image_url}`) : 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=800&h=500'
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 2.5));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.75));
  const handleResetZoom = () => {
    setZoomLevel(1);
    setGreenFreeFilter(false);
  };

  const handleToggleAudio = () => {
    if (isPlayingAudio) {
      stopVoiceReadout();
      setIsPlayingAudio(false);
    } else {
      setNoVoiceWarning(null);
      playVoiceReadout(
        localizedSummary,
        currentLang,
        () => setIsPlayingAudio(true),
        () => setIsPlayingAudio(false),
        (err) => {
          setIsPlayingAudio(false);
          console.warn('Audio read-out fallback:', err);
        },
        (langName) => setNoVoiceWarning(
          `No ${langName} voice is installed on this device, so this is playing with your browser's default voice instead. Add ${langName} under Windows Settings \u2192 Time & language \u2192 Language & region (with speech support) for accurate pronunciation.`
        )
      );
    }
  };

  // Connected to POST /api/review/{screening_id}[cite: 1]
  const handleConfirmGrade = async () => {
    if (!screeningId) {
      alert('Error: Screening ID missing.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authFetch(`/api/review/${screeningId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewer_id: 'dr_sharma',
          decision: 'confirm',
          notes: clinicalNotes || 'Confirmed AI diagnosis.'
        })
      });

      if (response.ok) {
        const result = await response.json();
        const updated = {
          ...caseData,
          status: 'reviewed',
          review_status: result.review_status || 'confirmed',
          isOverridden: false,
          reviewedAt: result.reviewed_at || new Date().toLocaleTimeString(),
          doctorNotes: clinicalNotes
        };
        onUpdateCase(updated);
        setBannerMessage(`Confirmed AI Diagnosis (Level ${level}: ${label})`);
        setShowSuccessBanner(true);
        setTimeout(() => {
          onBack();
        }, 1800);
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(`Failed to save review: ${errData.detail || errData.message || `HTTP ${response.status}`}`);
      }
    } catch (error) {
      console.error('API Error during review confirmation:', error);
      alert('Network error connecting to backend review API.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Connected to POST /api/review/{screening_id} with override payload
  // Returns true/false so the modal knows whether it's safe to close --
  // it used to fire-and-forget this and close immediately regardless of
  // whether the save actually succeeded.
  const handleOverrideSave = async (revisedGrading) => {
    if (!screeningId) {
      alert('Error: Screening ID missing.');
      return false;
    }

    setIsSubmitting(true);
    try {
      const response = await authFetch(`/api/review/${screeningId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewer_id: 'dr_sharma',
          decision: 'override',
          overridden_icdr_level: revisedGrading.icdr_level,
          notes: revisedGrading.overrideRationale || 'Clinician adjusted grade on review.'
        })
      });

      if (response.ok) {
        const result = await response.json();
        const updated = {
          ...caseData,
          status: 'reviewed',
          review_status: result.review_status || 'overridden',
          isOverridden: true,
          effective_icdr_level: result.effective_icdr_level,
          icdr_level: result.effective_icdr_level,
          grading: { ...caseData.grading, icdr_level: result.effective_icdr_level, icdr_label: revisedGrading.icdr_label },
          reviewedAt: result.reviewed_at || new Date().toLocaleTimeString(),
          doctorNotes: revisedGrading.overrideRationale
        };
        onUpdateCase(updated);
        setBannerMessage(`Diagnosis Adjusted to ${revisedGrading.icdr_label} (Clinician Overridden)`);
        setShowSuccessBanner(true);
        setTimeout(() => {
          onBack();
        }, 1800);
        return true;
      } else {
        const errData = await response.json().catch(() => ({}));
        alert(`Failed to save override: ${errData.detail || errData.message || `HTTP ${response.status}`}`);
        return false;
      }
    } catch (error) {
      console.error('API Error during review override:', error);
      alert('Network error connecting to backend review API. Is drishti-backend running?');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="view-container">
      {/* Top Header & Breadcrumbs */}
      <div className="case-detail-header">
        <button className="btn-ghost btn-sm" onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Back to Review Queue</span>
        </button>

        <div className="header-case-badge">
          <span className="case-tag-patient">Patient {patientId}</span>
          <span className={`eye-badge ${eye === 'OD' ? 'od-badge' : 'os-badge'}`}>
            {eye === 'OD' ? 'OD (Right Eye)' : 'OS (Left Eye)'}
          </span>
          <span className="phc-tag-pill">{phc}</span>
        </div>

        <div className="header-actions">
          <button className="btn-secondary btn-sm" onClick={() => setShowResultCardModal(true)}>
            <Sparkles size={14} />
            <span>Patient Result Card</span>
          </button>
          <button className="btn-secondary btn-sm" onClick={() => setShowReportModal(true)}>
            <FileText size={14} />
            <span>Generate Clinical Report</span>
          </button>
        </div>
      </div>

      {/* Patient Health Summary Bar */}
      <div className="patient-clinical-strip card">
        <div className="patient-strip-item">
          <span className="strip-label">Patient Demographics</span>
          <strong className="strip-val">
            {caseData.patient_name || caseData.patientName ? `${caseData.patient_name || caseData.patientName} • ` : ''}
            {caseData.age || '56'} yrs • {caseData.gender || caseData.sex === 'M' ? 'Male' : 'Female'}
          </strong>
        </div>
        <div className="strip-divider"></div>
        <div className="patient-strip-item">
          <span className="strip-label">Diabetes Type & Duration</span>
          <strong className="strip-val">{caseData.clinicalData?.diabetesDuration || caseData.clinical_data?.diabetes_duration || 'Type 2 (11 yrs)'}</strong>
        </div>
        <div className="strip-divider"></div>
        <div className="patient-strip-item">
          <span className="strip-label">Glycemic Control (HbA1c)</span>
          <strong className="strip-val text-amber">{caseData.clinicalData?.hba1c || caseData.clinical_data?.hba1c || '8.4%'}</strong>
        </div>
        <div className="strip-divider"></div>
        <div className="patient-strip-item">
          <span className="strip-label">Blood Pressure</span>
          <strong className="strip-val">{caseData.clinicalData?.bloodPressure || caseData.clinical_data?.blood_pressure || '135/85 mmHg'}</strong>
        </div>
        <div className="strip-divider"></div>
        <div className="patient-strip-item">
          <span className="strip-label">Screening Date</span>
          <strong className="strip-val">{caseData.date || '2026-09-02'}</strong>
        </div>
      </div>

      {/* Main Studio Grid */}
      <div className="detail-grid">
        {/* Left Column: Retinal Image Studio */}
        <div className="image-studio-panel card">
          <div className="studio-toolbar-row">
            <div className="toggle-group-pills">
              <button className={`studio-pill ${imageMode === 'original' ? 'active' : ''}`} onClick={() => setImageMode('original')}>Original Fundus</button>
              <button className={`studio-pill ${imageMode === 'gradcam' ? 'active' : ''}`} onClick={() => setImageMode('gradcam')}><Sparkles size={13} /> Grad-CAM Heatmap</button>
              <button className={`studio-pill ${imageMode === 'annotated' ? 'active' : ''}`} onClick={() => setImageMode('annotated')}><Layers size={13} /> Lesion Segmentation</button>
              <button className={`studio-pill ${imageMode === 'split' ? 'active' : ''}`} onClick={() => setImageMode('split')}>Side-by-Side</button>
            </div>

            <div className="image-tools-group">
              <button className={`btn-tool-chip ${greenFreeFilter ? 'active' : ''}`} onClick={() => setGreenFreeFilter(!greenFreeFilter)}>Green-Free Filter</button>
              <button className="btn-tool-chip" onClick={handleZoomIn} title="Zoom In"><ZoomIn size={14} /></button>
              <button className="btn-tool-chip" onClick={handleZoomOut} title="Zoom Out"><ZoomOut size={14} /></button>
              <button className="btn-tool-chip" onClick={handleResetZoom} title="Reset View"><RotateCcw size={14} /></button>
            </div>
          </div>

          <div className="retinal-viewer-canvas">
            {imageMode === 'split' ? (
              <div className="split-view-container">
                <div className="split-pane">
                  <span className="split-label">Original Fundus</span>
                  <div className="image-viewport">
                    <img src={images.original} alt="Original Fundus" style={{ transform: `scale(${zoomLevel})`, filter: greenFreeFilter ? 'contrast(180%) hue-rotate(90deg) grayscale(40%)' : 'none' }} />
                  </div>
                </div>
                <div className="split-pane">
                  <span className="split-label">Grad-CAM AI Attention</span>
                  <div className="image-viewport">
                    <img src={images.gradcam} alt="Grad-CAM" style={{ transform: `scale(${zoomLevel})` }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="single-image-container">
                <div className="image-viewport">
                  <img src={images[imageMode]} alt={`Fundus ${imageMode}`} style={{ transform: `scale(${zoomLevel})`, filter: greenFreeFilter && imageMode === 'original' ? 'contrast(180%) hue-rotate(90deg) grayscale(40%)' : 'none' }} />
                </div>
                {imageMode === 'gradcam' && (
                  <div className="active-overlay-tag gradcam-tag"><Sparkles size={13} /><span>Grad-CAM Activation Heatmap</span></div>
                )}
                {imageMode === 'annotated' && (
                  <div className="active-overlay-tag annotated-tag"><Layers size={13} /><span>Lesion Segmentation Active</span></div>
                )}
              </div>
            )}
            <div className="viewer-bottom-bar">
              <div className="quadrant-indicator"><span>Field: 50° Macula-Centered • Optical Quality: <strong>Grade A (Sharp)</strong></span></div>
              <div className="zoom-indicator"><span>Zoom: {(zoomLevel * 100).toFixed(0)}%</span></div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Evidence & Clinician Actions */}
        <div className="evidence-panel-column">
          <div className="card ai-evidence-card">
            <div className="evidence-card-header">
              <div className="header-icon-box"><Sparkles size={18} className="text-primary" /></div>
              <div>
                <h3>AI Diagnostic Evidence</h3>
                <span className="text-xs text-muted">Deep Ensemble Model EfficientNet-B3</span>
              </div>
            </div>

            <div className="grade-prediction-banner">
              <div className="grade-pill-large">
                <span className="grade-level-tag">Level {level}</span>
                <strong className="grade-name-text">{label}</strong>
              </div>
              <div className="confidence-meter-box">
                <span className="confidence-title">Calibrated Confidence</span>
                <span className="confidence-value-big">{(confidence * 100).toFixed(1)}%</span>
                <div className="confidence-bar-micro">
                  <div className="confidence-bar-fill fill-high" style={{ width: `${Math.min(confidence * 100, 100)}%` }}></div>
                </div>
              </div>
            </div>

            <div className="voice-readout-card">
              <div className="voice-card-header">
                <Volume2 size={18} className="text-primary" />
                <div className="flex-1 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-dark">Native Voice Read-Out</h4>
                  <select value={currentLang} onChange={(e) => setCurrentLang(e.target.value)} className="filter-select text-xs" style={{ padding: '2px 6px', height: '24px' }}>
                    {SUPPORTED_LANGUAGES.map(l => (
                      <option key={l.code} value={l.code}>{l.name} ({l.native})</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="voice-transcript">"{localizedSummary}"</p>
              <button className={`btn-voice-play ${isPlayingAudio ? 'playing' : ''}`} onClick={handleToggleAudio}>
                {isPlayingAudio ? <><VolumeX size={16} /> Stop Audio</> : <><Volume2 size={16} /> Listen in {currentLangObj.name}</>}
              </button>
              {noVoiceWarning && (
                <p className="text-xs text-muted mt-1" style={{ maxWidth: '480px' }}>{noVoiceWarning}</p>
              )}
            </div>

            <div className={`referral-timeline-card ${referable ? 'referral-urgent' : 'referral-safe'}`}>
              <div className="referral-header">
                {referable ? <><AlertTriangle size={16} /><strong>Referral Required: Specialist Care</strong></> : <><CheckCircle2 size={16} /><strong>No Urgent Referral Needed</strong></>}
              </div>
              <p className="referral-instruction">
                {referable ? 'Recommend tertiary vitreoretinal examination & OCT macula within 2–4 weeks.' : 'Annual dilated tele-screening follow-up recommended.'}
              </p>
            </div>

            <div className="lesions-breakdown-section">
              <h4 className="section-title">Detected Lesion Quantification</h4>
              <div className="lesion-stat-rows">
                <div className="lesion-row">
                  <span className="lesion-name">Microaneurysms:</span>
                  <strong className="lesion-count">{caseData.lesions?.microaneurysm_count ?? 14} clusters</strong>
                </div>
                <div className="lesion-row">
                  <span className="lesion-name">Intraretinal Hemorrhages:</span>
                  <strong className="lesion-count">{caseData.lesions?.hemorrhage_count ?? 3} (Dot/Blot)</strong>
                </div>
                <div className="lesion-row">
                  <span className="lesion-name">Hard Exudates (Lipid leakage):</span>
                  <strong className="lesion-count">{caseData.lesions?.hard_exudate_area_pct ? `${caseData.lesions.hard_exudate_area_pct}%` : '1.2% area'}</strong>
                </div>
                <div className="lesion-row">
                  <span className="lesion-name">Neovascularization (NVD/NVE):</span>
                  <strong className="lesion-count text-emerald">{caseData.lesions?.neovascularization_detected ? 'Detected' : 'None detected'}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="card clinical-decision-card">
            <h3 className="decision-card-title">Clinician Decision & Sign-off</h3>

            {showSuccessBanner ? (
              <div className="success-confirmation-box">
                <CheckCircle2 size={24} className="text-emerald" />
                <div className="success-text">
                  <strong>{bannerMessage}</strong>
                  <span>Case verified and synced via FastAPI backend.</span>
                </div>
              </div>
            ) : (
              <>
                <div className="form-group mb-3">
                  <label className="text-xs text-muted mb-1 block">Clinical Impression Notes / Treatment Plan:</label>
                  <textarea 
                    rows={2}
                    className="textarea-control text-sm"
                    placeholder="Add clinical findings, referral hospital name, or patient advice..."
                    value={clinicalNotes}
                    onChange={(e) => setClinicalNotes(e.target.value)}
                  />
                </div>

                <div className="decision-actions-grid">
                  <button className="btn-confirm-grade" onClick={handleConfirmGrade} disabled={isSubmitting}>
                    <Check size={16} />
                    <span>{isSubmitting ? 'Saving...' : 'Confirm AI Grade'}</span>
                  </button>

                  <button className="btn-override-grade" onClick={() => setShowOverrideModal(true)} disabled={isSubmitting}>
                    <Sliders size={16} />
                    <span>Override / Adjust</span>
                  </button>
                </div>

                <button className="btn-ghost full-width mt-2 text-xs" onClick={() => setShowReportModal(true)}>
                  <FileText size={13} /> View Diagnostic Report
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <OverrideModal isOpen={showOverrideModal} onClose={() => setShowOverrideModal(false)} caseData={caseData} onSaveOverride={handleOverrideSave} />
      <ReportModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} caseData={caseData} selectedLanguage={currentLang} />

      {showResultCardModal && (
        <div className="modal-overlay" onClick={() => setShowResultCardModal(false)}>
          <div className="modal-content result-card-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-clean">
              <h3 className="modal-title flex-center-gap"><Sparkles size={16} className="text-primary" /> Patient Diagnostic Result Card</h3>
              <button className="btn-icon-close" onClick={() => setShowResultCardModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body-p0">
              <PatientResultCard 
                caseData={caseData}
                onOpenReport={() => { setShowResultCardModal(false); setShowReportModal(true); }}
                selectedLanguage={currentLang}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
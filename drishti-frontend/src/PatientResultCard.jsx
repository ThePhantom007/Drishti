import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  Volume2, 
  VolumeX, 
  Printer, 
  Eye, 
  Calendar, 
  User, 
  MapPin, 
  HeartPulse, 
  ArrowRight,
  Sparkles,
  Layers,
  FileText
} from 'lucide-react';
import { 
  getGradeLevel, 
  getGradeLabel, 
  getConfidence, 
  isReferable, 
  getPatientId, 
  getPatientName, 
  getPHC, 
  SUPPORTED_LANGUAGES, 
  getLocalizedSummary, 
  playVoiceReadout, 
  stopVoiceReadout 
} from './api';

export default function PatientResultCard({ 
  caseData, 
  onViewStudio, 
  onViewHistory, 
  onOpenReport,
  selectedLanguage = 'hi' 
}) {
  const [currentLang, setCurrentLang] = useState(selectedLanguage);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  useEffect(() => {
    setCurrentLang(selectedLanguage);
  }, [selectedLanguage]);

  useEffect(() => {
    return () => {
      stopVoiceReadout();
    };
  }, []);

  if (!caseData) return null;

  const level = getGradeLevel(caseData);
  const label = getGradeLabel(caseData);
  const confidence = getConfidence(caseData);
  const referable = isReferable(caseData);
  const patientId = getPatientId(caseData);
  const patientName = getPatientName(caseData);
  const phc = getPHC(caseData);
  const date = caseData.date || caseData.screening_date || '2026-09-02';
  const age = caseData.age || caseData.patient_age || 50;
  const gender = caseData.gender || caseData.patient_gender || 'Unknown';

  const localizedSummary = getLocalizedSummary(caseData, currentLang);
  const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === currentLang) || SUPPORTED_LANGUAGES[0];

  const handleToggleVoice = () => {
    if (isPlayingAudio) {
      stopVoiceReadout();
      setIsPlayingAudio(false);
    } else {
      setIsPlayingAudio(true);
      playVoiceReadout(
        localizedSummary,
        currentLang,
        () => setIsPlayingAudio(true),
        () => setIsPlayingAudio(false),
        () => setIsPlayingAudio(false)
      );
    }
  };

  const getSeverityTheme = (lvl) => {
    switch (lvl) {
      case 0: return { bg: 'var(--blue-50)', text: 'var(--blue-700)', border: 'var(--blue-200)', badge: 'level-0', icon: CheckCircle2 };
      case 1: return { bg: 'var(--emerald-50)', text: 'var(--emerald-700)', border: 'var(--emerald-200)', badge: 'level-1', icon: CheckCircle2 };
      case 2: return { bg: 'var(--amber-50)', text: 'var(--amber-700)', border: 'var(--amber-200)', badge: 'level-2', icon: AlertTriangle };
      case 3: return { bg: 'var(--rose-50)', text: 'var(--rose-700)', border: 'var(--rose-200)', badge: 'level-3', icon: AlertTriangle };
      case 4: return { bg: 'var(--purple-50)', text: 'var(--purple-700)', border: 'var(--purple-200)', badge: 'level-4', icon: AlertOctagon };
      default: return { bg: 'var(--blue-50)', text: 'var(--blue-700)', border: 'var(--blue-200)', badge: 'level-0', icon: CheckCircle2 };
    }
  };

  const theme = getSeverityTheme(level);
  const IconComponent = theme.icon;

  const getNextSteps = (lvl) => {
    switch (lvl) {
      case 0:
        return [
          { title: 'Annual Retinal Screening', desc: 'Schedule repeat digital fundus examination in 12 months at your local PHC.' },
          { title: 'Routine Glycemic Management', desc: 'Maintain blood sugar logs and target HbA1c < 7.0% with your medical officer.' },
          { title: 'Lifestyle & Eye Protection', desc: 'Continue daily exercise, balanced diet, and prompt reporting of visual changes.' }
        ];
      case 1:
        return [
          { title: 'Early DR Monitoring (12 Months)', desc: 'Mild microvascular changes noted. Repeat digital screening within 1 year.' },
          { title: 'Strict Glycemic & BP Control', desc: 'Consult your primary physician to optimize diabetes and hypertension medications.' },
          { title: 'Self-Monitoring Awareness', desc: 'Report immediately to PHC if you notice blurriness, wavy vision, or dark spots.' }
        ];
      case 2:
        return [
          { title: 'Referral to District Eye Hospital', desc: 'Moderate NPDR detected. Consultation with an ophthalmologist required within 3 months.' },
          { title: 'Comprehensive Slit-Lamp & OCT Exam', desc: 'Ophthalmologist will evaluate for Diabetic Macular Edema (DME).' },
          { title: 'Intensified Systemic Management', desc: 'Target HbA1c < 7.0% and BP < 130/80 mmHg to arrest microaneurysm leakage.' }
        ];
      case 3:
        return [
          { title: 'URGENT Retinal Specialist Consultation', desc: 'Severe NPDR (4-2-1 criteria). Examination by a vitreoretinal specialist within 2–4 weeks.' },
          { title: 'Preparation for Pan-Retinal Photocoagulation', desc: 'Evaluation for preventive laser therapy to prevent disease conversion to proliferative DR.' },
          { title: 'High-Risk Glycemic & Renal Review', desc: 'Urgent nephropathy and cardiovascular risk stratification with physician.' }
        ];
      case 4:
        return [
          { title: 'EMERGENCY Vitreoretinal Intervention', desc: 'Active neovascularization detected (High Risk PDR). Immediate specialist hospital admission.' },
          { title: 'Anti-VEGF Injections & Laser Photocoagulation', desc: 'Immediate sight-saving intervention to prevent vitreous hemorrhage or retinal detachment.' },
          { title: 'Continuous Vision Monitoring', desc: 'Strict activity restrictions and emergency contact for sudden loss of vision.' }
        ];
      default:
        return [];
    }
  };

  const nextSteps = getNextSteps(level);

  return (
    <div className="patient-result-card-container">
      <div className="patient-result-card">
        {/* Header Ribbon */}
        <div className="result-card-header">
          <div className="result-card-identity">
            <div className="result-avatar">
              <User size={20} className="text-primary" />
            </div>
            <div>
              <div className="patient-main-name">{patientName}</div>
              <div className="patient-sub-meta">
                <span><strong>ID:</strong> {patientId}</span>
                <span>•</span>
                <span>{age} Yrs / {gender}</span>
                <span>•</span>
                <span className="flex-center-gap"><MapPin size={12} /> {phc}</span>
              </div>
            </div>
          </div>

          <div className="result-card-meta-right">
            <span className="result-date-badge">
              <Calendar size={13} /> {date}
            </span>
            <div className="system-pill">SIH26038 Calibrated</div>
          </div>
        </div>

        {/* DR Grading & Severity Banner */}
        <div className="result-severity-banner" style={{ backgroundColor: theme.bg, borderColor: theme.border }}>
          <div className="severity-banner-left">
            <div className="severity-icon-badge" style={{ color: theme.text }}>
              <IconComponent size={28} />
            </div>
            <div>
              <div className="severity-banner-label">AI Retinal Diagnostic Grade</div>
              <div className="severity-banner-title" style={{ color: theme.text }}>
                Level {level}: {label}
              </div>
              <div className="severity-banner-sub">
                Calibrated Confidence: <strong>{(confidence * 100).toFixed(1)}%</strong> • Eye: <strong>{caseData.eye || 'OD'}</strong>
              </div>
            </div>
          </div>

          <div className="severity-banner-right">
            <div className={`referral-decision-chip ${referable ? 'referral-required' : 'referral-routine'}`}>
              {referable ? 'REFERRAL REQUIRED' : 'NON-REFERABLE'}
            </div>
            <div className="referral-timeframe-sub">
              {level >= 3 ? 'Urgent Review (2–4 Weeks)' : level === 2 ? 'Review within 3 Months' : 'Annual Follow-Up'}
            </div>
          </div>
        </div>

        {/* Actionable Next Steps (3-Point Protocol) */}
        <div className="result-next-steps-section">
          <h4 className="section-small-title">
            <HeartPulse size={15} className="text-primary" />
            Actionable Clinical Next Steps & Care Protocol
          </h4>
          <div className="next-steps-grid">
            {nextSteps.map((step, idx) => (
              <div key={idx} className="next-step-item">
                <div className="step-number-badge">{idx + 1}</div>
                <div className="step-content">
                  <div className="step-title">{step.title}</div>
                  <div className="step-desc">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Multilingual Voice Read-out Bar */}
        <div className="result-audio-bar">
          <div className="audio-bar-left">
            <div className="audio-icon-box">
              <Volume2 size={16} className="text-primary" />
            </div>
            <div className="audio-text-content">
              <div className="audio-lang-title">
                Patient Voice Summary • {currentLangObj.name} ({currentLangObj.native})
              </div>
              <p className="audio-transcript-snippet">"{localizedSummary}"</p>
            </div>
          </div>

          <div className="audio-bar-controls">
            <select 
              className="form-select result-lang-select"
              value={currentLang}
              onChange={(e) => setCurrentLang(e.target.value)}
            >
              {SUPPORTED_LANGUAGES.map(l => (
                <option key={l.code} value={l.code}>{l.name} ({l.native})</option>
              ))}
            </select>

            <button 
              className={`btn-voice-trigger ${isPlayingAudio ? 'playing' : ''}`}
              onClick={handleToggleVoice}
            >
              {isPlayingAudio ? (
                <>
                  <VolumeX size={15} /> Stop Voice
                </>
              ) : (
                <>
                  <Volume2 size={15} /> Listen in {currentLangObj.name}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="result-card-footer">
          <div className="footer-auxiliary-actions">
            {onOpenReport && (
              <button className="btn-secondary btn-sm" onClick={() => onOpenReport(caseData)}>
                <Printer size={14} /> Full Clinical PDF Report
              </button>
            )}
            {onViewHistory && (
              <button className="btn-ghost btn-sm" onClick={() => onViewHistory(caseData)}>
                <Layers size={14} /> View Screening History & Trends
              </button>
            )}
          </div>

          {onViewStudio && (
            <button className="btn-primary btn-sm" onClick={() => onViewStudio(caseData)}>
              <Eye size={14} /> Retinal Inspection Studio <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

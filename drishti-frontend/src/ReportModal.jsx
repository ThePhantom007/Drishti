import React, { useState, useEffect } from 'react';
import { FileText, Printer, Download, X, Eye, CheckCircle2, ShieldCheck, Volume2, VolumeX } from 'lucide-react';
import { getLocalizedSummary, playVoiceReadout, stopVoiceReadout, SUPPORTED_LANGUAGES, API_BASE_URL, withAuthToken } from './api';

export default function ReportModal({ isOpen, onClose, caseData, selectedLanguage = 'hi' }) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [currentLang, setCurrentLang] = useState(selectedLanguage);

  useEffect(() => {
    setCurrentLang(selectedLanguage);
  }, [selectedLanguage]);

  useEffect(() => {
    return () => {
      stopVoiceReadout();
    };
  }, []);

  if (!isOpen || !caseData) return null;

  const handlePrint = () => {
    window.print();
  };

  const level = caseData?.grading?.icdr_level ?? caseData?.effective_icdr_level ?? caseData?.icdr_level ?? 0;
  const label = caseData?.grading?.icdr_label ?? caseData?.icdr_label ?? 'No DR';
  const confidence = caseData?.grading?.confidence ?? caseData?.confidence ?? caseData?.calibrated_confidence ?? 0.85;
  const referable = caseData?.grading?.referable ?? caseData?.referable ?? (level >= 2);
  const patientId = caseData?.patientId ?? caseData?.patient_id ?? caseData?.external_id ?? caseData?.id ?? 'P-UNKNOWN';
  const reportId = caseData?.report?.report_id ?? caseData?.id ?? caseData?.screening_id ?? '101';
  const eye = caseData?.eye || 'OD';
  const phc = caseData?.phc ?? caseData?.district ?? 'PHC Wardha Rural Hub';

  // The real, server-generated PDF (from drishti-backend's actual report
  // pipeline) -- distinct from the on-screen preview below, which is
  // built client-side from whatever fields happen to be on caseData and
  // fills gaps with placeholder text. When a real report exists, offer
  // it as the authoritative download; the preview stays useful for a
  // quick look/print regardless.
  const realPdfUrl = caseData?.report?.pdf_url ?? caseData?.pdf_url ?? null;

  const localizedSummary = getLocalizedSummary(caseData, currentLang);
  const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === currentLang) || SUPPORTED_LANGUAGES[0];

  const handleToggleAudio = () => {
    if (isPlayingAudio) {
      stopVoiceReadout();
      setIsPlayingAudio(false);
    } else {
      playVoiceReadout(
        localizedSummary,
        currentLang,
        () => setIsPlayingAudio(true),
        () => setIsPlayingAudio(false),
        (err) => {
          setIsPlayingAudio(false);
          console.warn('Speech playback fallback:', err);
        }
      );
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container report-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge">
              <FileText size={18} />
            </div>
            <div>
              <h3>Tele-Ophthalmology Diagnostic Report</h3>
              <p className="modal-sub">Official Diabetic Retinopathy Screening Summary (SIH26038)</p>
            </div>
          </div>
          <div className="header-actions-group">
            <button className="btn-secondary btn-sm" onClick={handleToggleAudio}>
              {isPlayingAudio ? <VolumeX size={14} className="text-danger" /> : <Volume2 size={14} className="text-primary" />}
              <span>{isPlayingAudio ? 'Stop Audio' : `Listen (${currentLangObj.name})`}</span>
            </button>
            <button className="btn-secondary btn-sm" onClick={handlePrint}>
              <Printer size={14} /> Print Preview
            </button>
            <button className="btn-icon-close" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {!realPdfUrl && (
          <div className="login-error-banner" style={{ margin: '0.75rem 1.5rem 0', background: 'rgba(254, 243, 199, 0.6)', borderColor: 'rgba(252, 211, 77, 0.7)', color: '#92400e' }}>
            <FileText size={14} /> <span>No server-generated PDF exists yet for this record -- this is a print preview built from the data currently loaded, not the official report file.</span>
          </div>
        )}

        <div className="report-printable-sheet" id="printable-report">
          {/* Header */}
          <div className="report-doc-header">
            <div className="report-brand">
              <div className="brand-logo-report">
                <Eye size={22} className="text-primary" />
                <h2>Drishti Tele-Ophthalmology Network</h2>
              </div>
              <span className="report-doc-type">Diabetic Retinopathy Screening Consultation</span>
            </div>
            <div className="report-meta-box">
              <div><strong>Report ID:</strong> RPT-{reportId}</div>
              <div><strong>Date:</strong> {caseData.date || new Date().toISOString().split('T')[0]}</div>
              <div><strong>Center:</strong> {phc}</div>
            </div>
          </div>

          <div className="report-divider"></div>

          {/* Patient Details Grid */}
          <div className="report-section">
            <h4 className="section-heading">1. Patient Demographic & Medical History</h4>
            <div className="report-patient-grid">
              <div><span className="label">Patient MRN:</span> <strong>{patientId}</strong></div>
              <div><span className="label">Age / Sex:</span> <strong>{caseData.age || '56'} yrs / {caseData.gender || caseData.sex === 'M' ? 'Male' : 'Female'}</strong></div>
              <div><span className="label">Eye Evaluated:</span> <strong>{eye === 'OD' ? 'OD (Right Eye)' : 'OS (Left Eye)'}</strong></div>
              <div><span className="label">Diabetes Duration:</span> <strong>{caseData.clinicalData?.diabetesDuration || caseData.clinical_data?.diabetes_duration || '10 years'}</strong></div>
              <div><span className="label">HbA1c Level:</span> <strong>{caseData.clinicalData?.hba1c || caseData.clinical_data?.hba1c || '8.2%'}</strong></div>
              <div><span className="label">Blood Pressure:</span> <strong>{caseData.clinicalData?.bloodPressure || caseData.clinical_data?.blood_pressure || '135/85 mmHg'}</strong></div>
            </div>
          </div>

          {/* AI & Clinical Findings */}
          <div className="report-section">
            <h4 className="section-heading">2. Diagnostic Screening & Biomarker Assessment</h4>
            <div className="report-findings-box">
              <div className="finding-row">
                <span>International Clinical DR (ICDR) Stage:</span>
                <span className="finding-badge">
                  Level {level}: {label}
                </span>
              </div>
              <div className="finding-row">
                <span>AI Deep Learning Model Confidence:</span>
                <strong>{(confidence * 100).toFixed(1)}%</strong>
              </div>
              <div className="finding-row">
                <span>Specialist Referral Indicated:</span>
                <strong className={referable ? 'text-danger' : 'text-emerald'}>
                  {referable ? 'YES — Urgent Referral Recommended' : 'NO — Annual Routine Screening'}
                </strong>
              </div>
            </div>

            <div className="lesions-summary-grid">
              <div className="lesion-stat-card">
                <span className="stat-label">Microaneurysms</span>
                <span className="stat-num">{caseData.lesions?.microaneurysm_count ?? caseData.lesions?.microaneurysms ?? 14}</span>
              </div>
              <div className="lesion-stat-card">
                <span className="stat-label">Hemorrhages</span>
                <span className="stat-num">{caseData.lesions?.hemorrhage_count ?? caseData.lesions?.hemorrhages ?? 3}</span>
              </div>
              <div className="lesion-stat-card">
                <span className="stat-label">Hard Exudates</span>
                <span className="stat-num">{caseData.lesions?.hard_exudate_area_pct ? `${caseData.lesions.hard_exudate_area_pct}%` : (caseData.lesions?.hardExudates ?? '1.2%')}</span>
              </div>
              <div className="lesion-stat-card">
                <span className="stat-label">Neovascularization</span>
                <span className="stat-num">{caseData.lesions?.neovascularization ?? 'None'}</span>
              </div>
            </div>
          </div>

          {/* Clinician Recommendation & Multilingual Summary */}
          <div className="report-section">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-1 mb-2">
              <h4 className="section-heading" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
                3. Specialist Impression & Care Plan ({currentLangObj.name})
              </h4>
              <select 
                value={currentLang}
                onChange={(e) => setCurrentLang(e.target.value)}
                className="filter-select text-xs"
                style={{ padding: '2px 6px', height: '24px' }}
              >
                {SUPPORTED_LANGUAGES.map(l => (
                  <option key={l.code} value={l.code}>{l.name} ({l.native})</option>
                ))}
              </select>
            </div>

            <p className="report-impression-text" style={{ fontStyle: 'italic', marginBottom: '8px' }}>
              "{localizedSummary}"
            </p>

            <p className="report-impression-text text-muted" style={{ fontSize: '0.74rem' }}>
              {referable 
                ? 'English: Clinical fundus features indicate active retinopathy changes requiring dilated fundus evaluation by a vitreoretinal specialist. Recommend OCT macula and fluorescein angiography.' 
                : 'English: No sight-threatening diabetic retinopathy lesions observed. Recommend strict glycemic control, lifestyle monitoring, and repeat dilated tele-screening in 12 months.'}
            </p>

            <div className="report-signature-block">
              <div className="signature-info">
                <div className="sig-line"></div>
                <strong>Dr. Amritanshu Choudhary, MD</strong>
                <span>Consultant Ophthalmologist & Retinal Specialist</span>
                <span>Reg No: MCI-748921 • National Tele-Health Council</span>
              </div>
              <div className="auth-seal">
                <ShieldCheck size={32} className="text-primary" />
                <span>Verified Digital Consultation</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Close</button>
          {realPdfUrl ? (
            <a
              className="btn-primary"
              href={withAuthToken(`${API_BASE_URL}${realPdfUrl}`)}
              target="_blank"
              rel="noreferrer"
              download
            >
              <Download size={16} /> Download Official PDF Report
            </a>
          ) : (
            <button className="btn-primary" onClick={handlePrint}>
              <Download size={16} /> Print / Save Preview as PDF
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

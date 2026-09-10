import React, { useState, useEffect } from 'react';
import { Sliders, X, Check, AlertTriangle, FileText } from 'lucide-react';

export default function OverrideModal({ isOpen, onClose, caseData, onSaveOverride }) {
  const currentGrade = caseData?.grading?.icdr_level ?? caseData?.icdr_level ?? 2;
  const currentLabel = caseData?.grading?.icdr_label ?? caseData?.icdr_label ?? 'Moderate NPDR';
  const currentConfidence = caseData?.grading?.confidence ?? caseData?.confidence ?? 0.85;
  const patientId = caseData?.patientId ?? caseData?.patient_id ?? caseData?.id ?? 'P-UNKNOWN';

  const [selectedGrade, setSelectedGrade] = useState(currentGrade);
  const [rationale, setRationale] = useState('');
  const [referralDecision, setReferralDecision] = useState(caseData?.grading?.referable ?? caseData?.referable ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (caseData) {
      const g = caseData?.grading?.icdr_level ?? caseData?.icdr_level ?? 2;
      setSelectedGrade(g);
      setReferralDecision((caseData?.grading?.referable ?? caseData?.referable) ?? (g >= 2));
      setRationale('');
      setSaveError(null);
    }
  }, [caseData, isOpen]);

  if (!isOpen || !caseData) return null;

  const grades = [
    { level: 0, label: 'Level 0: No Apparent Retinopathy (No DR)', referable: false },
    { level: 1, label: 'Level 1: Mild Non-Proliferative DR (Microaneurysms only)', referable: false },
    { level: 2, label: 'Level 2: Moderate Non-Proliferative DR', referable: true },
    { level: 3, label: 'Level 3: Severe Non-Proliferative DR (4-2-1 Rule)', referable: true },
    { level: 4, label: 'Level 4: Proliferative Diabetic Retinopathy (PDR)', referable: true }
  ];

  const handleGradeChange = (level) => {
    setSelectedGrade(level);
    const found = grades.find(g => g.level === level);
    if (found) setReferralDecision(found.referable);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!rationale.trim() || isSaving) return;

    const chosen = grades.find(g => g.level === selectedGrade);
    setSaveError(null);
    setIsSaving(true);
    // onSaveOverride does the actual network request (CaseDetail.jsx) --
    // it used to be fired without waiting, and this modal closed itself
    // immediately regardless of whether the save actually succeeded. Now
    // it stays open and shows the real error until the save confirms.
    const succeeded = await onSaveOverride({
      icdr_level: selectedGrade,
      icdr_label: chosen?.label.split(':')[1]?.trim() || 'Custom Grade',
      confidence: 1.0, // Clinician verified
      referable: referralDecision,
      overrideRationale: rationale,
      isOverridden: true
    });
    setIsSaving(false);

    if (succeeded !== false) {
      onClose();
    } else {
      setSaveError('The override could not be saved -- see the alert for details, or check that drishti-backend is running. Your selection above hasn\'t been lost.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge warning">
              <Sliders size={18} />
            </div>
            <div>
              <h3>Adjust / Override AI Diagnosis</h3>
              <p className="modal-sub">Patient {patientId} • Clinical Expert Audit</p>
            </div>
          </div>
          <button className="btn-icon-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSave} className="modal-form">
          <div className="ai-current-box">
            <span className="text-secondary text-sm">Initial AI Model Prediction:</span>
            <div className="ai-pred-pill">
              <strong>Level {currentGrade}: {currentLabel}</strong>
              <span className="confidence-pill">{(currentConfidence * 100).toFixed(0)}% confidence</span>
            </div>
          </div>

          <div className="form-group">
            <label>Select Revised ICDR Stage (Gold Standard Grading):</label>
            <div className="grade-selector-list">
              {grades.map((g) => (
                <label 
                  key={g.level} 
                  className={`grade-radio-card ${selectedGrade === g.level ? 'selected' : ''}`}
                  onClick={() => handleGradeChange(g.level)}
                >
                  <input 
                    type="radio" 
                    name="icdr_grade" 
                    checked={selectedGrade === g.level} 
                    onChange={() => handleGradeChange(g.level)} 
                  />
                  <div className="grade-card-text">
                    <strong>{g.label}</strong>
                    <span className="text-xs text-muted">
                      {g.referable ? '⚠️ Specialist Referral Indicated' : '✅ Routine Annual Screening'}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Clinical Justification / Key Findings (Required for Audit Log):</label>
            <textarea 
              rows={3}
              className="textarea-control"
              placeholder="e.g. Foveal involvement detected, venous beading in 2 quadrants not fully segmented by AI..."
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              required
            />
            {!rationale.trim() && (
              <span className="text-xs text-muted" style={{ display: 'block', marginTop: '4px' }}>
                A justification is required before this can be saved.
              </span>
            )}
          </div>

          {saveError && (
            <div className="form-group" style={{ margin: 0 }}>
              <div
                style={{
                  background: 'rgba(254, 226, 226, 0.7)',
                  border: '1px solid rgba(252, 165, 165, 0.8)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.6rem 0.85rem',
                  fontSize: '0.82rem',
                  color: 'var(--danger)',
                }}
              >
                {saveError}
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!rationale.trim() || isSaving}
              style={!rationale.trim() || isSaving ? { opacity: 0.45, filter: 'grayscale(35%)', cursor: 'not-allowed' } : undefined}
            >
              <Check size={16} /> {isSaving ? 'Saving...' : 'Save Clinical Grade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

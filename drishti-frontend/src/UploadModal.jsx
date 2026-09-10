import React, { useState } from 'react';
import { UploadCloud, X, Sparkles, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { authFetch, withAuthToken, API_BASE_URL } from './api';

export default function UploadModal({ isOpen, onClose, onCaseAdded, currentUser, selectedLanguage = 'en' }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [externalId, setExternalId] = useState(`ASHA-REG-${Math.floor(10000 + Math.random() * 89999)}`);
  const [patientName, setPatientName] = useState('Rajesh Verma');
  const [patientEye, setPatientEye] = useState('OD'); // OD: Right, OS: Left
  const [patientAge, setPatientAge] = useState('54');
  const [patientGender, setPatientGender] = useState('Male');
  const [phcCenter, setPhcCenter] = useState('PHC Wardha Rural');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!(selectedFile instanceof File)) return;

    setError(null);
    setIsAnalyzing(true);

    try {
      // 1. Register the patient for real -- the gateway rejects /api/screen
      // for any patient_id it hasn't seen, so a fabricated local ID (what
      // this modal used to send) always 404s. That failure used to be
      // swallowed silently and replaced with fully fake stock-photo
      // results; now it surfaces as a real, visible error instead.
      const patientResponse = await authFetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: patientName,
          external_id: externalId,
          age: patientAge ? Number(patientAge) : null,
          sex: patientGender === 'Male' ? 'M' : patientGender === 'Female' ? 'F' : 'O',
          preferred_language: selectedLanguage,
          district: phcCenter.replace('PHC ', '').replace(' Rural', '').replace(' Center', '').replace(' Tele-Clinic', ''),
          facility_id: phcCenter,
          registered_by: currentUser?.username || 'unknown',
        }),
      });

      if (!patientResponse.ok) {
        throw new Error(`Patient registration failed (HTTP ${patientResponse.status})`);
      }
      const patient = await patientResponse.json();

      // 2. Run the actual screening against the newly registered patient.
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('patient_id', patient.id);
      formData.append('eye', patientEye);
      formData.append('language', selectedLanguage);

      const screenResponse = await authFetch('/api/screen', {
        method: 'POST',
        body: formData,
      });

      if (!screenResponse.ok) {
        const errData = await screenResponse.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || `Screening failed (HTTP ${screenResponse.status})`);
      }
      const data = await screenResponse.json();

      // Build the case from the real API response -- real grading, real
      // grading_paths (dual-path disagreement), real lesion counts, and
      // real annotated/Grad-CAM image URLs (with the auth token attached,
      // since these load via plain <img> tags downstream in CaseDetail).
      if (onCaseAdded) {
        onCaseAdded({
          ...data,
          patient_id: patient.id,
          patient_name: patient.name,
          external_id: patient.external_id,
          age: patient.age,
          sex: patient.sex,
          district: patient.district,
          phc: phcCenter,
          eye: patientEye,
          registered_by: patient.registered_by,
          explainability: data.explainability ? {
            ...data.explainability,
            gradcam_image_url: data.explainability.gradcam_image_url
              ? withAuthToken(`${API_BASE_URL}${data.explainability.gradcam_image_url}`)
              : null,
            annotated_image_url: data.explainability.annotated_image_url
              ? withAuthToken(`${API_BASE_URL}${data.explainability.annotated_image_url}`)
              : null,
          } : undefined,
        });
      }
      onClose();
    } catch (err) {
      console.error('Screening submission failed:', err);
      setError(err.message || 'Something went wrong connecting to drishti-backend.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge">
              <Sparkles size={18} />
            </div>
            <div>
              <h3>Upload Fundus Scan for AI Screening</h3>
              <p className="modal-sub">Deep Learning Diabetic Retinopathy Triage</p>
            </div>
          </div>
          <button className="btn-icon-close" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-grid">
            <div className="form-group">
              <label>Patient Full Name</label>
              <input 
                type="text" 
                value={patientName} 
                onChange={(e) => setPatientName(e.target.value)} 
                required 
                className="input-control"
              />
            </div>

            <div className="form-group">
              <label>Patient MRN / Registration ID</label>
              <input 
                type="text" 
                value={externalId} 
                onChange={(e) => setExternalId(e.target.value)} 
                required 
                className="input-control"
              />
            </div>

            <div className="form-group">
              <label>Eye Examined</label>
              <div className="radio-pill-group">
                <button 
                  type="button" 
                  className={`radio-pill ${patientEye === 'OD' ? 'active' : ''}`}
                  onClick={() => setPatientEye('OD')}
                >
                  OD (Right Eye)
                </button>
                <button 
                  type="button" 
                  className={`radio-pill ${patientEye === 'OS' ? 'active' : ''}`}
                  onClick={() => setPatientEye('OS')}
                >
                  OS (Left Eye)
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Patient Age & Gender</label>
              <div className="inline-inputs">
                <input 
                  type="number" 
                  value={patientAge} 
                  onChange={(e) => setPatientAge(e.target.value)} 
                  className="input-control"
                  style={{ width: '80px' }}
                />
                <select 
                  value={patientGender} 
                  onChange={(e) => setPatientGender(e.target.value)}
                  className="input-control"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Originating District PHC Center</label>
              <select 
                value={phcCenter} 
                onChange={(e) => setPhcCenter(e.target.value)}
                className="input-control"
              >
                <option value="PHC Nanded Rural">PHC Nanded Rural</option>
                <option value="PHC Wardha Rural">PHC Wardha Rural</option>
                <option value="PHC Yavatmal Center">PHC Yavatmal Center</option>
                <option value="PHC Amravati Tele-Clinic">PHC Amravati Tele-Clinic</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Fundus Retinal Image</label>
            <div 
              className={`dropzone-box ${dragActive ? 'drag-active' : ''} ${previewUrl ? 'has-preview' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  const file = e.dataTransfer.files[0];
                  setSelectedFile(file);
                  setPreviewUrl(URL.createObjectURL(file));
                  setError(null);
                }
              }}
            >
              {previewUrl ? (
                <div className="preview-container">
                  <img src={previewUrl} alt="Fundus Preview" className="uploaded-thumbnail" />
                  <div className="preview-badge">
                    <CheckCircle size={14} /> Image Loaded
                  </div>
                </div>
              ) : (
                <div className="dropzone-empty">
                  <UploadCloud size={36} className="text-primary mb-2" />
                  <p className="dropzone-prompt">Drag & drop high-resolution fundus photograph here</p>
                  <p className="dropzone-hint">Supports JPEG, PNG (50&deg; Field of view recommended)</p>
                  <label className="btn-secondary mt-2">
                    Browse File
                    <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                  </label>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="login-error-banner">
              <AlertTriangle size={14} /> <span>{error}</span>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={isAnalyzing}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={!previewUrl || isAnalyzing}>
              {isAnalyzing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Running Screening Pipeline...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Analyze & Add to Queue
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Camera, UploadCloud, Sparkles, Volume2, CheckCircle2, AlertTriangle, Layers, FileText, RefreshCw, Loader2, Eye, User, Sliders, VolumeX } from 'lucide-react';
import { SUPPORTED_LANGUAGES, getLocalizedSummary, getSpeechSynthesisText, playVoiceReadout, stopVoiceReadout, API_BASE_URL, authFetch, withAuthToken } from './api';
import PatientResultCard from './PatientResultCard';

export default function ScreeningPortal({ onCaseAdded, selectedLanguage = 'hi', currentUser }) {
  const [patientName, setPatientName] = useState('Ramesh Kumar');
  // Real patient_id comes back from POST /api/patients — the gateway rejects
  // /api/screen for any patient_id it hasn't seen, so we can't fake one here.
  const [patientId, setPatientId] = useState(null);
  const [externalId, setExternalId] = useState(`ASHA-REG-${Math.floor(10000 + Math.random() * 89999)}`);
  const [age, setAge] = useState('54');
  const [sex, setSex] = useState('M');
  const [eye, setEye] = useState('OD');
  const [district, setDistrict] = useState('Nanded');
  const [preferredLang, setPreferredLang] = useState(selectedLanguage);
  const [resultCardView, setResultCardView] = useState(false);
  
  // Real API States
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [screeningResult, setScreeningResult] = useState(null);
  const [benGrahamView, setBenGrahamView] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [noVoiceWarning, setNoVoiceWarning] = useState(null);

  useEffect(() => {
    setPreferredLang(selectedLanguage);
  }, [selectedLanguage]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleRunScreening = async () => {
    if (!selectedFile) {
      alert("Please select a fundus image to upload.");
      return;
    }

    setIsProcessing(true);
    setScreeningResult(null);
    setAudioError(false);

    try {
      // 1. Register the patient (POST /api/patients) to get a real,
      //    server-issued patient_id. The gateway persists patients in
      //    SQLite and will 404 /api/screen for any id it hasn't seen, so
      //    this step can't be skipped -- a new registration is created for
      //    each screening submission, matching an ASHA worker registering
      //    the patient at point of capture.
      const patientResponse = await authFetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: patientName,
          external_id: externalId,
          age: age ? Number(age) : null,
          sex,
          preferred_language: preferredLang,
          district,
          registered_by: currentUser?.username || 'unknown',
        }),
      });

      if (!patientResponse.ok) {
        throw new Error(`Patient registration failed (HTTP ${patientResponse.status})`);
      }

      const patient = await patientResponse.json();
      setPatientId(patient.id);

      // 2. Run the actual screening against the newly registered patient.
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('patient_id', patient.id);
      formData.append('eye', eye);
      formData.append('language', preferredLang);

      const response = await authFetch('/api/screen', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setScreeningResult(data);

      if (data.status === 'graded' && onCaseAdded && data.grading?.requires_human_review) {
        onCaseAdded(data);
      }
    } catch (error) {
      console.error('Error submitting screening:', error);
      alert('Failed to connect to backend screening pipeline. Is drishti-backend running on ' + API_BASE_URL + '?');
    } finally {
      setIsProcessing(false);
    }
  };

  const activeLangObj = SUPPORTED_LANGUAGES.find(l => l.code === preferredLang) || SUPPORTED_LANGUAGES[0];

  return (
    <div className="view-container">
      <div className="dashboard-header-flex">
        <div>
          <h1 className="dashboard-main-title">ASHA / Field Worker Screening Studio</h1>
          <p className="dashboard-subtitle">Point-of-care fundus capture & validation (Connected to FastAPI)</p>
        </div>
        <div className="mathworks-chip">
          <Sparkles size={14} className="text-primary" />
          <span>Live API Connection</span>
        </div>
      </div>

      <div className="screening-layout-grid">
        <div className="card screening-form-card">
          <div className="card-header-clean">
            <div className="card-title-group">
              <User size={18} className="text-primary" />
              <div>
                <h2>1. Patient & Capture Information</h2>
                <span className="card-sub-title">Submitting directly to the DRISHTI screening pipeline</span>
              </div>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Patient Full Name</label>
              <input type="text" value={patientName} onChange={(e) => setPatientName(e.target.value)} className="input-control" />
            </div>

            <div className="form-group">
              <label>ASHA Registration ID</label>
              <input type="text" value={externalId} onChange={(e) => setExternalId(e.target.value)} className="input-control" />
            </div>

            <div className="form-group">
              <label>Age & Sex</label>
              <div className="inline-inputs">
                <input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="input-control" style={{ width: '80px' }} />
                <select value={sex} onChange={(e) => setSex(e.target.value)} className="input-control">
                  <option value="M">Male (M)</option>
                  <option value="F">Female (F)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Eye Examined</label>
              <div className="radio-pill-group">
                <button type="button" className={`radio-pill ${eye === 'OD' ? 'active' : ''}`} onClick={() => setEye('OD')}>OD (Right Eye)</button>
                <button type="button" className={`radio-pill ${eye === 'OS' ? 'active' : ''}`} onClick={() => setEye('OS')}>OS (Left Eye)</button>
              </div>
            </div>

            <div className="form-group mt-3">
              <label>Upload Fundus Photograph (JPEG/PNG)</label>
              <input type="file" accept="image/png, image/jpeg" onChange={handleFileChange} className="input-control" />
            </div>
          </div>

          <button type="button" className="btn-primary full-width mt-4" onClick={handleRunScreening} disabled={isProcessing || !selectedFile}>
            {isProcessing ? <><Loader2 size={16} className="animate-spin" /> Uploading to API Pipeline...</> : <><UploadCloud size={16} /> Submit Live Screening</>}
          </button>
        </div>

        <div className="screening-output-column">
          {screeningResult ? (
            screeningResult.status === 'rejected' ? (
              <div className="card reject-result-card">
                <div className="reject-header">
                  <div className="reject-icon-box"><AlertTriangle size={24} className="text-danger" /></div>
                  <div>
                    <h3 className="text-danger">Image Quality Gate Failed</h3>
                    <span className="text-sm text-muted">Protects against misdiagnosis</span>
                  </div>
                </div>
                <div className="quality-scores-box">
                  <div className="quality-score-item">
                    <span>Sharpness:</span><strong className="text-danger">{screeningResult.quality?.sharpness_score}</strong>
                  </div>
                  <div className="quality-score-item">
                    <span>Illumination:</span><strong>{screeningResult.quality?.illumination_score}</strong>
                  </div>
                </div>
                <div className="recapture-instruction-box">
                  <strong>Actionable Feedback:</strong>
                  <p>{screeningResult.recapture_message}</p>
                </div>
                <button className="btn-secondary full-width mt-3" onClick={() => setSelectedFile(null)}>
                  <RefreshCw size={14} /> Upload New Image
                </button>
              </div>
            ) : (
              <div className="card graded-result-card">
                <div className="flex-between mb-3 pb-2 border-b">
                  <div className="flex-center-gap">
                    <Sparkles size={16} className="text-primary" />
                    <strong>Diagnostic Outcome</strong>
                  </div>
                  <button className="btn-ghost btn-sm text-xs" onClick={() => setResultCardView(!resultCardView)}>
                    {resultCardView ? 'Show Technical View' : 'Show Patient Card'}
                  </button>
                </div>

                {resultCardView ? (
                  <PatientResultCard 
                    caseData={{...screeningResult, patient_name: patientName, patient_id: patientId, age, gender: sex, eye}}
                    selectedLanguage={preferredLang}
                  />
                ) : (
                  <>
                    <div className="graded-header">
                      <div className="grade-badge-huge">
                        <span className="grade-title">ICDR Grade</span>
                        <strong className="grade-number">Level {screeningResult.grading?.icdr_level}</strong>
                        <span className="grade-name">{screeningResult.grading?.icdr_label}</span>
                      </div>
                      <div className="calibrated-confidence-box">
                        <span className="text-xs text-muted">Confidence Score</span>
                        <span className="conf-value text-primary">
                          {Math.round((screeningResult.grading?.confidence || 0) * 100)}%
                        </span>
                      </div>
                    </div>

                    {screeningResult.grading?.requires_human_review ? (
                      <div className="dual-path-alert">
                        <AlertTriangle size={16} className="text-amber" />
                        <div><strong>Requires Human Review:</strong> Confidence threshold triggered ophthalmologist review queue.</div>
                      </div>
                    ) : (
                      <div className="dual-path-success">
                        <CheckCircle2 size={16} className="text-emerald" />
                        <span>High confidence grading. No immediate specialist review required.</span>
                      </div>
                    )}

                    <div className="voice-readout-card mt-3">
                      <div className="voice-card-header">
                        <Volume2 size={18} className="text-primary" />
                        <div>
                          <h4 className="text-xs font-bold">Voice Read-out</h4>
                          <span className="text-xs text-muted">
                            {SUPPORTED_LANGUAGES.find(l => l.code === preferredLang)?.name || preferredLang} &middot; plays instantly, works offline
                          </span>
                        </div>
                      </div>
                      <p className="voice-transcript mb-3">{getLocalizedSummary(screeningResult, preferredLang) || screeningResult.report?.summary_text}</p>

                      <button
                        type="button"
                        className="btn-secondary btn-sm flex-center-gap"
                        onClick={() => {
                          if (isPlayingAudio) {
                            stopVoiceReadout();
                            setIsPlayingAudio(false);
                            return;
                          }
                          setNoVoiceWarning(null);
                          playVoiceReadout(
                            getSpeechSynthesisText(screeningResult, preferredLang),
                            preferredLang,
                            () => setIsPlayingAudio(true),
                            () => setIsPlayingAudio(false),
                            () => { setIsPlayingAudio(false); setAudioError(true); },
                            (langName) => setNoVoiceWarning(
                              `No ${langName} voice is installed on this device -- playing with the browser's default voice instead. Add ${langName} under Windows Settings \u2192 Time & language \u2192 Language & region (with speech support) for accurate pronunciation.`
                            )
                          );
                        }}
                      >
                        {isPlayingAudio ? <><VolumeX size={16} /> Stop</> : <><Volume2 size={16} /> Play Voice Read-out</>}
                      </button>

                      {audioError && (
                        <p className="text-xs text-danger mt-1">
                          This browser doesn't support speech synthesis for the selected language. Try a different browser or language.
                        </p>
                      )}

                      {noVoiceWarning && (
                        <p className="text-xs text-muted mt-1" style={{ maxWidth: '480px' }}>{noVoiceWarning}</p>
                      )}

                      {screeningResult.report?.audio_url && (
                        <a
                          className="text-xs text-muted mt-1"
                          style={{ display: 'inline-block' }}
                          href={withAuthToken(`${API_BASE_URL}${screeningResult.report.audio_url}`)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download server-generated MP3 (backend TTS)
                        </a>
                      )}
                    </div>

                    {screeningResult.explainability?.gradcam_image_url && (
                      <div className="ben-graham-toggle-box mt-3">
                        <button className={`btn-tool-chip ${benGrahamView ? 'active' : ''}`} onClick={() => setBenGrahamView(!benGrahamView)}>
                          <Layers size={13} /> {benGrahamView ? 'Viewing GradCAM Heatmap' : 'Toggle GradCAM Visualizer'}
                        </button>
                        <div className="retina-thumb-wrap">
                          <img 
                            src={benGrahamView ? withAuthToken(`${API_BASE_URL}${screeningResult.explainability.gradcam_image_url}`) : (selectedFile ? URL.createObjectURL(selectedFile) : '')} 
                            alt="Fundus Explanation" 
                            style={{ maxWidth: '100%', borderRadius: '4px' }}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          ) : (
            <div className="card empty-studio-placeholder">
              <Camera size={44} className="text-primary mb-3" />
              <h3>Awaiting Image Upload</h3>
              <p className="text-muted text-sm max-w-md text-center">
                Select a fundus photo on the left and click "Submit Live Screening" to run the API image pipeline.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
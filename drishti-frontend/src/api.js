/**
 * DRISHTI REST API Client & Multilingual Localization Service
 * Fully implements the REST API Contract for Smart India Hackathon SIH26038
 * Base URL: http://localhost:8000 (with automatic graceful fallback to calibrated mock dataset)
 */

export const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) 
  ? import.meta.env.VITE_API_BASE_URL 
  : 'http://localhost:8000';

// --- Authentication ---------------------------------------------------
// Real accounts backed by drishti-backend (/api/auth/*), not the old
// fake "pick a role, get logged in instantly" flow. Token lives in
// localStorage so a page refresh doesn't force a re-login every time.

const AUTH_TOKEN_KEY = 'drishti_auth_token';
let onUnauthorizedCallback = null;

export function getAuthToken() {
  try { return localStorage.getItem(AUTH_TOKEN_KEY); } catch { return null; }
}

export function setAuthToken(token) {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch { /* localStorage unavailable (e.g. private browsing) -- auth just won't persist across refresh */ }
}

// Registered once by App.jsx so any authFetch that gets a 401 (expired or
// revoked session) can trigger a clean logout instead of leaving the UI
// stuck showing a half-authenticated, error-throwing state.
export function setOnUnauthorized(callback) {
  onUnauthorizedCallback = callback;
}

/** fetch() wrapper that attaches the bearer token automatically and
 * reacts to session expiry. Use this instead of raw fetch() for every
 * endpoint that requires login. */
export async function authFetch(path, options = {}) {
  const token = getAuthToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (response.status === 401 && onUnauthorizedCallback) {
    onUnauthorizedCallback();
  }
  return response;
}

/** Report files (PDF/PNG/MP3) are loaded via plain <img src>/<a href>/
 * <audio src> tags, which can't attach a custom Authorization header the
 * way authFetch() can -- the gateway accepts the session token as a
 * `?token=` query param specifically for this. Use this whenever you
 * build a URL for one of those tags, e.g.
 * <img src={withAuthToken(`${API_BASE_URL}${annotated_image_url}`)} />
 */
export function withAuthToken(url) {
  if (!url) return url;
  const token = getAuthToken();
  if (!token) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}token=${encodeURIComponent(token)}`;
}

export async function apiRegister({ username, password, fullName, role, facilityId, district }) {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username, password, full_name: fullName, role,
      facility_id: facilityId || null, district: district || null,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || `Registration failed (HTTP ${response.status})`);
  setAuthToken(data.token);
  return data.user;
}

export async function apiLogin(username, password) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || `Sign-in failed (HTTP ${response.status})`);
  setAuthToken(data.token);
  return data.user;
}

export async function apiLogout() {
  try {
    await authFetch('/api/auth/logout', { method: 'POST' });
  } catch { /* best-effort -- clear local state regardless */ }
  setAuthToken(null);
}

export async function apiFetchCurrentUser() {
  const response = await authFetch('/api/auth/me');
  if (!response.ok) return null;
  return response.json();
}

// Which sidebar tabs each role is allowed to see -- mirrors the
// server-side role checks on the corresponding endpoints (see
// drishti-backend/python/gateway/main.py), so a role's *domain* is
// enforced in two places, not just hidden in the UI:
//   asha:   Screening Portal, Patient History (own patients only)
//   doctor: Review Queue, Patient History (full registry), Benchmarks
//   admin:  Program Analytics, Capacity Planner, Patient History (full), Benchmarks
export const ROLE_ALLOWED_VIEWS = {
  asha: ['screening', 'history'],
  doctor: ['queue', 'detail', 'history', 'benchmarks'],
  admin: ['dashboard', 'capacity', 'history', 'benchmarks'],
};

export function getDefaultViewForRole(role) {
  if (role === 'doctor') return 'queue';
  if (role === 'admin') return 'dashboard';
  return 'screening';
}

export async function apiScreenFundus(formData) {
  try {
    const response = await authFetch('/api/screen', {
      method: 'POST',
      body: formData
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (err) {
    console.warn(`[ML Gateway] Backend API (${API_BASE_URL}) unavailable, using local pipeline:`, err.message);
    return null;
  }
}

export const SUPPORTED_LANGUAGES = [
  // 22 Official Languages Recognized by Government of India (8th Schedule) + English
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', locale: 'hi-IN', region: 'National' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', locale: 'mr-IN', region: 'Maharashtra' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', locale: 'bn-IN', region: 'West Bengal / Tripura' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', locale: 'ta-IN', region: 'Tamil Nadu' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', locale: 'te-IN', region: 'Andhra Pradesh / Telangana' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', locale: 'gu-IN', region: 'Gujarat' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', locale: 'kn-IN', region: 'Karnataka' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', locale: 'ml-IN', region: 'Kerala' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', locale: 'pa-IN', region: 'Punjab' },
  { code: 'ur', name: 'Urdu', native: 'اردو', locale: 'ur-IN', region: 'National' },
  { code: 'as', name: 'Assamese', native: 'অসমীয়া', locale: 'as-IN', region: 'Assam' },
  { code: 'or', name: 'Odia', native: 'ଓଡ଼ିଆ', locale: 'or-IN', region: 'Odisha' },
  { code: 'mai', name: 'Maithili', native: 'मैथिली', locale: 'mai-IN', region: 'Bihar / Jharkhand' },
  { code: 'kok', name: 'Konkani', native: 'कोंकणी', locale: 'kok-IN', region: 'Goa / Maharashtra' },
  { code: 'ne', name: 'Nepali', native: 'नेपाली', locale: 'ne-IN', region: 'Sikkim / West Bengal' },
  { code: 'doi', name: 'Dogri', native: 'डोगरी', locale: 'doi-IN', region: 'Jammu & Kashmir' },
  { code: 'ks', name: 'Kashmiri', native: 'كٲشُر / कॉशुर', locale: 'ks-IN', region: 'Jammu & Kashmir' },
  { code: 'sd', name: 'Sindhi', native: 'سنڌي / सिंधी', locale: 'sd-IN', region: 'National' },
  { code: 'sa', name: 'Sanskrit', native: 'संस्कृतम्', locale: 'sa-IN', region: 'National' },
  { code: 'sat', name: 'Santali', native: 'ᱥᱟᱱᱛᱟᱲᱤ', locale: 'sat-IN', region: 'Jharkhand / Odisha' },
  { code: 'mni', name: 'Manipuri', native: 'মৈতৈলোন্', locale: 'mni-IN', region: 'Manipur' },
  { code: 'brx', name: 'Bodo', native: 'बड़ो', locale: 'brx-IN', region: 'Assam / Bodoland' },
  { code: 'en', name: 'English', native: 'English', locale: 'en-IN', region: 'National / Clinical' }
];

export const ROLE_PROFILES = [
  {
    role: 'doctor',
    name: 'Dr. Ananya Sen, MS',
    title: 'Senior Vitreoretinal Specialist',
    organization: 'District Tele-Ophthalmology Reading Hub',
    jurisdiction: 'Nanded & Yavatmal Clinical Tele-Reading Center',
    id: 'DOC-ND-8842',
    color: 'blue',
    defaultView: 'queue',
    description: 'Prioritized urgency-first review queue, Retinal Studio with Grad-CAM & lesion overlays, and diagnostic override audit platform.'
  },
  {
    role: 'admin',
    name: 'Dr. Rajesh Deshmukh, MD',
    title: 'State Nodal Officer & Program Director',
    organization: 'Directorate of Health Services (DHS)',
    jurisdiction: 'Maharashtra State Health Mission (36 Districts)',
    id: 'ADM-MH-1002',
    color: 'indigo',
    defaultView: 'dashboard',
    description: 'State & district analytics, clinical care pathway funnel, live Simulink capacity load telemetry, and AI model drift diagnostics.'
  },
  {
    role: 'asha',
    name: 'Sunita Kamble',
    title: 'ASHA Field Screener #17',
    organization: 'Primary Health Center (PHC) Nanded Rural',
    jurisdiction: 'Wadwani & Limbgaon Village Cluster',
    id: 'ASHA-NR-017',
    color: 'emerald',
    defaultView: 'screening',
    description: 'Point-of-care fundus screening, real-time AI quality check, 23-language voice playback, and assigned village patient history.'
  }
];

export const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif-1',
    type: 'urgent',
    title: 'High Priority Referral Flagged',
    desc: 'Patient 9f1c2a01 (Ramesh Kumar) at PHC Nanded Rural detected with Severe NPDR (93% confidence). Specialist review required within 24h.',
    time: '12 mins ago',
    patient_id: '9f1c2a01',
    patientId: '9f1c2a01',
    case_id: 'scr_101',
    caseId: 'scr_101',
    read: false
  },
  {
    id: 'notif-2',
    type: 'warning',
    title: 'Dual-Path Disagreement Signal',
    desc: 'Patient 9f1c2a02 (Sunita Patil) has Moderate NPDR with 65% calibrated confidence. Rule-based vs learned model disagreement.',
    time: '45 mins ago',
    patient_id: '9f1c2a02',
    patientId: '9f1c2a02',
    case_id: 'scr_102',
    caseId: 'scr_102',
    read: false
  },
  {
    id: 'notif-3',
    type: 'info',
    title: 'District Batch Sync Complete',
    desc: 'PHC Yavatmal Center successfully uploaded 28 new fundus captures with full telemetry.',
    time: '2 hours ago',
    patient_id: null,
    patientId: null,
    case_id: null,
    caseId: null,
    read: false
  }
];

// Native Clinical Translations across all 22 Official Languages + English
export const CLINICAL_TRANSLATIONS = {
  hi: {
    0: 'कोई डायबिटिक रेटिनोपैथी नहीं पाई गई (स्तर 0)। सामान्य वार्षिक जांच की सलाह दी जाती है।',
    1: 'हल्की डायबिटिक रेटिनोपैथी (स्तर 1)। रक्त शर्करा नियंत्रण और वार्षिक नेत्र परीक्षण आवश्यक है।',
    2: 'मध्यम डायबिटिक रेटिनोपैथी (स्तर 2) पाई गई है। नेत्र विशेषज्ञ से 3 महीने के भीतर जांच करवाएं।',
    3: 'गंभीर डायबिटिक रेटिनोपैथी (स्तर 3) पाई गई है। 2 से 4 सप्ताह के भीतर रेटिना विशेषज्ञ से तत्काल जांच आवश्यक है।',
    4: 'प्रोलिफ़ेरेटिव डायबिटिक रेटिनोपैथी (स्तर 4 - उच्च जोखिम)। दृष्टि बचाने हेतु तत्काल लेजर उपचार की आवश्यकता है।'
  },
  mr: {
    0: 'कोणतीही डायबेटिक रेटिनोपॅथी आढळली नाही (स्तर 0). वार्षिक नियमित तपासणीचा सल्ला दिला जातो.',
    1: 'सौम्य डायबेटिक रेटिनोपॅथी (स्तर 1). रक्तातील साखर नियंत्रण आणि वार्षिक डोळ्यांची तपासणी आवश्यक.',
    2: 'मध्यम डायबेटिक रेटिनोपॅथी (स्तर 2) आढळली आहे. 3 महिन्यांत नेत्रतज्ज्ञांचा सल्ला घ्यावा.',
    3: 'गंभीर डायबेटिक रेटिनोपॅथी (स्तर 3) आढळली आहे. 2 ते 4 आठवड्यांत रेटिना तज्ज्ञांचा त्वरित सल्ला घ्यावा.',
    4: 'प्रोलिफेरेटिव्ह डायबेटिक रेटिनोपॅथी (स्तर 4). दृष्टी संरक्षणासाठी त्वरित लेझर उपचारांची गरज आहे.'
  },
  bn: {
    0: 'কোনো ডায়াবেটিক রেটিনোপ্যাথি শনাক্ত হয়নি (লেভেল 0)। বার্ষিক নিয়মিত পরীক্ষার পরামর্শ দেওয়া হচ্ছে।',
    1: 'মৃদু ডায়াবেটিক রেটিনোপ্যাথি (লেভেল 1)। রক্তে শর্করার মাত্রা নিয়ন্ত্রণ করুন।',
    2: 'মাঝারি ডায়াবেটিক রেটিনোপ্যাথি (লেভেল 2)। ৩ মাসের মধ্যে চক্ষু বিশেষজ্ঞের পরামর্শ নিন।',
    3: 'গুরুতর ডায়াবেটিক রেটিনোপ্যাথি (লেভেল 3)। ২-৪ সপ্তাহের মধ্যে রেটিনা বিশেষজ্ঞের জরুরি পরামর্শ প্রয়োজন।',
    4: 'প্রলিফারেটিভ ডায়াবেটিক রেটিনোপ্যাথি (লেভেল 4)। দৃষ্টিশক্তি রক্ষায় অবিলম্বে লেজার চিকিৎসা প্রয়োজন।'
  },
  ta: {
    0: 'நீரிழிவு விழித்திரை நோய் கண்டறியப்படவில்லை (நிலை 0). வருடாந்திர பரிசோதனை பரிந்துரைக்கப்படுகிறது.',
    1: 'லேசான நீரிழிவு ரெட்டினோபதி (நிலை 1). சர்க்கரை அளவைக் கட்டுப்படுத்தவும்.',
    2: 'மிதமான நீரிழிவு ரெட்டினோபதி (நிலை 2). 3 மாதங்களுக்குள் கண் மருத்துவரை அணுகவும்.',
    3: 'தீவிர நீரிழிவு ரெட்டினோபதி (நிலை 3). 2-4 வாரங்களுக்குள் உடனடியாக விழித்திரை நிபுணரை அணுகவும்.',
    4: 'முற்றிய நீரிழிவு ரெட்டினோபதி (நிலை 4). பார்வை இழப்பைத் தடுக்க உடனடியாக லேசர் சிகிச்சை தேவை.'
  },
  te: {
    0: 'డయాబెటిక్ రెటినోపతి లక్షణాలు లేవు (స్థాయి 0). వార్షిక పరీక్ష సిఫార్సు చేయబడింది.',
    1: 'తేలికపాటి డయాబెటిక్ రెటినోపతి (స్థాయి 1). చక్కెర స్థాయిలను నియంత్రించండి.',
    2: 'మితమైన డయాబెటిక్ రెటినోపతి (స్థాయి 2). 3 నెలల్లో కంటి వైద్యుడిని సంप्रదించండి.',
    3: 'తీవ్రమైన డయాబెటిక్ రెటినోపతి (స్థాయి 3). 2-4 వారాలలో రెటీనా నిపుణుడిని అత్యవసరంగా సంప్రదించండి.',
    4: 'ప్రొలిఫెరేటివ్ డయాబెటిక్ రెటినోపతి (స్థాయి 4). వెంటనే లేజర్ చికిత్స అవసరం.'
  },
  gu: {
    0: 'કોઈ ડાયાબિટીક રેટિનોપેથી જોવા મળી નથી (સ્તર 0). વાર્ષિક તપાસની ભલામણ.',
    1: 'હળવી ડાયાબિટીક રેટિનોપેથી (સ્તર 1). શર્કરા નિયંત્રણ જરૂરી છે.',
    2: 'મધ્યમ ડાયાબિટીક રેટિનોપેથી (સ્તર 2). 3 મહિનામાં આંખના નિષ્ણાતનો સંપર્ક કરો.',
    3: 'ગંભીર ડાયાબિટીક રેટિનોપેથી (સ્તર 3). 2 થી 4 અઠવાડિયામાં તાત્કાલિક નિષ્ણાત સલાહ લો.',
    4: 'પ્રોલિફેરેટિવ ડાયાબિટીક રેટિનોપેથી (સ્તર 4). દ્રષ્ટિ બચાવવા તાત્કાલિક લેસર સારવાર જરૂરી.'
  },
  kn: {
    0: 'ಯಾವುದೇ ಮಧುಮೇಹ ರೆಟಿನೋಪತಿ ಕಂಡುಬಂದಿಲ್ಲ (ಹಂತ 0). ವಾರ್ಷಿಕ ಪರೀಕ್ಷೆ ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ.',
    1: 'ಸೌಮ್ಯ ಮಧುಮೇಹ ರೆಟಿನೋಪತಿ (ಹಂತ 1). ಸಕ್ಕರೆ ನಿಯಂತ್ರಣ ಅಗತ್ಯ.',
    2: 'ಮಧ್ಯಮ ಮಧುಮೇಹ ರೆಟಿನೋಪತಿ (ಹಂತ 2). 3 ತಿಂಗಳಲ್ಲಿ ನೇತ್ರ ತಜ್ಞರನ್ನು ಭೇಟಿ ಮಾಡಿ.',
    3: 'ತೀವ್ರ ಮಧುಮೇಹ ರೆಟಿನೋಪತಿ (ಹಂತ 3). 2-4 ವಾರಗಳಲ್ಲಿ ತುರ್ತು ರೆಟಿನಾ ತಜ್ಞರ ಸಲಹೆ ಪಡೆಯಿರಿ.',
    4: 'ಪ್ರೊಲಿಫರೇಟಿವ್ ಡಯಾಬಿಟಿಕ್ ರೆಟಿನೋಪತಿ (ಹಂತ 4). ದೃಷ್ಟಿ ರಕ್ಷಿಸಲು ತಕ್ಷಣ ಲೇಸರ್ ಚಿಕಿತ್ಸೆ ಅಗತ್ಯ.'
  },
  ml: {
    0: 'ഡയബറ്റിക് റെറ്റിനോപ്പതി കണ്ടെത്തിയില്ല (ലെവൽ 0). വാർഷിക പരിശോധന ശുപാർശ ചെയ്യുന്നു.',
    1: 'നേരിയ ഡയബറ്റിക് റെറ്റിനോപ്പതി (ലെവൽ 1). രക്തത്തിലെ പഞ്ചസാര നിയന്ത്രിക്കുക.',
    2: 'മിതമായ ഡയബറ്റിക് റെറ്റിനോപ്പതി (ലെവൽ 2). 3 മാസത്തിനകം നേത്രരോഗവിദഗ്ദ്ധനെ കാണുക.',
    3: 'ഗുരുതരമായ ഡയബറ്റിക് റെറ്റിനോപ്പതി (ലെവൽ 3). 2-4 ആഴ്ചയ്ക്കുള്ളിൽ വിദഗ്ദ്ധ പരിശോധന ആവശ്യം.',
    4: 'പ്രോലിഫെറേറ്റീവ് ഡയബറ്റിക് റെറ്റിനോപ്പതി (ലെവൽ 4). ഉടനടി ലേസർ ചികിത്സ ആവശ്യമാണ്.'
  },
  pa: {
    0: 'ਕੋਈ ਡਾਇਬੀਟਿਕ ਰੈਟੀਨੋਪੈਥੀ ਨਹੀਂ ਮਿਲੀ (ਪੱਧਰ 0)। ਸਾਲਾਨਾ ਜਾਂਚ ਦੀ ਸਲਾਹ।',
    1: 'ਹਲਕੀ ਡਾਇਬੀਟਿਕ ਰੈਟੀਨੋਪੈਥੀ (ਪੱਧਰ 1)। ਸ਼ੂਗਰ ਕੰਟਰੋਲ ਰੱਖੋ।',
    2: 'ਦਰਮਿਆਨੀ ਡਾਇਬੀਟਿਕ ਰੈਟੀਨੋਪੈਥੀ (ਪੱਧਰ 2)। 3 ਮਹੀਨਿਆਂ ਵਿੱਚ ਅੱਖਾਂ ਦੇ ਡਾਕਟਰ ਨੂੰ ਦਿਖਾਓ।',
    3: 'ਗੰਭੀਰ ਡਾਇਬੀਟਿਕ ਰੈਟੀਨੋਪੈਥੀ (ਪੱਧਰ 3)। 2 ਤੋਂ 4 ਹਫ਼ਤਿਆਂ ਵਿੱਚ ਮਾਹਿਰ ਦੀ ਜਾਂਚ ਲਾਜ਼ਮੀ ਹੈ।',
    4: 'ਪ੍ਰੋਲੀਫੇਰੇਟਿਵ ਡਾਇਬੀਟਿਕ ਰੈਟੀਨੋਪੈਥੀ (ਪੱਧਰ 4)। ਅੱਖਾਂ ਦੀ ਰੌਸ਼ਨੀ ਬਚਾਉਣ ਲਈ ਤੁਰੰਤ ਲੇਜ਼ਰ ਇਲਾਜ ਦੀ ਲੋੜ।'
  },
  ur: {
    0: 'ذیابیطس ریٹینوپیتھی کی کوئی علامت نہیں پائی گئی (لیول 0)۔ سالانہ معمول کے معائنے کی تجویز ہے۔',
    1: 'معمولی ذیابیطس ریٹینوپیتھی (لیول 1)۔ بلڈ شوگر کنٹرول اور سالانہ آنکھوں کا معائنہ ضروری ہے۔',
    2: 'درمیانی ذیابیطس ریٹینوپیتھی (لیول 2) پائی گئی ہے۔ 3 ماہ کے اندر آنکھوں کے ماہر سے رجوع کریں۔',
    3: 'شدید ذیابیطس ریٹینوپیتھی (لیول 3) پائی گئی ہے۔ 2 سے 4 ہفتوں میں ریٹینا اسپیشلسٹ سے فوری معائنہ کروائیں۔',
    4: 'پرولیفریٹو ذیابیطس ریٹینوپیتھی (لیول 4 - ہائی رسک)۔ بینائی بچانے کے لیے فوری لیزر علاج کی ضرورت ہے۔'
  },
  as: {
    0: 'কোনো ডায়াবেটিক ৰেটিনোপেথি ধৰা পৰা নাই (স্তৰ ০)। বাৰ্ষিক নিয়মীয়া পৰীক্ষাৰ পৰামৰ্শ দিয়া হৈছে।',
    1: 'মৃদু ডায়াবেটিক ৰেটিনোপেথি (স্তৰ ১)। তেজৰ শৰ্কৰা নিয়ন্ত্ৰণ আৰু বাৰ্ষিক চকু পৰীক্ষা আৱশ্যক।',
    2: 'মধ্যমীয়া ডায়াবেটিক ৰেটিনোপেথি (স্তৰ ২)। ৩ মাহৰ ভিতৰত চকু বিশেষজ্ঞৰ পৰামৰ্শ লওক।',
    3: 'গুৰুতৰ ডায়াবেটিক ৰেটিনোপেথি (স্তৰ ৩)। ২ৰ পৰা ৪ সপ্তাহৰ ভিতৰত ৰেটিনা বিশেষজ্ঞৰ জৰুৰী পৰামৰ্শ প্ৰয়োজন।',
    4: 'প্ৰলিফেৰেটিভ ডায়াবেটিক ৰেটিনোপেথি (স্তৰ ৪)। দৃষ্টিশক্তি ৰক্ষাৰ বাবে তাৎক্ষণিক লেজাৰ চিকিৎসাৰ প্ৰয়োজন।'
  },
  or: {
    0: 'କୌଣସି ଡାଇବେଟିକ୍ ରେଟିନୋପାଥି ଚିହ୍ନଟ ହୋଇନାହିଁ (ସ୍ତର 0) | ବାର୍ଷିକ ନିୟମିତ ପରୀକ୍ଷା ପରାମର୍ଶ ଦିଆଯାଉଛି |',
    1: 'ସାମାନ୍ୟ ଡାଇବେଟିକ୍ ରେଟିନୋପାଥି (ସ୍ତର 1) | ରକ୍ତ ଶର୍କରା ନିୟନ୍ତ୍ରଣ ଏବଂ ବାର୍ଷିକ ଚକ୍ଷୁ ପରୀକ୍ଷା ଆବଶ୍ୟକ |',
    2: 'ମଧ୍ୟମ ଡାଇବେଟିକ୍ ରେଟିନୋପାଥି (ସ୍ତର 2) | 3 ମାସ ମଧ୍ୟରେ ଚକ୍ଷୁ ବିଶେଷଜ୍ଞଙ୍କ ପରାମର୍ଶ ନିଅନ୍ତୁ |',
    3: 'ଗୁରୁତର ଡାଇବେଟିକ୍ ରେଟିନୋପାଥି (ସ୍ତର 3) | 2 ରୁ 4 ସପ୍ତାହ ମଧ୍ୟରେ ରେଟିନା ବିଶେଷଜ୍ଞଙ୍କ ତୁରନ୍ତ ପରାମର୍ଶ ଆବଶ୍ୟକ |',
    4: 'ପ୍ରୋଲିଫେରେଟିଭ୍ ଡାଇବେଟିକ୍ ରେଟିନୋପାଥି (ସ୍ତର 4) | ଦୃଷ୍ଟିଶକ୍ତି ରକ୍ଷା ପାଇଁ ତୁରନ୍ତ ଲେଜର ଚିକିତ୍ସା ଆବଶ୍ୟକ |'
  },
  mai: {
    0: 'कोनो डायबिटिक रेटिनोपैथी नहि भेटल (स्तर 0)। वार्षिक नियमित जांचक सलाह देल जाइत अछि।',
    1: 'हलुक डायबिटिक रेटिनोपैथी (स्तर 1)। रक्त शर्करा नियंत्रण आ वार्षिक आँखि जांच आवश्यक।',
    2: 'मध्यम डायबिटिक रेटिनोपैथी (स्तर 2)। 3 मासक भीतर आँखिक विशेषज्ञ सँ जांच कराउ।',
    3: 'गंभीर डायबिटिक रेटिनोपैथी (स्तर 3)। 2 सँ 4 सप्ताहक भीतर रेटिना विशेषज्ञ सँ तुरंत जांच आवश्यक।',
    4: 'प्रोलिफेरेटिव डायबिटिक रेटिनोपैथी (स्तर 4)। आँखिक रौशनी बचेबाक लेल तुरंत लेजर उपचार आवश्यक।'
  },
  kok: {
    0: 'कसलीच डायबेटिक रेटिनोपॅथी मेळूंक ना (पातळी 0). वर्सुकी तपासणी करपाचो सल्लो दिला.',
    1: 'सौम्य डायबेटिक रेटिनोपॅथी (पातळी 1). रगत साखरेचेर नियंत्रण आनी वर्सुकी दोळ्यांची तपासणी गरजेची.',
    2: 'मध्यम डायबेटिक रेटिनोपॅथी (पातळी 2). 3 म्हयन्यां भितर दोळ्यांच्या दोतोरा कडेन वचात.',
    3: 'गंभीर डायबेटिक रेटिनोपॅथी (पातळी 3). 2 ते 4 सप्तकां भितर रेटिना तज्ञा कडेन रोखडीच तपासणी गरजेची.',
    4: 'प्रोलिफेरेटिव्ह डायबेटिक रेटिनोपॅथी (पातळी 4). नदर राखपाक रोखडोच लेझर उपचार करचो.'
  },
  ne: {
    0: 'कुनै डायबिटिक रेटिनोप्याथी भेटिएन (तह ०)। वार्षिक नियमित आँखा जाँचको सल्लाह दिइन्छ।',
    1: 'हल्का डायबिटिक रेटिनोप्याथी (तह १)। रगतमा चिनीको मात्रा नियन्त्रण र वार्षिक जाँच आवश्यक।',
    2: 'मध्यम डायबिटिक रेटिनोप्याथी (तह २)। ३ महिनाभित्र आँखा विशेषज्ञसँग जाँच गराउनुहोस्।',
    3: 'गम्भीर डायबिटिक रेटिनोप्याथी (तह ३)। २ देखि ४ हप्ताभित्र रेटिना विशेषज्ञबाट तत्काल जाँच आवश्यक।',
    4: 'प्रोलिफेरेटिव्ह डायबिटिक रेटिनोप्याथी (तह ४)। दृष्टि जोगाउन तुरुन्तै लेजर उपचार आवश्यक छ।'
  },
  doi: {
    0: 'कोई बी डायबिटिक रेटिनोपैथी नेईं लब्भी (लेवल 0)। सलाना जांच दी सलाह दित्ती जंदी ऐ।',
    1: 'हल्की डायबिटिक रेटिनोपैथी (लेवल 1)। खून च शूगर नियंत्रण ते सलाना अख्खीं दी जांच जरूरी ऐ।',
    2: 'दरम्यानी डायबिटिक रेटिनोपैथी (लेवल 2)। 3 महीने अंदर अख्खीं दे माहिर डाक्टर गी दस्सो।',
    3: 'बड्डी गंभीर डायबिटिक रेटिनोपैथी (लेवल 3)। 2 कन्ने 4 हफ़्ते अंदर रेटिना माहिर थमा फ़ौरी जांच कराओ।',
    4: 'प्रोलिफ़ेरेटिव डायबिटिक रेटिनोपैथी (लेवल 4)। नजर बचाने लेई फ़ौरन लेज़र इलाज दी लोड़ ऐ।'
  },
  ks: {
    0: 'کانٛہہ ڈایابیٹک ریٹینوپیتھی چھنہٕ (لیول 0)۔ پرٛتھ ؤریہِ اَچھ جانچ کرنہٕ چھےٚ صلاح۔',
    1: 'لوکٕٹ ڈایابیٹک ریٹینوپیتھی (لیول 1)۔ خوٗنس منٛز شوگر کَنٹرول تھئویو۔',
    2: 'درمیانہٕ ڈایابیٹک ریٹینوپیتھی (لیول 2)۔ 3 رؠتن منٛز اَچھ ڈاکٹرس ہاوِیو۔',
    3: 'شدید ڈایابیٹک ریٹینوپیتھی (لیول 3)۔ 2 پؠٹھ 4 ہفتن منٛز ریٹینا ماھرس ہاوِیو۔',
    4: 'پرولیفریٹو ڈایابیٹک ریٹینوپیتھی (لیول 4)۔ نظر بچاونہٕ خٲطرٕ فوراً لیزر علاج ضروٗری۔'
  },
  sd: {
    0: 'ڪابه ڊائيبيٽڪ ريٽينوپيٿي نه ملي (ليول 0). سالياني باقاعده چڪاس جي صلاح ڏجي ٿي.',
    1: 'هلڪي ڊائيبيٽڪ ريٽينوپيٿي (ليول 1). رت ۾ شگر تي ضابطو ۽ سالياني چڪاس ضروري.',
    2: 'درمياني ڊائيبيٽڪ ريٽينوپيٿي (ليول 2). 3 مهينن اندر اکين جي ماهر کي ڏيکاريو.',
    3: 'سخت ڊائيبيٽڪ ريٽينوپيٿي (ليول 3). 2 کان 4 هفتن اندر ريٽينا ماهر کان ترت چڪاس ڪرايو.',
    4: 'پروليفريٽو ڊائيبيٽڪ ريٽينوپيٿي (ليول 4). نظر بچائڻ لاءِ ترت ليزر علاج گهربل آهي.'
  },
  sa: {
    0: 'मधुमेह-दृष्टिपटलविकृतिः न प्राप्ता (स्तरः ०)। वार्षिकं नियमितं नेत्रपरीक्षणं अनुशंसितम्।',
    1: 'मन्द-मधुमेह-दृष्टिपटलविकृतिः (स्तरः १)। रक्तशर्करा-नियन्त्रणं वार्षिक-नेत्रपरीक्षणं च आवश्यकम्।',
    2: 'मध्यम-मधुमेह-दृष्टिपटलविकृतिः (स्तरः २)। मासत्रयाभ्यन्तरे नेत्रतज्ज्ञस्य परामर्शः स्वीकरणीयः।',
    3: 'गम्भीर-मधुमेह-दृष्टिपटलविकृतिः (स्तरः ३)। सप्ताह-द्वयं वा चतुरभ्यन्तरे शीघ्रं दृष्टिपटल-विशेषज्ञस्य परीक्षणम् आवश्यकम्।',
    4: 'प्रवर्धमान-मधुमेह-दृष्टिपटलविकृतिः (स्तरः ४)। दृष्टि-रक्षणार्थं सद्यः लेसर-चिकित्सा आवश्यकी।'
  },
  sat: {
    0: 'ᱡᱟᱦᱟᱱ ᱰᱟᱭᱵᱮᱴᱤᱠ ᱨᱮᱴᱤᱱᱳᱯᱟᱛᱷᱤ ᱵᱟᱝ ᱧᱟᱢ ᱞᱮᱱᱟ (ᱛᱷᱟᱨ 0)᱾ ᱥᱮᱨᱢᱟᱠᱤᱭᱟᱹ ᱢᱮᱫ ᱡᱟᱸᱪ ᱨᱮᱱᱟᱜ ᱥᱟᱞᱟᱦ ᱮᱢ ᱦᱩᱭᱩᱜ ᱠᱟᱱᱟ᱾',
    1: 'ᱦᱟᱞᱠᱟ ᱰᱟᱭᱵᱮᱴᱤᱠ ᱨᱮᱴᱤᱱᱳᱯᱟᱛᱷᱤ (ᱛᱷᱟᱨ 1)᱾ ᱢᱟᱭᱟᱢ ᱪᱤᱱᱤ ᱥᱟᱢᱵᱽᱲᱟᱣ ᱟᱨ ᱥᱮᱨᱢᱟᱠᱤᱭᱟᱹ ᱡᱟᱸᱪ ᱞᱟᱹᱠᱛᱤᱭᱟ᱾',
    2: 'ᱛᱟᱞᱟᱢᱟᱞᱟ ᱰᱟᱭᱵᱮᱴᱤᱠ ᱨᱮᱴᱤᱱᱳᱯᱟᱛᱷᱤ (ᱛᱷᱟᱨ 2)᱾ 3 ᱪᱟᱸᱫᱚ ᱵᱷᱤᱛᱨᱤ ᱨᱮ ᱢᱮᱫ ᱰᱟᱠᱛᱚᱨ ᱴᱷᱮᱱ ᱫᱮᱠᱷᱟᱣ ᱢᱮ᱾',
    3: 'ᱵᱟᱹᱲᱛᱤ ᱰᱟᱭᱵᱮᱴᱤᱠ ᱨᱮᱴᱤᱱᱳᱯᱟᱛᱷᱤ (ᱛᱷᱟᱨ 3)᱾ 2 ᱠᱷᱚᱱ 4 ᱦᱟᱯᱛᱟ ᱵᱷᱤᱛᱨᱤ ᱨᱮ ᱨᱮᱴᱤᱱᱟ ᱵᱤᱥᱮᱥᱚᱜᱽᱭᱚ ᱴᱷᱮᱱ ᱞᱚᱜᱚᱱ ᱡᱟᱸᱪ ᱞᱟᱹᱠᱛᱤᱭᱟ᱾',
    4: 'ᱯᱨᱳᱞᱤᱯᱷᱮᱨᱮᱴᱤᱵᱽ ᱰᱟᱭᱵᱮᱴᱤᱠ ᱨᱮᱴᱤᱱᱳᱯᱟᱛᱷᱤ (ᱛᱷᱟᱨ 4)᱾ ᱢᱮᱫ ᱨᱮᱱᱟᱜ ᱵᱮᱸᱜᱮᱫ ᱵᱟᱧᱪᱟᱣ ᱞᱟᱹᱜᱤᱫ ᱞᱚᱜᱚᱱ ᱞᱮᱡᱟᱨ ᱴᱤᱠᱪᱷᱟᱹ ᱞᱟᱹᱠᱛᱤᱭᱟ᱾'
  },
  mni: {
    0: 'ডায়াবেটিক রেটিনোপ্যাথি অমত্তা ফংদে (লেভেল ০)। চহীগী ওইনা মিত য়েংশিনবা ফোংদোকই।',
    1: 'অচম্বা ডায়াবেটিক রেটিনোপ্যাথি (লেভেল ১)। ঈগী সুগার য়েংশিনবগা লোয়ননা চহীগী মিত য়েংশিনবা তঙাইফদে।',
    2: 'ময়াই ওইবা ডায়াবেটিক রেটিনোপ্যাথি (লেভেল ২)। থা ৩ গী মনুংদা মিতকী দোক্তরদা য়েংহনগদবনি।',
    3: 'য়াম্না কনবা ডায়াবেটিক রেটিনোপ্যাথি (লেভেল ৩)। চয়োল ২ দগী ৪ গী মনুংদা রেটিনা বিশেষজ্ঞদা তনবা দরকার ওই।',
    4: 'প্রোলিফেরেটিভ ডায়াবেটিক রেটিনোপ্যাথি (লেভেল ৪)। মিতকী মঙাল কনবগীদমক অথুবদা লেজর লায়েংবা দরকার ওই।'
  },
  brx: {
    0: 'जेबो डायाबेटिक रेटिनोपैथि मोननाय जायाखै (थाखो 0)। बोसोरारि मेगन नायबिजिरनायनि गोनांथि दं।',
    1: 'फिसा डायाबेटिक रेटिनोपैथि (थाखो 1)। थैनि सुगार सामलायनाय आरो बोसोरारि मेगन नायबिजिरनाय गोनां।',
    2: 'गेजेर डायाबेटिक रेटिनोपैथि (थाखो 2)। 3 दाननि सिङाव मेगन डाक्टरनो दिन्थिफै।',
    3: 'गोख्रों डायाबेटिक रेटिनोपैथि (थाखो 3)। 2 निफ्राय 4 सप्तानि सिङाव रेटिना डाक्टरजों गोख्रै नायबिजिरहो।',
    4: 'प्रोलिफारेटिभ डायाबेटिक रेटिनोपैथि (थाखो 4)। मेगननि नुनायखौ रैखा खालामनो थाखाय गोख्रैनो लेजार फाहामथाय नांगौ।'
  },
  en: {
    0: 'No Apparent Diabetic Retinopathy (Level 0). Annual routine screening recommended.',
    1: 'Mild Non-Proliferative DR (Level 1). Glycemic control and annual dilated eye exam advised.',
    2: 'Moderate Non-Proliferative DR (Level 2). Referable — ophthalmologist review recommended within 3 months.',
    3: 'Severe Non-Proliferative DR (Level 3). Referable — urgent specialist consultation recommended within 2 to 4 weeks.',
    4: 'Proliferative Diabetic Retinopathy (Level 4 - High Risk). Sight-threatening disease requiring urgent vitreoretinal laser intervention.'
  }
};

// Speech-Synthesizer-Optimized Phonetic Texts (Ensures flawless TTS speech audio without garbling or spelling out letters)
export const SPEECH_PHONETIC_TRANSLATIONS = {
  ur: {
    0: 'कोई डायबिटिक रेटिनोपैथी नहीं पाई गई (लेवल 0)। सालाना मामूल के चेकअप की तजवीज़ दी जाती है।',
    1: 'मामूली डायबिटिक रेटिनोपैथी (लेवल 1)। ब्लड शुगर कंट्रोल और सालाना आँखों का मुआइना ज़रूरी है।',
    2: 'दरमियानी डायबिटिक रेटिनोपैथी (लेवल 2) पाई गई है। तीन माह के अंदर आँखों के माहिर डॉक्टर से चेकअप करवाएँ।',
    3: 'शदीद डायबिटिक रेटिनोपैथी (लेवल 3) पाई गई है। दो से चार हफ़्तों के अंदर रेटिना स्पेशलिस्ट से फ़ौरन मुआइना करवाना लाज़मी है।',
    4: 'प्रोलिफ़ेरेटिव डायबिटिक रेटिनोपैथी (लेवल 4 हाई रिस्क)। बिनाई बचाने के लिए फ़ौरन लेज़र इलाज की शदीद ज़रूरत है।'
  },
  ks: {
    0: 'कान्ह डायबिटिक रेटिनोपैथी छुना लेवल जीरो। प्रथ वरिय अच्छ चेकअप करनेची सलाह।',
    1: 'लोकुट डायबिटिक रेटिनोपैथी लेवल वन। खूनस मन्ज़ शुगर कंट्रोल थइविव।',
    2: 'दरम्याने डायबिटिक रेटिनोपैथी लेवल टू। त्रेह रेतन मन्ज़ अच्छ डॉक्टर्स हाविव।',
    3: 'शदीद डायबिटिक रेटिनोपैथी लेवल थ्री। ज़ह पेठ चौर हफ़्तन मन्ज़ रेटिना माहिरस हाविव।',
    4: 'प्रोलिफेरेटिव डायबिटिक रेटिनोपैथी लेवल फोर। नज़र बचाउने खातिर फोरन लेज़र इलाज जरूरी।'
  },
  sd: {
    0: 'काबा डायबिटिक रेटिनोपैथी न मिली लेवल जीरो। सालियानी चेकअप जी सलाह।',
    1: 'हल्की डायबिटिक रेटिनोपैथी लेवल वन। रत्त में शुगर कंट्रोल ऐं सालियानी चेकअप जरूरी।',
    2: 'दरम्यानी डायबिटिक रेटिनोपैथी लेवल टू। ट्रे महीने अंदर अखीन जे माहिर खे डेखारियो।',
    3: 'सख्त डायबिटिक रेटिनोपैथी लेवल थ्री। ब खां चार हफ़्ते अंदर रेटिना माहिर खां चेकअप कराओ।',
    4: 'प्रोलिफेरेटिव डायबिटिक रेटिनोपैथी लेवल फोर। नज़र बचाण लाए लेज़र इलाज जरूरी आहे।'
  },
  sat: {
    0: 'जाहान डायबेटिक रेटिनोपैथी बांग ञाम लेना लेभल 0। सेरमाकिया मेद जांच रेयाक सलाह एम हुयुग काना।',
    1: 'हालका डायबेटिक रेटिनोपैथी लेभल 1। मायाम चिनी साम्बड़ाव आर सेरमाकिया जांच लाकतीया।',
    2: 'तालामाळा डायबेटिक रेटिनोपैथी लेभल 2। 3 चांदो भितरी रे मेद डाक्टर ठेन देखाव मे।',
    3: 'बाड़ती डायबेटिक रेटिनोपैथी लेभल 3। 2 खोन 4 हापता भितरी रे रेटिना बिसेसोग्यो ठेन लोगोन जांच लाकतीया।',
    4: 'प्रोलिफेरेटिभ डायबेटिक रेटिनोपैथी लेभल 4। मेद रेनाक बेंकेद बांचाव लागिद लोगोन लेजार टिकछा लाकतीया।'
  },
  mni: {
    0: 'डायबिटिक रेटिनोपैथी अमत्ता फंगदे लेभल 0। चहीगी ओइना मित येन्गशिनबा फोन्गदोकइ।',
    1: 'अचम्बा डायबिटिक रेटिनोपैथी लेभल 1। ईगी सुगार येन्गशिनबगा लोयनना चहीगी मित येन्गशिनबा तंगाइफदे।',
    2: 'मयाइ ओइबा डायबिटिक रेटिनोपैथी लेभल 2। था 3 गी मनुंगदा मितकी दोक्तोरदा येन्गहनगदबनि।',
    3: 'याम्ना कन्बा डायबिटिक रेटिनोपैथी लेभल 3। चयोल 2 दगी 4 गी मनुंगदा रेटिना बिसेसज्ञदा तन्बा दरकार ओइ।',
    4: 'प्रोलिफेरेटिभ डायबिटिक रेटिनोपैथी लेभल 4। मितकी मंगाल कन्बगीदमक अथुबदा लेजर लायेन्गबा दरकार ओइ।'
  }
};

/**
 * Generates translated clinical summary in 22 Official Indian Languages + English
 */
export function getLocalizedSummary(caseData, langCode = 'hi') {
  const level = typeof caseData === 'number' 
    ? caseData 
    : (caseData?.grading?.icdr_level ?? caseData?.effective_icdr_level ?? caseData?.icdr_level ?? 0);
  const label = caseData?.grading?.icdr_label ?? caseData?.icdr_label ?? 'No DR';

  const langMap = CLINICAL_TRANSLATIONS[langCode] || CLINICAL_TRANSLATIONS.en;
  return langMap[level] || langMap[0] || caseData?.report?.summary_text || `${label} detected (Level ${level}).`;
}

/**
 * Generates phonetic speech-synthesizer text optimized for clear TTS pronunciation
 */
export function getSpeechSynthesisText(caseData, langCode = 'hi') {
  const level = typeof caseData === 'number' 
    ? caseData 
    : (caseData?.grading?.icdr_level ?? caseData?.effective_icdr_level ?? caseData?.icdr_level ?? 0);

  if (SPEECH_PHONETIC_TRANSLATIONS[langCode]?.[level]) {
    return SPEECH_PHONETIC_TRANSLATIONS[langCode][level];
  }
  return getLocalizedSummary(caseData, langCode);
}

let speechKeepAliveTimer = null;

/**
 * Resolves the best matching voice for a target Indian language from available browser voices
 */
export function findBestVoiceForLanguage(langCode = 'hi') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return { voice: null, matched: false };
  const voices = window.speechSynthesis.getVoices() || [];
  if (voices.length === 0) return { voice: null, matched: false };

  const langObj = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
  const targetLocale = (langObj?.locale || 'hi-IN').toLowerCase();
  const targetPrefix = langCode.toLowerCase();

  // 1. Exact locale match (e.g. 'mr-in', 'ta-in', 'te-in')
  const exactMatch = voices.find(v => {
    const vLang = (v.lang || '').toLowerCase().replace('_', '-');
    return vLang === targetLocale || vLang.startsWith(targetLocale);
  });
  if (exactMatch) return { voice: exactMatch, matched: true };

  // 2. Language prefix match (e.g. 'mr', 'ta', 'te', 'bn', 'gu', 'kn', 'ml', 'pa', 'ur')
  const prefixMatch = voices.find(v => {
    const vLang = (v.lang || '').toLowerCase().replace('_', '-');
    return vLang.startsWith(targetPrefix);
  });
  if (prefixMatch) return { voice: prefixMatch, matched: true };

  // 3. Indian regional voice match -- only counts as a real "match" for Hindi
  // specifically (a generic Indian-English voice is not actually Marathi/
  // Tamil/etc., so treating it as matched for every Indic language was
  // misleading -- it's really just a slightly-better English fallback).
  const indicVoice = voices.find(v => {
    const vLang = (v.lang || '').toLowerCase();
    const vName = (v.name || '').toLowerCase();
    return vLang.includes('-in') || vName.includes('india') || vName.includes('hindi') || vName.includes('heera') || vName.includes('ravi') || vName.includes('indic');
  });
  if (indicVoice) return { voice: indicVoice, matched: langCode === 'hi' };

  // 4. Default or English voice fallback -- this device genuinely has no
  // voice for the requested language installed.
  const defaultVoice = voices.find(v => v.default) || voices.find(v => (v.lang || '').toLowerCase().startsWith('en')) || voices[0];
  return { voice: defaultVoice, matched: false };
}

/**
 * Speech synthesis player with Web Speech API, intelligent voice resolution & resilient multi-language fallbacks
 */
export function playVoiceReadout(text, langCode = 'hi', onStart, onEnd, onError, onNoVoiceForLanguage) {
  if (typeof window === 'undefined') return;

  if (speechKeepAliveTimer) {
    clearInterval(speechKeepAliveTimer);
    speechKeepAliveTimer = null;
  }

  if (!('speechSynthesis' in window)) {
    if (onError) onError(new Error('Web Speech API not supported in browser'));
    alert(`[Voice Read-out in ${langCode.toUpperCase()}]: ${text}`);
    return;
  }

  try {
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();

    const voices = window.speechSynthesis.getVoices();
    const langObj = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
    const { voice: bestVoice, matched } = findBestVoiceForLanguage(langCode);

    // This is the actual reason multilingual read-out can sound like
    // English on some devices: the translated text is correct, but if the
    // OS/browser has no voice installed for the target language,
    // speechSynthesis has no choice but to use whatever default (usually
    // English) voice it has -- that voice can't really pronounce the
    // target script. This is a device limitation (missing OS language/
    // speech pack), not a text-selection bug, so surface it plainly
    // instead of silently playing something that sounds broken.
    if (!matched && langCode !== 'en' && onNoVoiceForLanguage) {
      onNoVoiceForLanguage(langObj?.name || langCode);
    }

    const utterance = new SpeechSynthesisUtterance(text);
    
    if (bestVoice) {
      utterance.voice = bestVoice;
      utterance.lang = matched ? (bestVoice.lang || langObj?.locale || 'hi-IN') : (langObj?.locale || 'hi-IN');
    } else {
      utterance.lang = langObj?.locale || 'hi-IN';
    }

    utterance.rate = 0.88; // Clear pacing for patient audio comprehension
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    let hasStarted = false;
    let fallbackAttempted = false;

    utterance.onstart = () => {
      hasStarted = true;
      // Chrome keep-alive timer to prevent 15s pause bug
      speechKeepAliveTimer = setInterval(() => {
        if (window.speechSynthesis && window.speechSynthesis.speaking) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } else {
          clearInterval(speechKeepAliveTimer);
          speechKeepAliveTimer = null;
        }
      }, 8000);

      if (onStart) onStart();
    };

    utterance.onend = () => {
      if (speechKeepAliveTimer) {
        clearInterval(speechKeepAliveTimer);
        speechKeepAliveTimer = null;
      }
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.warn(`Speech synthesis notice for language [${langCode}]:`, e.error || e);
      if (speechKeepAliveTimer) {
        clearInterval(speechKeepAliveTimer);
        speechKeepAliveTimer = null;
      }

      // If speech synthesis encountered language/voice unavailability, retry with generic Indic / default voice
      if (!fallbackAttempted && (e.error === 'language-unavailable' || e.error === 'voice-unavailable' || e.error === 'synthesis-failed' || e.error === 'synthesis-unavailable')) {
        fallbackAttempted = true;
        try {
          window.speechSynthesis.cancel();
          window.speechSynthesis.resume();
          const fallbackUtterance = new SpeechSynthesisUtterance(text);
          fallbackUtterance.rate = 0.88;
          fallbackUtterance.volume = 1.0;
          const fallbackVoice = voices.find(v => (v.lang || '').toLowerCase().includes('-in')) || voices.find(v => (v.lang || '').toLowerCase().startsWith('en')) || voices[0];
          if (fallbackVoice) {
            fallbackUtterance.voice = fallbackVoice;
            fallbackUtterance.lang = fallbackVoice.lang;
          }
          fallbackUtterance.onstart = onStart;
          fallbackUtterance.onend = onEnd;
          fallbackUtterance.onerror = (err) => {
            if (onError) onError(err);
          };
          window.speechSynthesis.speak(fallbackUtterance);
          return;
        } catch (retryErr) {
          console.warn('Fallback voice playback error:', retryErr);
        }
      }

      if (onError) onError(e);
    };

    window.speechSynthesis.speak(utterance);

    // Warm-up callback if voices were initially empty during page load
    if (voices.length === 0 && 'onvoiceschanged' in window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        if (!hasStarted && !window.speechSynthesis.speaking) {
          playVoiceReadout(text, langCode, onStart, onEnd, onError, onNoVoiceForLanguage);
        }
      };
    }
  } catch (err) {
    console.warn('Speech playback catch:', err);
    if (onError) onError(err);
  }
}

export function stopVoiceReadout() {
  if (speechKeepAliveTimer) {
    clearInterval(speechKeepAliveTimer);
    speechKeepAliveTimer = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch (e) {}
  }
}

// Universal Safe Data Extractors
export const getGradeLevel = (item) => item?.grading?.icdr_level ?? item?.effective_icdr_level ?? item?.icdr_level ?? 0;
export const getGradeLabel = (item) => item?.grading?.icdr_label ?? item?.icdr_label ?? 'No DR';
export const getConfidence = (item) => item?.grading?.confidence ?? item?.confidence ?? item?.calibrated_confidence ?? 0.85;
export const isReferable = (item) => item?.grading?.referable ?? item?.referable ?? (getGradeLevel(item) >= 2);
export const getPatientId = (item) => item?.patientId ?? item?.patient_id ?? item?.external_id ?? item?.id ?? 'P-UNKNOWN';
export const getPatientName = (item) => item?.patientName ?? item?.patient_name ?? getPatientId(item);
export const getPHC = (item) => item?.phc ?? item?.district ?? 'PHC Wardha Rural';

/**
 * Simulink discrete-event queueing model capacity computation (Section 4.4 & 8.3)
 */
export function calculateCapacityNeeds(annualScreeningTarget = 100000, avgReviewTimeMins = 4, calibratedReviewRatePct = 15.5, workingDaysPerYear = 250, workingHoursPerDay = 7) {
  const casesRequiringHumanReview = Math.round((annualScreeningTarget * calibratedReviewRatePct) / 100);
  const totalReviewHoursNeeded = (casesRequiringHumanReview * avgReviewTimeMins) / 60;
  const annualHoursPerOphthalmologist = workingDaysPerYear * workingHoursPerDay;
  const requiredOphthalmologists = Math.max(1, Math.ceil(totalReviewHoursNeeded / annualHoursPerOphthalmologist));
  
  const dailyCaptures = Math.round(annualScreeningTarget / workingDaysPerYear);
  const peakHourlyCaptures = Math.round((dailyCaptures / workingHoursPerDay) * 1.6);
  const requiredBandwidthMbps = Number(((peakHourlyCaptures * 11.7 * 8) / 3600).toFixed(1));

  return {
    casesRequiringHumanReview,
    totalReviewHoursNeeded: Math.round(totalReviewHoursNeeded),
    requiredOphthalmologists,
    dailyCaptures,
    peakHourlyCaptures,
    requiredBandwidthMbps
  };
}

// Longitudinal & Repeat Screening Helper
export const filterCasesByRole = (casesList = [], role = 'doctor', userId = null) => {
  if (role === 'asha') {
    return casesList.filter(c => c.registered_by === userId);
  }
  return casesList;
};

// Initial Mock Dataset matching SIH26038 & API Contract
export const INITIAL_CASES = [
  {
    id: '101',
    screening_id: 'scr_101',
    patient_id: '9f1c2a01',
    patientId: '9f1c2a01',
    patient_name: 'Ramesh Kumar',
    patientName: 'Ramesh Kumar',
    external_id: 'ASHA-REG-00231',
    age: 54,
    gender: 'Male',
    sex: 'M',
    phone: '9876543210',
    preferred_language: 'hi',
    facility_id: 'PHC-NAN-014',
    phc: 'PHC Nanded Rural',
    district: 'Nanded',
    registered_by: 'asha_worker_17',
    date: '2026-09-02',
    eye: 'OD',
    icdr_level: 3,
    effective_icdr_level: 3,
    icdr_label: 'Severe NPDR',
    confidence: 0.61, // Low confidence -> triggers human review
    raw_confidence: 0.93,
    calibrated_confidence: 0.61,
    requires_human_review: true,
    review_status: 'pending',
    status: 'pending',
    priority_score: 31.95,
    lesion_summary: '22 microaneurysms, 8 hemorrhages, 4 quadrants involved',
    trajectory: 'rapid_progression',
    history: [
      {
        visit_id: 'v-2024-01',
        date: '2024-03-10',
        eye: 'OD',
        icdr_level: 0,
        icdr_label: 'No DR',
        referable: false,
        hba1c: '6.5%',
        blood_pressure: '128/82 mmHg',
        microaneurysms: 0,
        hemorrhages: 0,
        phc: 'PHC Nanded Rural',
        clinician_notes: 'Baseline screening normal. Advised annual follow-up.',
        imageUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80&w=600'
      },
      {
        visit_id: 'v-2025-01',
        date: '2025-04-15',
        eye: 'OD',
        icdr_level: 1,
        icdr_label: 'Mild NPDR',
        referable: false,
        hba1c: '7.4%',
        blood_pressure: '134/86 mmHg',
        microaneurysms: 4,
        hemorrhages: 0,
        phc: 'PHC Nanded Rural',
        clinician_notes: 'Earliest microvascular changes detected. Advised strict glycemic control.',
        imageUrl: 'https://images.unsplash.com/photo-1578496479531-32e296d5c6e1?auto=format&fit=crop&q=80&w=600'
      },
      {
        visit_id: 'v-2026-01',
        date: '2026-09-02',
        eye: 'OD',
        icdr_level: 3,
        icdr_label: 'Severe NPDR',
        referable: true,
        hba1c: '8.8%',
        blood_pressure: '142/90 mmHg',
        microaneurysms: 22,
        hemorrhages: 8,
        phc: 'PHC Nanded Rural',
        clinician_notes: 'Significant disease progression (+2 stages). Urgent specialist referral within 2-4 weeks.',
        imageUrl: 'https://images.unsplash.com/photo-1578496479531-32e296d5c6e1?auto=format&fit=crop&q=80&w=800&h=500'
      }
    ],
    grading: {
      icdr_level: 3,
      icdr_label: 'Severe NPDR',
      confidence: 0.61,
      raw_confidence: 0.93,
      referable: true,
      requires_human_review: true
    },
    quality: {
      adequate: true,
      sharpness_score: 0.84,
      illumination_score: 0.92,
      field_of_view_score: 0.96,
      issues: []
    },
    lesions: {
      microaneurysm_count: 22,
      microaneurysms: 22,
      hemorrhage_count: 8,
      hemorrhages: 8,
      hard_exudate_area_pct: 2.1,
      hardExudates: '2.1%',
      soft_exudate_present: true,
      neovascularization_detected: false,
      neovascularization: 'None',
      quadrants_with_hemorrhages: 4
    },
    grading_paths: {
      rule_based_grade: 3,
      rule_based_label: 'Severe NPDR (4-2-1 Rule: >20 hemorrhages in 4 quadrants)',
      learned_grade: 3,
      learned_label: 'Severe NPDR (EfficientNet-B3 ONNX)',
      disagreement: false
    },
    clinical_data: {
      diabetes_duration: '12 years',
      diabetesDuration: '12 years',
      hba1c: '8.8%',
      blood_pressure: '142/90 mmHg',
      bloodPressure: '142/90 mmHg'
    },
    clinicalData: {
      diabetesDuration: '12 years',
      hba1c: '8.8%',
      bloodPressure: '142/90 mmHg'
    },
    imageUrl: 'https://images.unsplash.com/photo-1578496479531-32e296d5c6e1?auto=format&fit=crop&q=80&w=800&h=500',
    explainability: {
      gradcam_image_url: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=800&h=500',
      annotated_image_url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=800&h=500',
      original_image_url: 'https://images.unsplash.com/photo-1578496479531-32e296d5c6e1?auto=format&fit=crop&q=80&w=800&h=500'
    },
    report: {
      report_id: 'rpt_101',
      pdf_url: '/api/reports/rpt_101/report.pdf',
      audio_url: '/api/reports/rpt_101/audio?lang=hi',
      summary_text: 'Severe NPDR detected (ICDR level 3). Referable — urgent specialist consultation recommended within 2 to 4 weeks.',
      language: 'hi'
    }
  },
  {
    id: '102',
    screening_id: 'scr_102',
    patient_id: '9f1c2a02',
    patientId: '9f1c2a02',
    patient_name: 'Sunita Patil',
    patientName: 'Sunita Patil',
    external_id: 'ASHA-REG-00232',
    age: 49,
    gender: 'Female',
    sex: 'F',
    phone: '9876543211',
    preferred_language: 'mr',
    facility_id: 'PHC-WAR-002',
    phc: 'PHC Wardha Rural',
    district: 'Wardha',
    registered_by: 'asha_worker_04',
    date: '2026-09-02',
    eye: 'OS',
    icdr_level: 2,
    effective_icdr_level: 2,
    icdr_label: 'Moderate NPDR',
    confidence: 0.65, // Borderline confidence
    raw_confidence: 0.88,
    calibrated_confidence: 0.65,
    requires_human_review: true,
    review_status: 'pending',
    status: 'pending',
    priority_score: 24.80,
    lesion_summary: '14 microaneurysms, 3 hemorrhages, hard exudates 1.2%',
    trajectory: 'moderate_progression',
    history: [
      {
        visit_id: 'v-2025-02',
        date: '2025-02-14',
        eye: 'OS',
        icdr_level: 1,
        icdr_label: 'Mild NPDR',
        referable: false,
        hba1c: '7.1%',
        blood_pressure: '124/80 mmHg',
        microaneurysms: 3,
        hemorrhages: 0,
        phc: 'PHC Wardha Rural',
        clinician_notes: 'Mild background microaneurysms. Annual dilated eye screening advised.',
        imageUrl: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=600'
      },
      {
        visit_id: 'v-2026-02',
        date: '2026-09-02',
        eye: 'OS',
        icdr_level: 2,
        icdr_label: 'Moderate NPDR',
        referable: true,
        hba1c: '7.6%',
        blood_pressure: '128/82 mmHg',
        microaneurysms: 14,
        hemorrhages: 3,
        phc: 'PHC Wardha Rural',
        clinician_notes: 'Progression to Moderate NPDR (+1 stage). Specialist appointment within 3 months.',
        imageUrl: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=800&h=500'
      }
    ],
    grading: {
      icdr_level: 2,
      icdr_label: 'Moderate NPDR',
      confidence: 0.65,
      raw_confidence: 0.88,
      referable: true,
      requires_human_review: true
    },
    quality: {
      adequate: true,
      sharpness_score: 0.81,
      illumination_score: 0.89,
      field_of_view_score: 0.94,
      issues: []
    },
    lesions: {
      microaneurysm_count: 14,
      microaneurysms: 14,
      hemorrhage_count: 3,
      hemorrhages: 3,
      hard_exudate_area_pct: 1.2,
      hardExudates: '1.2%',
      soft_exudate_present: false,
      neovascularization_detected: false,
      neovascularization: 'None',
      quadrants_with_hemorrhages: 2
    },
    grading_paths: {
      rule_based_grade: 2,
      rule_based_label: 'Moderate NPDR',
      learned_grade: 1,
      learned_label: 'Mild NPDR',
      disagreement: true // Disagreement flag!
    },
    clinical_data: {
      diabetes_duration: '7 years',
      diabetesDuration: '7 years',
      hba1c: '7.6%',
      blood_pressure: '128/82 mmHg',
      bloodPressure: '128/82 mmHg'
    },
    clinicalData: {
      diabetesDuration: '7 years',
      hba1c: '7.6%',
      bloodPressure: '128/82 mmHg'
    },
    imageUrl: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=800&h=500',
    explainability: {
      gradcam_image_url: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=800&h=500',
      annotated_image_url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=800&h=500',
      original_image_url: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=800&h=500'
    },
    report: {
      report_id: 'rpt_102',
      pdf_url: '/api/reports/rpt_102/report.pdf',
      audio_url: '/api/reports/rpt_102/audio?lang=mr',
      summary_text: 'Moderate NPDR detected (ICDR level 2). Dual-path review flagged for clinician verification.',
      language: 'mr'
    }
  },
  {
    id: '103',
    screening_id: 'scr_103',
    patient_id: '9f1c2a03',
    patientId: '9f1c2a03',
    patient_name: 'Anand Deshmukh',
    patientName: 'Anand Deshmukh',
    external_id: 'ASHA-REG-00233',
    age: 62,
    gender: 'Male',
    sex: 'M',
    phone: '9876543212',
    preferred_language: 'mr',
    facility_id: 'PHC-YAV-008',
    phc: 'PHC Yavatmal Center',
    district: 'Yavatmal',
    registered_by: 'asha_worker_12',
    date: '2026-09-01',
    eye: 'OD',
    icdr_level: 4,
    effective_icdr_level: 4,
    icdr_label: 'Proliferative DR (PDR)',
    confidence: 0.94,
    raw_confidence: 0.98,
    calibrated_confidence: 0.94,
    requires_human_review: true,
    review_status: 'pending',
    status: 'pending',
    priority_score: 48.50,
    lesion_summary: 'Neovascularization at Optic Disc (NVD), extensive hemorrhages',
    trajectory: 'sight_threatening',
    history: [
      {
        visit_id: 'v-2024-03',
        date: '2024-01-20',
        eye: 'OD',
        icdr_level: 2,
        icdr_label: 'Moderate NPDR',
        referable: true,
        hba1c: '8.2%',
        blood_pressure: '140/88 mmHg',
        microaneurysms: 12,
        hemorrhages: 4,
        phc: 'PHC Yavatmal Center',
        clinician_notes: 'Moderate NPDR baseline. Patient missed 6-month ophthalmology follow-up.',
        imageUrl: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=600'
      },
      {
        visit_id: 'v-2025-03',
        date: '2025-03-12',
        eye: 'OD',
        icdr_level: 3,
        icdr_label: 'Severe NPDR',
        referable: true,
        hba1c: '9.1%',
        blood_pressure: '146/92 mmHg',
        microaneurysms: 26,
        hemorrhages: 11,
        phc: 'PHC Yavatmal Center',
        clinician_notes: 'Progression to Severe NPDR. Recommended urgent pan-retinal photocoagulation evaluation.',
        imageUrl: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=600'
      },
      {
        visit_id: 'v-2026-03',
        date: '2026-09-01',
        eye: 'OD',
        icdr_level: 4,
        icdr_label: 'Proliferative DR (PDR)',
        referable: true,
        hba1c: '10.2%',
        blood_pressure: '150/95 mmHg',
        microaneurysms: 38,
        hemorrhages: 19,
        phc: 'PHC Yavatmal Center',
        clinician_notes: 'Active NVD with high risk PDR. Immediate vitreoretinal surgery/laser required.',
        imageUrl: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=800&h=500'
      }
    ],
    grading: {
      icdr_level: 4,
      icdr_label: 'Proliferative DR (PDR)',
      confidence: 0.94,
      raw_confidence: 0.98,
      referable: true,
      requires_human_review: true
    },
    quality: {
      adequate: true,
      sharpness_score: 0.88,
      illumination_score: 0.94,
      field_of_view_score: 0.98,
      issues: []
    },
    lesions: {
      microaneurysm_count: 38,
      microaneurysms: 38,
      hemorrhage_count: 19,
      hemorrhages: 19,
      hard_exudate_area_pct: 3.4,
      hardExudates: '3.4%',
      soft_exudate_present: true,
      neovascularization_detected: true,
      neovascularization: 'NVD Detected',
      quadrants_with_hemorrhages: 4
    },
    grading_paths: {
      rule_based_grade: 4,
      rule_based_label: 'Proliferative DR (NVD present)',
      learned_grade: 4,
      learned_label: 'Proliferative DR',
      disagreement: false
    },
    clinical_data: {
      diabetes_duration: '16 years',
      diabetesDuration: '16 years',
      hba1c: '10.2%',
      blood_pressure: '150/95 mmHg',
      bloodPressure: '150/95 mmHg'
    },
    clinicalData: {
      diabetesDuration: '16 years',
      hba1c: '10.2%',
      bloodPressure: '150/95 mmHg'
    },
    imageUrl: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=800&h=500',
    explainability: {
      gradcam_image_url: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=800&h=500',
      annotated_image_url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=800&h=500',
      original_image_url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=800&h=500'
    },
    report: {
      report_id: 'rpt_103',
      pdf_url: '/api/reports/rpt_103/report.pdf',
      audio_url: '/api/reports/rpt_103/audio?lang=mr',
      summary_text: 'Proliferative Diabetic Retinopathy detected (ICDR level 4). High-risk sight threatening disease requiring immediate laser photocoagulation.',
      language: 'mr'
    }
  },
  {
    id: '104',
    screening_id: 'scr_104',
    patient_id: '9f1c2a04',
    patientId: '9f1c2a04',
    patient_name: 'Meena Sharma',
    patientName: 'Meena Sharma',
    external_id: 'ASHA-REG-00234',
    age: 45,
    gender: 'Female',
    sex: 'F',
    phone: '9876543213',
    preferred_language: 'hi',
    facility_id: 'PHC-AMR-003',
    phc: 'PHC Amravati Tele-Clinic',
    district: 'Amravati',
    registered_by: 'asha_worker_17',
    date: '2026-09-01',
    eye: 'OD',
    icdr_level: 1,
    effective_icdr_level: 1,
    icdr_label: 'Mild NPDR',
    confidence: 0.91,
    raw_confidence: 0.96,
    calibrated_confidence: 0.91,
    requires_human_review: false,
    review_status: 'confirmed',
    status: 'reviewed',
    priority_score: 9.10,
    lesion_summary: '3 microaneurysms only, no exudates',
    trajectory: 'stable',
    history: [
      {
        visit_id: 'v-2024-04',
        date: '2024-08-05',
        eye: 'OD',
        icdr_level: 0,
        icdr_label: 'No DR',
        referable: false,
        hba1c: '6.3%',
        blood_pressure: '118/76 mmHg',
        microaneurysms: 0,
        hemorrhages: 0,
        phc: 'PHC Amravati Tele-Clinic',
        clinician_notes: 'Initial check clear. Routine annual follow-up recommended.',
        imageUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&q=80&w=600'
      },
      {
        visit_id: 'v-2025-04',
        date: '2025-08-18',
        eye: 'OD',
        icdr_level: 1,
        icdr_label: 'Mild NPDR',
        referable: false,
        hba1c: '6.7%',
        blood_pressure: '120/78 mmHg',
        microaneurysms: 2,
        hemorrhages: 0,
        phc: 'PHC Amravati Tele-Clinic',
        clinician_notes: 'Mild isolated microaneurysms. Good glycemic control.',
        imageUrl: 'https://images.unsplash.com/photo-1578496479531-32e296d5c6e1?auto=format&fit=crop&q=80&w=600'
      },
      {
        visit_id: 'v-2026-04',
        date: '2026-09-01',
        eye: 'OD',
        icdr_level: 1,
        icdr_label: 'Mild NPDR',
        referable: false,
        hba1c: '6.9%',
        blood_pressure: '122/78 mmHg',
        microaneurysms: 3,
        hemorrhages: 0,
        phc: 'PHC Amravati Tele-Clinic',
        clinician_notes: 'Stable condition (non-progressive). Annual repeat screening.',
        imageUrl: 'https://images.unsplash.com/photo-1578496479531-32e296d5c6e1?auto=format&fit=crop&q=80&w=800&h=500'
      }
    ],
    grading: {
      icdr_level: 1,
      icdr_label: 'Mild NPDR',
      confidence: 0.91,
      raw_confidence: 0.96,
      referable: false,
      requires_human_review: false
    },
    quality: {
      adequate: true,
      sharpness_score: 0.86,
      illumination_score: 0.91,
      field_of_view_score: 0.95,
      issues: []
    },
    lesions: {
      microaneurysm_count: 3,
      microaneurysms: 3,
      hemorrhage_count: 0,
      hemorrhages: 0,
      hard_exudate_area_pct: 0,
      hardExudates: '0%',
      soft_exudate_present: false,
      neovascularization_detected: false,
      neovascularization: 'None',
      quadrants_with_hemorrhages: 1
    },
    grading_paths: {
      rule_based_grade: 1,
      rule_based_label: 'Mild NPDR (Microaneurysms only)',
      learned_grade: 1,
      learned_label: 'Mild NPDR',
      disagreement: false
    },
    clinical_data: {
      diabetes_duration: '4 years',
      diabetesDuration: '4 years',
      hba1c: '6.9%',
      blood_pressure: '122/78 mmHg',
      bloodPressure: '122/78 mmHg'
    },
    clinicalData: {
      diabetesDuration: '4 years',
      hba1c: '6.9%',
      bloodPressure: '122/78 mmHg'
    },
    imageUrl: 'https://images.unsplash.com/photo-1578496479531-32e296d5c6e1?auto=format&fit=crop&q=80&w=800&h=500',
    explainability: {
      gradcam_image_url: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&q=80&w=800&h=500',
      annotated_image_url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&q=80&w=800&h=500',
      original_image_url: 'https://images.unsplash.com/photo-1578496479531-32e296d5c6e1?auto=format&fit=crop&q=80&w=800&h=500'
    },
    report: {
      report_id: 'rpt_104',
      pdf_url: '/api/reports/rpt_104/report.pdf',
      audio_url: '/api/reports/rpt_104/audio?lang=hi',
      summary_text: 'Mild NPDR detected (ICDR level 1). Non-referable. Annual follow-up and glycemic management.',
      language: 'hi'
    }
  }
];

export const INITIAL_DISTRICT_ANALYTICS = [
  {
    district: 'Nanded',
    total_screenings: 1420,
    referral_rate: 0.194,
    pending_review_count: 4,
    recommended_ophthalmologists: 2,
    simulink_capacity_status: 'Optimal',
    recommended_bandwidth_mbps: 15,
    phc_nodes_count: 6
  },
  {
    district: 'Wardha',
    total_screenings: 980,
    referral_rate: 0.182,
    pending_review_count: 3,
    recommended_ophthalmologists: 1,
    simulink_capacity_status: 'Optimal',
    recommended_bandwidth_mbps: 10,
    phc_nodes_count: 4
  },
  {
    district: 'Yavatmal',
    total_screenings: 1640,
    referral_rate: 0.228,
    pending_review_count: 8,
    recommended_ophthalmologists: 3,
    simulink_capacity_status: 'Overloaded',
    recommended_bandwidth_mbps: 25,
    phc_nodes_count: 7
  },
  {
    district: 'Amravati',
    total_screenings: 810,
    referral_rate: 0.165,
    pending_review_count: 2,
    recommended_ophthalmologists: 1,
    simulink_capacity_status: 'Optimal',
    recommended_bandwidth_mbps: 10,
    phc_nodes_count: 4
  }
];

export const INITIAL_ANALYTICS_SUMMARY = {
  total_patients: 4120,
  total_screenings: 4850,
  total_graded: 4690,
  total_rejected: 160,
  total_referable: 924,
  referral_rate: 0.197,
  review_rate: 0.148,
  pending_review_count: 17,
  avg_confidence: 0.884,
  avg_review_turnaround_hours: 6.4,
  grade_distribution: {
    no_dr: 3240,
    mild_npdr: 526,
    moderate_npdr: 610,
    severe_npdr: 242,
    proliferative_dr: 72
  }
};

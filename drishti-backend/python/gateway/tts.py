"""Native-language translation + voice read-out of screening results.

This is the real implementation of the feature that was, until now, only a
`language` field sitting unused in the report schema. ASHA workers (primary
use case) and web reviewers (secondary use case) both hit the same endpoint
(GET /api/reports/{report_id}/audio?lang=hi) and get back an MP3 in the
requested language -- built on the pipeline's existing English summary_text,
which is generated once by MATLAB and never needs to change.

Honest limitations, stated plainly rather than glossed over:
- Both gTTS and deep-translator call free Google web endpoints. They need
  internet access, are not officially supported APIs, and are not
  appropriate as-is for a production deployment with real uptime/privacy/
  compliance requirements -- treat this as a working hackathon-grade
  implementation, and swap in a paid/self-hosted translation + TTS service
  (e.g. Bhashini, India's own government-backed language AI platform, is a
  natural fit here) before any real-world rollout.
- Medical terminology can translate awkwardly with a generic translator.
  The summary_text template (see generateReport.m) is deliberately written
  in short, plain sentences for exactly this reason -- simpler source text
  survives machine translation much better than clinical jargon.
"""
from __future__ import annotations

import hashlib
import logging
from pathlib import Path

from config import settings

logger = logging.getLogger("tts")

try:
    from gtts import gTTS
    from deep_translator import GoogleTranslator
    _TTS_AVAILABLE = True
except ImportError:
    _TTS_AVAILABLE = False
    logger.warning(
        "gTTS/deep-translator not installed -- native-language audio endpoint will return a "
        "clear error instead of audio. Install with: pip install -r requirements-gateway.txt"
    )

# gTTS language codes for the languages most relevant to the district-level
# rollout this problem statement targets. Extend as needed -- gTTS supports
# a much longer list; this is the curated, tested subset.
SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "bn": "Bengali",
    "ta": "Tamil",
    "te": "Telugu",
    "mr": "Marathi",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
    "pa": "Punjabi",
    "ur": "Urdu",
}


def translate_text(text: str, target_lang: str) -> str:
    """Translate English summary_text into target_lang. Returns the original
    text unchanged for English or if translation fails, so a translation
    hiccup degrades to "audio in English" rather than a hard failure."""
    if target_lang == "en" or not _TTS_AVAILABLE:
        return text
    try:
        return GoogleTranslator(source="en", target=target_lang).translate(text)
    except Exception:  # noqa: BLE001 -- network/service hiccups shouldn't break the whole request
        logger.exception("Translation to %s failed; falling back to English text", target_lang)
        return text


def get_or_create_audio(report_id: str, text: str, lang: str) -> Path:
    """Returns the path to an MP3 of `text` read aloud in `lang`, generating
    and caching it on first request. Cache key includes a hash of the text
    so a corrected/regenerated report doesn't serve stale audio."""
    if not _TTS_AVAILABLE:
        raise RuntimeError(
            "Text-to-speech is not available: install gTTS and deep-translator "
            "(pip install -r requirements-gateway.txt) and ensure the server has internet access."
        )
    if lang not in SUPPORTED_LANGUAGES:
        raise ValueError(f"Unsupported language '{lang}'. Supported: {sorted(SUPPORTED_LANGUAGES)}")

    report_dir = settings.reports_dir / report_id
    report_dir.mkdir(parents=True, exist_ok=True)
    text_hash = hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]
    audio_path = report_dir / f"audio_{lang}_{text_hash}.mp3"

    if audio_path.exists():
        return audio_path

    translated = translate_text(text, lang)
    tts = gTTS(text=translated, lang=lang)
    tts.save(str(audio_path))
    logger.info("Generated %s audio for report %s -> %s", lang, report_id, audio_path.name)
    return audio_path

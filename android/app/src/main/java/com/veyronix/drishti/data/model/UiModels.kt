package com.veyronix.drishti.data.model

/**
 * Lightweight UI-layer models used ONLY to drive the mock/preview data in this UI pass.
 * TODO: replace with your real Retrofit DTOs / Room entities and delete this file
 * once the repository layer is wired in — these intentionally mirror the shapes in
 * docs/api_contract.md so the swap is mostly a rename.
 */

data class PatientListItem(
    val patientId: String,
    val name: String,
    val ageSex: String,
    val timeLabel: String,
    val status: ScreeningStatus
)

enum class ScreeningStatus { PENDING, GRADED, REFERRED }

data class ScreeningHistoryItem(
    val screeningId: String,
    val dateEyeLabel: String,
    val lesionSummary: String,
    val icdrLabel: String,
    val severity: Severity
)

enum class Severity { NO_DR, MILD, MODERATE, SEVERE, PROLIFERATIVE }

data class SyncQueueItem(
    val localId: String,
    val label: String,
    val capturedAtLabel: String,
    val state: SyncState
)

enum class SyncState { QUEUED, UPLOADING, UPLOADED, FAILED }

data class LanguageOption(val code: String, val displayName: String)

val SUPPORTED_LANGUAGES = listOf(
    LanguageOption("en", "English"),
    LanguageOption("hi", "Hindi (हिन्दी)"),
    LanguageOption("bn", "Bengali (বাংলা)"),
    LanguageOption("ta", "Tamil (தமிழ்)"),
    LanguageOption("te", "Telugu (తెలుగు)"),
    LanguageOption("mr", "Marathi (मराठी)"),
    LanguageOption("gu", "Gujarati (ગુજરાતી)"),
    LanguageOption("kn", "Kannada (ಕನ್ನಡ)"),
    LanguageOption("ml", "Malayalam (മലയാളം)"),
    LanguageOption("pa", "Punjabi (ਪੰਜਾਬੀ)"),
    LanguageOption("ur", "Urdu (اردو)")
)

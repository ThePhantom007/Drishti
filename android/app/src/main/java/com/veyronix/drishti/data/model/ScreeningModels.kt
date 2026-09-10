package com.veyronix.drishti.data.network.model

import com.google.gson.annotations.SerializedName
import java.io.File

/**
 * POST /api/screen is `multipart/form-data`, not JSON — so this is a plain parameter
 * holder for your repository method, not something Gson serializes directly. Map it to
 * multipart parts yourself, e.g.:
 *   MultipartBody.Part.createFormData("image", file.name, file.asRequestBody("image/jpeg".toMediaType()))
 *   patientId?.let { @Part("patient_id") it.toRequestBody() }
 */
data class ScreeningUploadParams(
    val image: File,
    val patientId: String? = null,
    val eye: Eye? = null,
    val language: String? = null // ISO code, see SupportedLanguage
)

/** `eye` field on /api/screen and nav args — right (OD) / left (OS). */
enum class Eye {
    @SerializedName("OD") OD,
    @SerializedName("OS") OS
}

/** Discriminates the two possible /api/screen response shapes via [status]. */
enum class ScreeningStatus {
    @SerializedName("graded") GRADED,
    @SerializedName("rejected") REJECTED
}

/**
 * POST /api/screen — response body.
 *
 * Shape varies by [status]:
 *  - "graded": [quality] + [grading] + [lesions] + [explainability] + [report] +
 *    [processingTimeMs] are populated, [recaptureMessage] is null.
 *  - "rejected": only [quality] is populated (with `adequate=false`); [recaptureMessage]
 *    is populated; [grading]/[lesions]/[explainability]/[report]/[processingTimeMs] are
 *    null (the pipeline never ran past the quality gate).
 *
 * Convenience accessors [isGraded]/[isRejected] are provided instead of comparing the
 * raw enum everywhere.
 */
data class ScreeningResponse(
    val status: ScreeningStatus,
    @SerializedName("screening_id") val screeningId: String,
    @SerializedName("patient_id") val patientId: String? = null,
    val quality: QualityInfo,
    val grading: GradingInfo? = null,
    val lesions: LesionsInfo? = null,
    val explainability: ExplainabilityInfo? = null,
    val report: ReportInfo? = null,
    @SerializedName("processing_time_ms") val processingTimeMs: Long? = null,
    @SerializedName("recapture_message") val recaptureMessage: String? = null
) {
    val isGraded: Boolean get() = status == ScreeningStatus.GRADED
    val isRejected: Boolean get() = status == ScreeningStatus.REJECTED
}

data class QualityInfo(
    val adequate: Boolean,
    @SerializedName("sharpness_score") val sharpnessScore: Double,
    @SerializedName("illumination_score") val illuminationScore: Double,
    @SerializedName("field_of_view_score") val fieldOfViewScore: Double,
    val issues: List<String> = emptyList()
)

data class GradingInfo(
    @SerializedName("icdr_level") val icdrLevel: Int, // 0-4
    @SerializedName("icdr_label") val icdrLabel: String,
    val referable: Boolean,
    val confidence: Double,
    @SerializedName("requires_human_review") val requiresHumanReview: Boolean
)

data class LesionsInfo(
    @SerializedName("microaneurysm_count") val microaneurysmCount: Int,
    @SerializedName("hemorrhage_count") val hemorrhageCount: Int,
    @SerializedName("hard_exudate_area_pct") val hardExudateAreaPct: Double,
    @SerializedName("soft_exudate_present") val softExudatePresent: Boolean,
    @SerializedName("neovascularization_detected") val neovascularizationDetected: Boolean
)

data class ExplainabilityInfo(
    @SerializedName("gradcam_image_url") val gradcamImageUrl: String,
    @SerializedName("annotated_image_url") val annotatedImageUrl: String
)

data class ReportInfo(
    @SerializedName("report_id") val reportId: String,
    @SerializedName("pdf_url") val pdfUrl: String,
    @SerializedName("audio_url") val audioUrl: String?,
    @SerializedName("summary_text") val summaryText: String,
    val language: String
)

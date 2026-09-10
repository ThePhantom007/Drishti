package com.veyronix.drishti.data.network.model

import com.google.gson.annotations.SerializedName

/**
 * Ophthalmologist web dashboard endpoints. Included for completeness / a shared network
 * module even though the Android (ASHA) app doesn't consume these directly per the
 * contract's platform breakdown.
 */

/** `review_status` values seen across the queue + review endpoints. */
enum class ReviewStatus {
    @SerializedName("pending") PENDING,
    @SerializedName("confirmed") CONFIRMED, // inferred: contract only shows "overridden" explicitly
    @SerializedName("overridden") OVERRIDDEN
}

/** GET /api/queue?limit=100 — one item of the returned array. */
data class QueueItem(
    @SerializedName("screening_id") val screeningId: String,
    @SerializedName("patient_id") val patientId: String,
    @SerializedName("patient_name") val patientName: String,
    @SerializedName("icdr_level") val icdrLevel: Int,
    @SerializedName("icdr_label") val icdrLabel: String,
    val confidence: Double,
    @SerializedName("requires_human_review") val requiresHumanReview: Boolean,
    @SerializedName("review_status") val reviewStatus: ReviewStatus,
    @SerializedName("priority_score") val priorityScore: Double,
    @SerializedName("lesion_summary") val lesionSummary: String,
    @SerializedName("pdf_url") val pdfUrl: String,
    @SerializedName("annotated_image_url") val annotatedImageUrl: String,
    @SerializedName("gradcam_image_url") val gradcamImageUrl: String
)

enum class ReviewDecision {
    @SerializedName("confirm") CONFIRM,
    @SerializedName("override") OVERRIDE
}

/**
 * POST /api/review/{screening_id} — request body.
 * [overriddenIcdrLevel] (0-4) is required only when [decision] is OVERRIDE.
 */
data class ReviewDecisionRequest(
    @SerializedName("reviewer_id") val reviewerId: String,
    val decision: ReviewDecision,
    @SerializedName("overridden_icdr_level") val overriddenIcdrLevel: Int? = null,
    val notes: String? = null
)

/**
 * POST /api/review/{screening_id} — response body.
 * Always read [effectiveIcdrLevel] (not the original `icdr_level`) when displaying a
 * reviewed case's grade — it reflects an override, the original grading field does not.
 */
data class ReviewDecisionResponse(
    @SerializedName("screening_id") val screeningId: String,
    @SerializedName("review_status") val reviewStatus: ReviewStatus,
    @SerializedName("effective_icdr_level") val effectiveIcdrLevel: Int,
    @SerializedName("reviewer_id") val reviewerId: String,
    @SerializedName("reviewed_at") val reviewedAt: String
)

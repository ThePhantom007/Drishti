package com.veyronix.drishti.data.network.model

import com.google.gson.annotations.SerializedName

/**
 * POST /api/patients — request body.
 * "All fields optional except nothing is strictly required" per the contract, so every
 * field is nullable. `sex` is passed through as the raw contract example ("M") rather
 * than a closed enum, since the contract doesn't enumerate the full value set.
 */
data class PatientRegistrationRequest(
    val name: String? = null,
    @SerializedName("external_id") val externalId: String? = null,
    val age: Int? = null,
    val sex: String? = null,
    val phone: String? = null,
    @SerializedName("preferred_language") val preferredLanguage: String? = null,
    @SerializedName("facility_id") val facilityId: String? = null,
    val district: String? = null,
    @SerializedName("registered_by") val registeredBy: String? = null
)

/** POST /api/patients — response body (also the flat patient fields reused below). */
data class PatientResponse(
    val id: String,
    val name: String?,
    @SerializedName("external_id") val externalId: String?,
    val age: Int?,
    val sex: String?,
    val phone: String?,
    @SerializedName("preferred_language") val preferredLanguage: String?,
    @SerializedName("facility_id") val facilityId: String?,
    val district: String?,
    @SerializedName("registered_by") val registeredBy: String?,
    @SerializedName("created_at") val createdAt: String,
    @SerializedName("screening_count") val screeningCount: Int
)

/**
 * GET /api/patients/{patient_id} — "full patient record plus their complete screening
 * history". The contract doesn't give a literal JSON sample for this one, so the shape
 * below (flat patient fields + a `screenings` array) is the most natural reading of the
 * spec text — confirm field names against the live /docs page before wiring this up.
 * `screenings` is ordered most-recent-first per the contract.
 */
data class PatientDetailResponse(
    val id: String,
    val name: String?,
    @SerializedName("external_id") val externalId: String?,
    val age: Int?,
    val sex: String?,
    val phone: String?,
    @SerializedName("preferred_language") val preferredLanguage: String?,
    @SerializedName("facility_id") val facilityId: String?,
    val district: String?,
    @SerializedName("registered_by") val registeredBy: String?,
    @SerializedName("created_at") val createdAt: String,
    @SerializedName("screening_count") val screeningCount: Int,
    val screenings: List<ScreeningHistoryEntry> = emptyList()
)

/**
 * GET /api/patients/{patient_id}/screenings — "just the screening history list (lighter
 * payload)". The Retrofit method's return type is simply `List<ScreeningHistoryEntry>`;
 * no wrapper object is implied by the contract text.
 *
 * INFERRED SHAPE: like [PatientDetailResponse], the contract names this endpoint but
 * doesn't show its JSON. Fields below are the ones a "screening history" list needs to
 * drive the Patient History screen (date/eye, grade, referable, review state) and mirror
 * naming used elsewhere in the contract (e.g. `lesion_summary` from the review queue).
 * Verify against /docs before wiring.
 */
data class ScreeningHistoryEntry(
    @SerializedName("screening_id") val screeningId: String,
    val eye: String?,
    @SerializedName("created_at") val createdAt: String?,
    @SerializedName("icdr_level") val icdrLevel: Int?,
    @SerializedName("icdr_label") val icdrLabel: String?,
    val referable: Boolean?,
    @SerializedName("requires_human_review") val requiresHumanReview: Boolean?,
    val confidence: Double?,
    @SerializedName("lesion_summary") val lesionSummary: String?,
    @SerializedName("pdf_url") val pdfUrl: String?
)

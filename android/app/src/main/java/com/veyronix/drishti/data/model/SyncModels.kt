package com.veyronix.drishti.data.network.model

import com.google.gson.annotations.SerializedName
import java.io.File

/**
 * POST /api/sync is `multipart/form-data` with four parallel, same-length,
 * matching-order lists — not a JSON body. [SyncUploadItem] bundles one queued capture's
 * fields together so your repository can zip them into the four parallel form-data
 * lists (`images[]`, `local_ids[]`, `patient_ids[]`, `captured_ats[]`) the endpoint
 * expects; it isn't Gson-serialized directly.
 */
data class SyncUploadItem(
    val image: File,
    val localId: String,
    val patientId: String, // must already exist server-side
    val capturedAt: String // ISO 8601 timestamp of actual capture time
)

/** Per-item status in a /api/sync response. */
enum class SyncItemStatus {
    @SerializedName("graded") GRADED,
    @SerializedName("rejected") REJECTED, // inferred: same pipeline as /api/screen, not shown in the sync example
    @SerializedName("error") ERROR
}

/** POST /api/sync — response body. */
data class SyncResponse(
    val results: List<SyncResultItem>
)

/**
 * One entry in a sync response. Match [clientLocalId] back to your local offline queue
 * to mark that item synced/failed. [screeningId]/[icdrLevel]/[referable] are populated
 * on success, [errorMessage] on failure — each item is processed independently, so one
 * corrupt image doesn't fail the whole batch.
 */
data class SyncResultItem(
    @SerializedName("client_local_id") val clientLocalId: String,
    val status: SyncItemStatus,
    @SerializedName("screening_id") val screeningId: String? = null,
    @SerializedName("icdr_level") val icdrLevel: Int? = null,
    val referable: Boolean? = null,
    @SerializedName("error_message") val errorMessage: String? = null
)

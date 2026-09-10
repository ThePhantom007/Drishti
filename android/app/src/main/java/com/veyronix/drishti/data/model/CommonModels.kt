package com.veyronix.drishti.data.network.model

import com.google.gson.annotations.SerializedName

/**
 * Shared / cross-cutting models from api_contract.md.
 *
 * Serialization: Gson (`@SerializedName`) is assumed, paired with Retrofit's
 * `converter-gson`. If you're using Moshi or kotlinx.serialization instead, swap
 * `@SerializedName("x")` for `@Json(name = "x")` or `@SerialName("x")` respectively —
 * the field layout below doesn't change.
 */

/** GET /api/health */
data class HealthResponse(
    val status: String,
    @SerializedName("model_version") val modelVersion: String
)

/**
 * Error shape returned by *every* endpoint on failure (see "Error shape" in the
 * contract). Wire this as your Retrofit error-body converter target, e.g. via
 * `response.errorBody()?.let { gson.fromJson(it.charStream(), ApiErrorResponse::class.java) }`.
 */
data class ApiErrorResponse(
    val status: String, // always "error"
    @SerializedName("error_code") val errorCode: String,
    val message: String
)

/**
 * ISO codes accepted by the `language` field on /api/screen and the `lang` query
 * param on /api/reports/{id}/audio. Kept as a String (not this enum) in requests
 * to stay forward-compatible if the backend adds a language before the app updates —
 * use [SupportedLanguage.values] only for populating a picker.
 */
enum class SupportedLanguage(val code: String) {
    ENGLISH("en"), HINDI("hi"), BENGALI("bn"), TAMIL("ta"), TELUGU("te"),
    MARATHI("mr"), GUJARATI("gu"), KANNADA("kn"), MALAYALAM("ml"),
    PUNJABI("pa"), URDU("ur")
}

package com.veyronix.drishti.data

/**
 * Minimal in-memory session holder for the logged-in ASHA worker.
 *
 * This is intentionally NOT persisted (no DataStore/SharedPreferences) — it exists so
 * Home/Settings/Result screens can show who's logged in without threading a name through
 * nav args on every destination. Login is a demo gate (any input is accepted), so there's
 * no real auth token to store yet.
 *
 * TODO: once real auth exists, replace this with a persisted session (DataStore) holding
 * an auth token, and clear it on logout.
 */
object SessionManager {

    var workerName: String = "ASHA Worker"
        private set

    var workerId: String? = null
        private set

    val isLoggedIn: Boolean get() = workerId != null

    fun login(idOrName: String) {
        val trimmed = idOrName.trim()
        workerId = trimmed.ifEmpty { "guest" }
        workerName = trimmed.ifEmpty { "ASHA Worker" }
    }

    fun logout() {
        workerId = null
        workerName = "ASHA Worker"
    }
}

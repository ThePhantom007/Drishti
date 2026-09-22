package com.veyronix.drishti.util

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.veyronix.drishti.R

/**
 * Wraps the app's system notifications. Kept deliberately simple (no tap-through
 * PendingIntents into specific screens yet) — TODO: add PendingIntents once the
 * ViewModel/repository layer can resolve a screeningId/patientId back to a destination.
 *
 * Channel is created once from MainActivity.onCreate(). Every post() checks the
 * POST_NOTIFICATIONS runtime permission (required on Android 13+) and silently no-ops
 * if it isn't granted, rather than crashing — MainActivity requests it on first launch,
 * but the user can still deny it.
 */
object NotificationHelper {

    const val CHANNEL_ID = "drishti_alerts"
    private const val NOTIF_ID_REGISTRATION = 1001
    private const val NOTIF_ID_RESULT = 1002
    private const val NOTIF_ID_SYNC = 1003

    fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.notif_channel_name),
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = context.getString(R.string.notif_channel_description)
            }
            val manager = context.getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    fun notifyPatientRegistered(context: Context, patientName: String) {
        post(
            context, NOTIF_ID_REGISTRATION,
            title = context.getString(R.string.notif_patient_registered_title),
            body = context.getString(R.string.notif_patient_registered_body, patientName)
        )
    }

    fun notifyScreeningGraded(context: Context, icdrLabel: String) {
        post(
            context, NOTIF_ID_RESULT,
            title = context.getString(R.string.notif_result_ready_title),
            body = context.getString(R.string.notif_result_ready_body, icdrLabel)
        )
    }

    fun notifyScreeningRejected(context: Context) {
        post(
            context, NOTIF_ID_RESULT,
            title = context.getString(R.string.notif_retake_needed_title),
            body = context.getString(R.string.notif_retake_needed_body)
        )
    }

    fun notifySyncComplete(context: Context, uploadedCount: Int) {
        post(
            context, NOTIF_ID_SYNC,
            title = context.getString(R.string.notif_sync_complete_title),
            body = context.getString(R.string.notif_sync_complete_body, uploadedCount)
        )
    }

    private fun post(context: Context, id: Int, title: String, body: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ActivityCompat.checkSelfPermission(
                context, Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) return
        }

        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(context.getColor(R.color.drishti_blue_800))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        androidx.core.app.NotificationManagerCompat.from(context).notify(id, notification)
    }
}

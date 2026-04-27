package com.classroom.call

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED
            && action != "android.intent.action.LOCKED_BOOT_COMPLETED"
            && action != Intent.ACTION_MY_PACKAGE_REPLACED) return

        val prefs = AppPrefs(context)
        if (prefs.getClassName().isNullOrBlank()) return

        // ForegroundService 시작 (알림 상주 + 알람 감지)
        val serviceIntent = Intent(context, ClassroomForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }

        // Android 10(Q) 미만에서만 Activity 직접 시작 가능
        // Android 10+ 에서는 백그라운드 Activity 시작이 차단됨 →
        // ClassroomForegroundService 의 알림(Notification)을 탭하면 MainActivity가 열림
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            val activityIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(activityIntent)
        }
    }
}

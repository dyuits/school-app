package com.classroom.autostart;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;

/**
 * AlarmManager 에 의해 주기적으로 호출되어 WatchdogService 를 재시작함
 * Android 가 서비스를 강제 종료해도 5분마다 자동 복구
 */
public class RestartReceiver extends BroadcastReceiver {

    private static final String TAG = "ClassroomRestart";
    public static final String ACTION_RESTART = "com.classroom.autostart.RESTART_WATCHDOG";

    @Override
    public void onReceive(Context context, Intent intent) {
        Log.d(TAG, "WatchdogService 재시작 알람 수신");

        // 서비스 재시작
        try {
            Intent serviceIntent = new Intent(context, WatchdogService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
        } catch (Exception e) {
            Log.e(TAG, "서비스 재시작 실패: " + e.getMessage());
        }

        // 다음 알람 재등록 (chain 방식 - Android M+ setExact 는 1회성)
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            Intent nextIntent = new Intent(context, RestartReceiver.class);
            nextIntent.setAction(ACTION_RESTART);
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT |
                (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent pi = PendingIntent.getBroadcast(context, 9001, nextIntent, piFlags);
            long trigger = SystemClock.elapsedRealtime() + 5 * 60 * 1000L;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, trigger, pi);
            } else {
                am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, trigger, pi);
            }
        } catch (Exception e) {
            Log.w(TAG, "다음 알람 등록 실패: " + e.getMessage());
        }
    }
}

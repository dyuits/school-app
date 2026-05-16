package com.classroom.autostart;

import android.app.*;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

/**
 * Chrome 감시 서비스: Chrome이 죽으면 자동 재실행
 * Foreground Service로 시스템에 의한 종료 방지
 */
public class WatchdogService extends Service {

    private static final String TAG = "ClassroomWatchdog";
    private static final String PREF_NAME = "classroom_prefs";
    private static final String KEY_CLASS = "class_id";
    private static final String BASE_URL = "https://dyuits.github.io/school-app/classroom.html?class=";
    private static final String CHANNEL_ID = "classroom_watchdog";
    private static final int NOTIFICATION_ID = 1001;
    private static final long CHECK_INTERVAL = 15000; // 15초마다 체크

    private Handler handler;
    private Runnable checkRunnable;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());

        handler = new Handler(Looper.getMainLooper());
        checkRunnable = new Runnable() {
            @Override
            public void run() {
                checkAndRelaunchChrome();
                handler.postDelayed(this, CHECK_INTERVAL);
            }
        };
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "감시 서비스 시작됨");
        handler.removeCallbacks(checkRunnable);
        handler.postDelayed(checkRunnable, CHECK_INTERVAL);
        // 시스템이 종료해도 자동 재시작
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (handler != null) {
            handler.removeCallbacks(checkRunnable);
        }
        Log.d(TAG, "감시 서비스 종료됨");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // 앱이 최근 앱에서 제거되어도 서비스 유지
        Log.d(TAG, "앱 제거됨 - 서비스 재시작 예약");
        Intent restartIntent = new Intent(getApplicationContext(), WatchdogService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(restartIntent);
        } else {
            startService(restartIntent);
        }
        super.onTaskRemoved(rootIntent);
    }

    private void checkAndRelaunchChrome() {
        if (!isChromeRunning()) {
            Log.d(TAG, "Chrome 미실행 감지 - 재실행");
            launchChrome();
        }
    }

    private boolean isChromeRunning() {
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) return false;
        for (ActivityManager.RunningAppProcessInfo proc : am.getRunningAppProcesses()) {
            if ("com.android.chrome".equals(proc.processName)) {
                return true;
            }
        }
        return false;
    }

    private void launchChrome() {
        SharedPreferences prefs = getSharedPreferences(PREF_NAME, MODE_PRIVATE);
        String classId = prefs.getString(KEY_CLASS, "");
        if (classId.isEmpty()) return;

        String url = BASE_URL + classId;
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.setPackage("com.android.chrome");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(intent);
        } catch (Exception e) {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "교실알림 감시", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Chrome 자동 실행 감시 서비스");
            channel.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        SharedPreferences prefs = getSharedPreferences(PREF_NAME, MODE_PRIVATE);
        String classId = prefs.getString(KEY_CLASS, "");
        String text = classId.isEmpty() ? "교실알림 감시 중" : classId + " 교실알림 감시 중";

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }

        return builder
            .setContentTitle("교실알림 자동실행")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .build();
    }
}

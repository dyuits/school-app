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
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Log;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

import android.app.PendingIntent;

/**
 * Chrome 감시 + Firebase 호출 감시 서비스
 * - Chrome이 죽으면 자동 재실행
 * - Firebase에 호출이 오면 네이티브 CallActivity 표시 + Android TTS
 */
public class WatchdogService extends Service {

    private static final String TAG = "ClassroomWatchdog";
    private static final String PREF_NAME = "classroom_prefs";
    private static final String KEY_CLASS = "class_id";
    private static final String BASE_URL = "https://dyuits.github.io/school-app/classroom.html?class=";
    private static final String FIREBASE_URL = "https://numeric-mile-356201-default-rtdb.asia-southeast1.firebasedatabase.app";
    private static final String CHANNEL_ID = "classroom_watchdog";
    private static final int NOTIFICATION_ID = 1001;

    private static final long CHROME_CHECK_INTERVAL = 15000; // 15초
    private static final long CALL_CHECK_INTERVAL   = 3000;  // 3초

    private Handler handler;
    private Runnable chromeCheckRunnable;
    private Runnable callCheckRunnable;
    private long lastHandledCallTs = 0;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification());
        handler = new Handler(Looper.getMainLooper());
        scheduleRestartAlarm();

        chromeCheckRunnable = new Runnable() {
            @Override public void run() {
                checkAndRelaunchChrome();
                handler.postDelayed(this, CHROME_CHECK_INTERVAL);
            }
        };

        callCheckRunnable = new Runnable() {
            @Override public void run() {
                checkFirebaseCall();
                handler.postDelayed(this, CALL_CHECK_INTERVAL);
            }
        };
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "감시 서비스 시작");
        handler.removeCallbacks(chromeCheckRunnable);
        handler.removeCallbacks(callCheckRunnable);
        handler.postDelayed(chromeCheckRunnable, CHROME_CHECK_INTERVAL);
        handler.postDelayed(callCheckRunnable, 2000); // 2초 후 첫 호출 감시 시작
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (handler != null) {
            handler.removeCallbacks(chromeCheckRunnable);
            handler.removeCallbacks(callCheckRunnable);
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        Intent restartIntent = new Intent(getApplicationContext(), WatchdogService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(restartIntent);
        } else {
            startService(restartIntent);
        }
        super.onTaskRemoved(rootIntent);
    }

    // ── AlarmManager 재시작 보장 ──────────────────────────────────

    private void scheduleRestartAlarm() {
        try {
            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;

            Intent intent = new Intent(this, RestartReceiver.class);
            intent.setAction(RestartReceiver.ACTION_RESTART);
            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT |
                (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent pi = PendingIntent.getBroadcast(this, 9001, intent, piFlags);

            // 5분마다 반복 (서비스가 죽어도 알람이 재시작)
            long interval = 5 * 60 * 1000L;
            long trigger = SystemClock.elapsedRealtime() + interval;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, trigger, pi);
            } else {
                am.setRepeating(AlarmManager.ELAPSED_REALTIME_WAKEUP, trigger, interval, pi);
            }
            Log.d(TAG, "재시작 알람 등록 완료 (5분 주기)");
        } catch (Exception e) {
            Log.w(TAG, "알람 등록 실패: " + e.getMessage());
        }
    }

    // ── Chrome 감시 ───────────────────────────────────────────────

    private void checkAndRelaunchChrome() {
        if (!isChromeRunning()) {
            Log.d(TAG, "Chrome 미실행 → 재실행");
            launchChrome();
        }
    }

    private boolean isChromeRunning() {
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) return false;
        for (ActivityManager.RunningAppProcessInfo proc : am.getRunningAppProcesses()) {
            if ("com.android.chrome".equals(proc.processName)) return true;
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
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(intent);
        } catch (Exception e) {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        }
    }

    // ── Firebase 호출 감시 ────────────────────────────────────────

    private void checkFirebaseCall() {
        SharedPreferences prefs = getSharedPreferences(PREF_NAME, MODE_PRIVATE);
        String classId = prefs.getString(KEY_CLASS, "");
        if (classId.isEmpty()) return;

        new Thread(() -> {
            try {
                URL url = new URL(FIREBASE_URL + "/calls/" + classId + ".json");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(4000);
                conn.setReadTimeout(4000);

                if (conn.getResponseCode() == 200) {
                    BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = br.readLine()) != null) sb.append(line);
                    br.close();

                    String json = sb.toString().trim();
                    if (!json.equals("null") && json.startsWith("{")) {
                        long ts = extractLong(json, "timestamp");
                        if (ts > 0 && ts > lastHandledCallTs) {
                            // 1분 이내 호출만 처리
                            if (System.currentTimeMillis() - ts < 60000) {
                                lastHandledCallTs = ts;
                                String student = extractString(json, "studentName");
                                String message  = extractString(json, "message");
                                String teacher  = extractString(json, "callerTeacher");
                                handler.post(() -> showCallScreen(classId, student, message, teacher));
                            }
                        }
                    }
                }
                conn.disconnect();
            } catch (Exception e) {
                Log.w(TAG, "Firebase 호출 확인 실패: " + e.getMessage());
            }
        }).start();
    }

    private void showCallScreen(String classId, String student, String message, String teacher) {
        Log.d(TAG, "호출 수신: " + student + " / " + message);

        Intent callIntent = new Intent(this, CallActivity.class);
        callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        callIntent.putExtra("studentName", student);
        callIntent.putExtra("message", message);
        callIntent.putExtra("teacher", teacher);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT |
            (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent fullScreenPi = PendingIntent.getActivity(this, 0, callIntent, piFlags);

        // 호출 전용 알림 채널 (IMPORTANCE_HIGH 필수)
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                "classroom_call", "학생 호출", NotificationManager.IMPORTANCE_HIGH);
            ch.setDescription("학생 호출 알림");
            ch.enableVibration(true);
            ch.setVibrationPattern(new long[]{0, 300, 200, 300});
            if (nm != null) nm.createNotificationChannel(ch);
        }

        String title   = student.isEmpty() ? "📢 학생 호출" : "📢 " + student + " 학생 호출";
        String content = (teacher.isEmpty() ? "" : teacher + " 선생님: ") + message;

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            builder = new Notification.Builder(this, "classroom_call");
        } else {
            builder = new Notification.Builder(this);
        }
        builder.setContentTitle(title)
               .setContentText(content)
               .setSmallIcon(android.R.drawable.ic_dialog_info)
               .setAutoCancel(true)
               .setFullScreenIntent(fullScreenPi, true); // 전화 수신처럼 전면 표시

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            builder.setCategory(Notification.CATEGORY_CALL);
            builder.setVisibility(Notification.VISIBILITY_PUBLIC);
        }

        if (nm != null) nm.notify(2001, builder.build());

        // 오버레이 권한 있으면 직접 Activity 시작 (가장 확실한 방법)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(this)) {
            callIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            try { startActivity(callIntent); } catch (Exception e) {
                Log.w(TAG, "직접 시작 실패: " + e.getMessage());
            }
        } else {
            // 오버레이 권한 없으면 알림 전면 표시로 시도
            try { startActivity(callIntent); } catch (Exception ignored) {}
        }

        // 3초 후 Firebase 호출 삭제
        new Thread(() -> {
            try {
                Thread.sleep(3000);
                URL delUrl = new URL(FIREBASE_URL + "/calls/" + classId + ".json");
                HttpURLConnection delConn = (HttpURLConnection) delUrl.openConnection();
                delConn.setRequestMethod("DELETE");
                delConn.setConnectTimeout(4000);
                delConn.getResponseCode();
                delConn.disconnect();
            } catch (Exception ignored) {}
        }).start();
    }

    // ── JSON 파싱 (의존성 없이) ───────────────────────────────────

    private long extractLong(String json, String key) {
        try {
            int idx = json.indexOf("\"" + key + "\":");
            if (idx < 0) return 0;
            int start = idx + key.length() + 3;
            while (start < json.length() && json.charAt(start) == ' ') start++;
            int end = start;
            while (end < json.length() && (Character.isDigit(json.charAt(end)) || json.charAt(end) == '-')) end++;
            return Long.parseLong(json.substring(start, end));
        } catch (Exception e) { return 0; }
    }

    private String extractString(String json, String key) {
        try {
            int idx = json.indexOf("\"" + key + "\":");
            if (idx < 0) return "";
            int q1 = json.indexOf('"', idx + key.length() + 3);
            if (q1 < 0) return "";
            int q2 = json.indexOf('"', q1 + 1);
            if (q2 < 0) return "";
            return json.substring(q1 + 1, q2);
        } catch (Exception e) { return ""; }
    }

    // ── 알림 채널 ─────────────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "교실알림 감시", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Chrome 자동 실행 및 호출 감시 서비스");
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

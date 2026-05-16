package com.classroom.autostart;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

/**
 * 부팅 완료 시 Chrome을 자동으로 실행하는 리시버
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "ClassroomBoot";
    private static final String PREF_NAME = "classroom_prefs";
    private static final String KEY_CLASS = "class_id";
    private static final String BASE_URL = "https://dyuits.github.io/school-app/classroom.html?class=";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        if (action.equals(Intent.ACTION_BOOT_COMPLETED) ||
            action.equals("android.intent.action.QUICKBOOT_POWERON") ||
            action.equals(Intent.ACTION_LOCKED_BOOT_COMPLETED)) {

            Log.d(TAG, "부팅 완료 감지 - 교실알림 자동실행 시작");

            SharedPreferences prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
            String classId = prefs.getString(KEY_CLASS, "");

            if (classId.isEmpty()) {
                Log.w(TAG, "반 설정이 없습니다. 앱을 먼저 실행하여 반을 선택해주세요.");
                return;
            }

            // 부팅 후 15초 대기 (시스템 안정화)
            new Thread(() -> {
                try {
                    Thread.sleep(15000);
                } catch (InterruptedException e) {
                    // ignore
                }

                // Chrome 실행
                String url = BASE_URL + classId;
                Log.d(TAG, "Chrome 실행: " + url);

                try {
                    Intent chromeIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    chromeIntent.setPackage("com.android.chrome");
                    chromeIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    chromeIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    context.startActivity(chromeIntent);
                } catch (Exception e) {
                    // Chrome이 없으면 기본 브라우저
                    Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    context.startActivity(browserIntent);
                }

                // 감시 서비스 시작
                try {
                    Intent serviceIntent = new Intent(context, WatchdogService.class);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent);
                    } else {
                        context.startService(serviceIntent);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "감시 서비스 시작 실패", e);
                }
            }).start();
        }
    }
}

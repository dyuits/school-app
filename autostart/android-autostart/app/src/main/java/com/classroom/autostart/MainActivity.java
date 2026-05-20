package com.classroom.autostart;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.View;
import android.widget.*;

/**
 * 설정 화면: 반 선택 → 저장 → Chrome 실행 + 감시 서비스 시작
 */
public class MainActivity extends Activity {

    private static final String PREF_NAME = "classroom_prefs";
    private static final String KEY_CLASS = "class_id";
    private static final String BASE_URL = "https://dyuits.github.io/school-app/classroom.html?class=";

    private Spinner gradeSpinner, classSpinner;
    private TextView statusText, urlText;
    private Button saveButton, launchButton, stopButton;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        gradeSpinner = findViewById(R.id.gradeSpinner);
        classSpinner = findViewById(R.id.classSpinner);
        statusText = findViewById(R.id.statusText);
        urlText = findViewById(R.id.urlText);
        saveButton = findViewById(R.id.saveButton);
        launchButton = findViewById(R.id.launchButton);
        stopButton = findViewById(R.id.stopButton);

        // 학년 스피너
        String[] grades = {"1학년", "2학년", "3학년"};
        gradeSpinner.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, grades));

        // 반 스피너
        String[] classes = {"1반","2반","3반","4반","5반","6반","7반","8반","9반","10반"};
        classSpinner.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, classes));

        // 저장된 설정 불러오기
        loadSavedClass();

        // 배터리 최적화 해제 요청
        requestIgnoreBatteryOptimization();

        // 알림 권한 요청 (Android 13+)
        requestNotificationPermission();

        // 다른 앱 위에 표시 권한 요청 (백그라운드에서 호출 화면 띄우기 필수)
        requestOverlayPermission();

        // 앱 시작 시 서비스도 바로 시작 (저장된 반이 있으면)
        SharedPreferences prefs2 = getSharedPreferences(PREF_NAME, MODE_PRIVATE);
        if (!prefs2.getString(KEY_CLASS, "").isEmpty()) {
            startWatchdog();
        }

        saveButton.setOnClickListener(v -> {
            saveClassAndStart();
        });

        launchButton.setOnClickListener(v -> {
            launchChrome();
        });

        stopButton.setOnClickListener(v -> {
            stopWatchdog();
        });
    }

    private void loadSavedClass() {
        SharedPreferences prefs = getSharedPreferences(PREF_NAME, MODE_PRIVATE);
        String saved = prefs.getString(KEY_CLASS, "");
        if (!saved.isEmpty()) {
            String[] parts = saved.split("-");
            if (parts.length == 2) {
                int grade = Integer.parseInt(parts[0]) - 1;
                int cls = Integer.parseInt(parts[1]) - 1;
                if (grade >= 0 && grade < 3) gradeSpinner.setSelection(grade);
                if (cls >= 0 && cls < 10) classSpinner.setSelection(cls);
            }
            statusText.setText("✅ 현재 설정: " + saved + " | 자동실행 활성화됨");
            urlText.setText(BASE_URL + saved);
        } else {
            statusText.setText("⚠️ 반을 선택하고 저장해주세요");
            urlText.setText("");
        }
    }

    private String getSelectedClass() {
        int grade = gradeSpinner.getSelectedItemPosition() + 1;
        int cls = classSpinner.getSelectedItemPosition() + 1;
        return grade + "-" + cls;
    }

    private void saveClassAndStart() {
        String classId = getSelectedClass();
        SharedPreferences prefs = getSharedPreferences(PREF_NAME, MODE_PRIVATE);
        prefs.edit().putString(KEY_CLASS, classId).apply();

        String url = BASE_URL + classId;
        statusText.setText("✅ " + classId + " 저장 완료! 자동실행 활성화됨");
        urlText.setText(url);

        // Chrome 실행
        launchChrome();

        // 감시 서비스 시작
        startWatchdog();

        Toast.makeText(this, classId + " 설정 완료!\n부팅 시 자동으로 Chrome이 실행됩니다.", Toast.LENGTH_LONG).show();
    }

    private void launchChrome() {
        String classId = getSelectedClass();
        String url = BASE_URL + classId;

        try {
            // Chrome 앱 모드로 실행
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.setPackage("com.android.chrome");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            startActivity(intent);
        } catch (Exception e) {
            // Chrome이 없으면 기본 브라우저
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        }
    }

    private void startWatchdog() {
        Intent serviceIntent = new Intent(this, WatchdogService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    private void stopWatchdog() {
        Intent serviceIntent = new Intent(this, WatchdogService.class);
        stopService(serviceIntent);
        statusText.setText("⏹️ 감시 서비스 중지됨 (부팅 시 자동실행은 유지)");
        Toast.makeText(this, "감시 서비스가 중지되었습니다.", Toast.LENGTH_SHORT).show();
    }

    private void requestOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                try {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                            Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                    Toast.makeText(this,
                            "\"다른 앱 위에 표시\" 권한을 허용해주세요.\n호출 화면 표시에 필요합니다.",
                            Toast.LENGTH_LONG).show();
                } catch (Exception e) {
                    // 일부 기기 미지원
                }
            }
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) { // Android 13+
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
            }
        }
    }

    private void requestIgnoreBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (!pm.isIgnoringBatteryOptimizations(getPackageName())) {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } catch (Exception e) {
                    // 일부 기기에서 지원 안 함
                }
            }
        }
    }
}

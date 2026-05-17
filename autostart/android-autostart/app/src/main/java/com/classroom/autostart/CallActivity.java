package com.classroom.autostart;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.view.WindowManager;
import android.widget.TextView;

import java.util.Locale;

/**
 * 호출 수신 시 전면에 표시되는 네이티브 화면
 * Chrome이 백그라운드에 있어도 화면 위로 올라오며 Android TTS로 읽어줌
 */
public class CallActivity extends Activity implements TextToSpeech.OnInitListener {

    private TextToSpeech tts;
    private String studentName, message, teacher;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 잠금화면 위, 화면 켜기, 화면 유지
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
        );

        setContentView(R.layout.activity_call);

        studentName = getIntent().getStringExtra("studentName");
        message     = getIntent().getStringExtra("message");
        teacher     = getIntent().getStringExtra("teacher");
        if (studentName == null) studentName = "";
        if (message == null)     message = "";
        if (teacher == null)     teacher = "";

        TextView nameView    = findViewById(R.id.callName);
        TextView msgView     = findViewById(R.id.callMsg);
        TextView teacherView = findViewById(R.id.callTeacher);

        if (nameView != null)    nameView.setText(studentName + " 학생");
        if (msgView != null)     msgView.setText(message);
        if (teacherView != null) teacherView.setText(teacher.isEmpty() ? "" : teacher + " 선생님 호출");

        tts = new TextToSpeech(this, this);

        // 15초 후 자동 닫기
        new Handler(Looper.getMainLooper()).postDelayed(this::finish, 15000);
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS && tts != null) {
            tts.setLanguage(Locale.KOREAN);
            String speech = studentName + " 학생, " + message;
            tts.speak(speech, TextToSpeech.QUEUE_FLUSH, null, "call");
        }
    }

    @Override
    protected void onDestroy() {
        if (tts != null) { tts.stop(); tts.shutdown(); tts = null; }
        super.onDestroy();
    }
}

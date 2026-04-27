package com.classroom.call

import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var ttsManager: KoreanTtsManager
    private lateinit var alarmPlayer: AlarmPlayer
    private lateinit var prefs: AppPrefs

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        prefs = AppPrefs(this)
        val className = prefs.getClassName()
        if (className.isNullOrBlank()) {
            startActivity(Intent(this, ClassSelectActivity::class.java))
            finish()
            return
        }

        setContentView(R.layout.activity_main)
        alarmPlayer = AlarmPlayer(this)
        ttsManager = KoreanTtsManager(this)
        webView = findViewById(R.id.webView)

        startResidentService()
        setupWebView(className)
    }

    private fun startResidentService() {
        val intent = Intent(this, ClassroomForegroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun setupWebView(className: String) {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.settings.allowFileAccess = true
        webView.settings.allowContentAccess = true
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()

        val bridge = ClassroomNativeBridge(alarmPlayer, ttsManager)
        webView.addJavascriptInterface(bridge, "ClassroomNativeBridge")
        webView.addJavascriptInterface(bridge, "AndroidBridge")

        val localUrl = "file:///android_asset/classroom.html?class=$className"
        webView.loadUrl(localUrl)
    }

    override fun onDestroy() {
        super.onDestroy()
        ttsManager.shutdown()
    }
}
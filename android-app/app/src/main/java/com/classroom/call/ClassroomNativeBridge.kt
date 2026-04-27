package com.classroom.call

import android.webkit.JavascriptInterface

class ClassroomNativeBridge(
    private val alarmPlayer: AlarmPlayer,
    private val ttsManager: KoreanTtsManager
) {
    @JavascriptInterface
    fun primeAudio() {
        // no-op, exists for bridge compatibility
    }

    @JavascriptInterface
    fun playAlert(type: String?, volume: Float) {
        alarmPlayer.play(type ?: "dingdong", volume)
    }

    @JavascriptInterface
    fun speakText(text: String?, optionsJson: String?) {
        val volume = parseVolume(optionsJson)
        ttsManager.speak(text ?: "", volume)
    }

    @JavascriptInterface
    fun speak(text: String?) {
        ttsManager.speak(text ?: "", 0.9f)
    }

    @JavascriptInterface
    fun getRuntimeInfo(): String {
        return """{"source":"android"}"""
    }

    private fun parseVolume(optionsJson: String?): Float {
        if (optionsJson.isNullOrBlank()) return 0.9f
        val key = "\"volume\""
        val start = optionsJson.indexOf(key)
        if (start == -1) return 0.9f
        val slice = optionsJson.substring(start + key.length)
        val number = slice.substringAfter(":", "0.9").trim().takeWhile {
            it.isDigit() || it == '.' || it == '-'
        }
        return number.toFloatOrNull()?.coerceIn(0f, 1f) ?: 0.9f
    }
}
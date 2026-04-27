package com.classroom.call

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale

class KoreanTtsManager(context: Context) : TextToSpeech.OnInitListener {
    private var tts: TextToSpeech = TextToSpeech(context.applicationContext, this)
    private var ready = false

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            val result = tts.setLanguage(Locale.KOREAN)
            ready = result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED
            tts.setSpeechRate(0.88f)
            tts.setPitch(1.0f)
        }
    }

    fun speak(text: String, volume: Float) {
        if (!ready) return
        val params = hashMapOf(
            TextToSpeech.Engine.KEY_PARAM_VOLUME to volume.coerceIn(0f, 1f).toString()
        )
        tts.speak(text.take(120), TextToSpeech.QUEUE_FLUSH, params, "classroom-call")
    }

    fun shutdown() {
        tts.stop()
        tts.shutdown()
    }
}
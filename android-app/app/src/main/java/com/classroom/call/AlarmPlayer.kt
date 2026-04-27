package com.classroom.call

import android.content.Context
import android.media.MediaPlayer
import java.io.File
import java.io.FileOutputStream
import kotlin.math.PI
import kotlin.math.sin

class AlarmPlayer(private val context: Context) {
    private val sampleRate = 44100

    fun play(type: String, volume: Float) {
        val safeVolume = volume.coerceIn(0f, 1f)
        val pcm = when (type) {
            "chime" -> chime(safeVolume)
            "melody" -> melody(safeVolume)
            "knock" -> knock(safeVolume)
            "drop" -> drop(safeVolume)
            "bell" -> bell(safeVolume)
            "phone" -> phone(safeVolume)
            "alarm" -> alarm(safeVolume)
            else -> dingdong(safeVolume)
        }
        val wav = pcmToWav(pcm)
        val file = File(context.cacheDir, "alert_$type.wav")
        FileOutputStream(file).use { it.write(wav) }
        MediaPlayer().apply {
            setDataSource(file.absolutePath)
            setVolume(safeVolume, safeVolume)
            setOnCompletionListener {
                it.release()
                file.delete()
            }
            prepare()
            start()
        }
    }

    private fun dingdong(v: Float): ShortArray = sequence(
        tone(880.0, 0.45, v),
        silence(0.05),
        tone(659.0, 0.65, v)
    )

    private fun chime(v: Float): ShortArray = sequence(
        tone(523.0, 0.45, v),
        tone(659.0, 0.45, v),
        tone(784.0, 0.55, v)
    )

    private fun melody(v: Float): ShortArray = sequence(
        tone(523.0, 0.25, v),
        tone(659.0, 0.25, v),
        tone(784.0, 0.25, v),
        tone(1047.0, 0.35, v)
    )

    private fun knock(v: Float): ShortArray = sequence(
        tone(200.0, 0.09, v),
        silence(0.08),
        tone(180.0, 0.09, v),
        silence(0.16),
        tone(200.0, 0.09, v)
    )

    private fun drop(v: Float): ShortArray = sequence(
        tone(1200.0, 0.18, v),
        tone(800.0, 0.28, v),
        tone(600.0, 0.34, v)
    )

    private fun bell(v: Float): ShortArray = sequence(
        tone(880.0, 0.8, v),
        tone(660.0, 0.8, v * 0.8f)
    )

    private fun phone(v: Float): ShortArray {
        val parts = mutableListOf<ShortArray>()
        repeat(4) {
            parts += tone(1400.0, 0.12, v)
            parts += tone(1800.0, 0.12, v)
            parts += silence(0.06)
        }
        return sequence(*parts.toTypedArray())
    }

    private fun alarm(v: Float): ShortArray {
        val parts = mutableListOf<ShortArray>()
        repeat(6) { i ->
            val freq = if (i % 2 == 0) 800.0 else 1200.0
            parts += tone(freq, 0.18, v)
            parts += silence(0.06)
        }
        return sequence(*parts.toTypedArray())
    }

    private fun tone(freq: Double, durationSec: Double, volume: Float): ShortArray {
        val count = (sampleRate * durationSec).toInt()
        val arr = ShortArray(count)
        for (i in 0 until count) {
            val env = 1.0 - (i.toDouble() / count).coerceIn(0.0, 1.0) * 0.25
            val s = sin(2.0 * PI * i * freq / sampleRate) * volume * env
            arr[i] = (s * Short.MAX_VALUE).toInt().toShort()
        }
        return arr
    }

    private fun silence(durationSec: Double): ShortArray = ShortArray((sampleRate * durationSec).toInt())

    private fun sequence(vararg chunks: ShortArray): ShortArray {
        val size = chunks.sumOf { it.size }
        val out = ShortArray(size)
        var idx = 0
        for (chunk in chunks) {
            chunk.copyInto(out, idx)
            idx += chunk.size
        }
        return out
    }

    private fun pcmToWav(pcm: ShortArray): ByteArray {
        val dataSize = pcm.size * 2
        val out = ByteArray(44 + dataSize)
        writeString(out, 0, "RIFF")
        writeInt(out, 4, 36 + dataSize)
        writeString(out, 8, "WAVE")
        writeString(out, 12, "fmt ")
        writeInt(out, 16, 16)
        writeShort(out, 20, 1)
        writeShort(out, 22, 1)
        writeInt(out, 24, sampleRate)
        writeInt(out, 28, sampleRate * 2)
        writeShort(out, 32, 2)
        writeShort(out, 34, 16)
        writeString(out, 36, "data")
        writeInt(out, 40, dataSize)
        var j = 44
        for (s in pcm) {
            out[j++] = (s.toInt() and 0xff).toByte()
            out[j++] = ((s.toInt() shr 8) and 0xff).toByte()
        }
        return out
    }

    private fun writeString(a: ByteArray, offset: Int, value: String) {
        value.toByteArray().copyInto(a, offset)
    }

    private fun writeInt(a: ByteArray, offset: Int, value: Int) {
        a[offset] = (value and 0xff).toByte()
        a[offset + 1] = ((value shr 8) and 0xff).toByte()
        a[offset + 2] = ((value shr 16) and 0xff).toByte()
        a[offset + 3] = ((value shr 24) and 0xff).toByte()
    }

    private fun writeShort(a: ByteArray, offset: Int, value: Int) {
        a[offset] = (value and 0xff).toByte()
        a[offset + 1] = ((value shr 8) and 0xff).toByte()
    }
}
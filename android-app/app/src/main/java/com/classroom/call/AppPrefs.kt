package com.classroom.call

import android.content.Context

class AppPrefs(context: Context) {
    private val prefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    fun getClassName(): String? = prefs.getString(KEY_CLASS, null)

    fun setClassName(className: String) {
        prefs.edit().putString(KEY_CLASS, className).apply()
    }

    companion object {
        private const val PREF_NAME = "classroom_call_prefs"
        private const val KEY_CLASS = "selected_class"
    }
}
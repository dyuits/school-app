package com.classroom.call

import android.content.Intent
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.Spinner
import androidx.appcompat.app.AppCompatActivity

class ClassSelectActivity : AppCompatActivity() {
    private val classList = buildList {
        for (g in 1..3) {
            for (c in 1..10) {
                add("$g-$c")
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_class_select)

        val prefs = AppPrefs(this)
        val spinner = findViewById<Spinner>(R.id.classSpinner)
        val button = findViewById<Button>(R.id.confirmButton)

        spinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, classList)
        prefs.getClassName()?.let {
            val idx = classList.indexOf(it)
            if (idx >= 0) spinner.setSelection(idx)
        }

        button.setOnClickListener {
            val selected = spinner.selectedItem?.toString() ?: return@setOnClickListener
            prefs.setClassName(selected)
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }
    }
}
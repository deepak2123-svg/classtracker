package com.classtracker.nativeapp

import android.content.Context
import androidx.core.content.edit

class SubjectAssignmentPreferenceStore(context: Context) {
    private val preferences = context.getSharedPreferences(
        "ledgr_native_subject_assignments",
        Context.MODE_PRIVATE,
    )

    fun acknowledgedVersion(uid: String): Long =
        preferences.getLong("acknowledged_$uid", 0L)

    fun acknowledge(uid: String, version: Long) {
        preferences.edit {
            putLong("acknowledged_$uid", version.coerceAtLeast(0L))
        }
    }
}

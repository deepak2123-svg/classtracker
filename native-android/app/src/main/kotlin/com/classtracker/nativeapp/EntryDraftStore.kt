package com.classtracker.nativeapp

import android.content.Context
import androidx.core.content.edit
import com.classtracker.core.model.TeacherEntryDraft
import org.json.JSONObject

data class StoredEntryDraft(
    val draft: TeacherEntryDraft,
    val savedAt: Long,
)

class EntryDraftStore(context: Context) {
    private val preferences = context.getSharedPreferences(
        "ledgr_native_entry_drafts",
        Context.MODE_PRIVATE,
    )

    fun read(
        uid: String,
        classId: String,
        entryId: String?,
    ): StoredEntryDraft? {
        val raw = preferences.getString(key(uid, classId, entryId), null) ?: return null
        return runCatching {
            val json = JSONObject(raw)
            StoredEntryDraft(
                draft = TeacherEntryDraft(
                    entryId = json.optString("entryId").takeIf(String::isNotBlank),
                    mutationId = json.optString("mutationId"),
                    classId = json.getString("classId"),
                    dateKey = json.getString("dateKey"),
                    title = json.optString("title"),
                    body = json.optString("body"),
                    tag = json.optString("tag", "note"),
                    status = json.optString("status"),
                    timeStart = json.optString("timeStart"),
                    timeEnd = json.optString("timeEnd"),
                    createdAt = json.optLong("createdAt").takeIf { it > 0L },
                ),
                savedAt = json.optLong("savedAt"),
            )
        }.getOrNull()
    }

    fun write(
        uid: String,
        draft: TeacherEntryDraft,
        entryId: String? = draft.entryId,
    ) {
        val json = JSONObject()
            .put("entryId", draft.entryId.orEmpty())
            .put("mutationId", draft.mutationId)
            .put("classId", draft.classId)
            .put("dateKey", draft.dateKey)
            .put("title", draft.title)
            .put("body", draft.body)
            .put("tag", draft.tag)
            .put("status", draft.status)
            .put("timeStart", draft.timeStart)
            .put("timeEnd", draft.timeEnd)
            .put("createdAt", draft.createdAt ?: 0L)
            .put("savedAt", System.currentTimeMillis())
        preferences.edit {
            putString(key(uid, draft.classId, entryId), json.toString())
        }
    }

    fun clear(
        uid: String,
        classId: String,
        entryId: String?,
    ) {
        preferences.edit {
            remove(key(uid, classId, entryId))
        }
    }

    private fun key(
        uid: String,
        classId: String,
        entryId: String?,
    ): String = "$uid::$classId::${entryId ?: "new"}"
}

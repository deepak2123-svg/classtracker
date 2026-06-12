package com.classtracker.core.firebase

import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherFeedbackConversation
import com.classtracker.core.model.TeacherFeedbackMessage
import com.classtracker.core.model.TeacherFeedbackSenderRole
import com.classtracker.core.model.TeacherFeedbackStatus
import com.classtracker.core.model.TeacherProfile
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

interface TeacherFeedbackRepository {
    fun observeConversation(uid: String): Flow<TeacherFeedbackConversation>

    suspend fun sendMessage(
        teacher: AuthenticatedTeacher,
        profile: TeacherProfile,
        body: String,
    )

    suspend fun markTeacherRead(uid: String)
}

class FirebaseTeacherFeedbackRepository(
    private val firestore: FirebaseFirestore,
) : TeacherFeedbackRepository {
    override fun observeConversation(uid: String): Flow<TeacherFeedbackConversation> = callbackFlow {
        val threadRef = firestore.document("feedbackThreads/$uid")
        var status = TeacherFeedbackStatus.Open
        var unreadByTeacher = 0
        var updatedAt = 0L
        var messages = emptyList<TeacherFeedbackMessage>()

        fun publish() {
            trySend(
                TeacherFeedbackConversation(
                    status = status,
                    messages = messages,
                    unreadByTeacher = unreadByTeacher,
                    updatedAt = updatedAt,
                ),
            )
        }

        val threadListener: ListenerRegistration = threadRef.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            val data = snapshot?.data.orEmpty()
            status = if (data["status"] == "resolved") {
                TeacherFeedbackStatus.Resolved
            } else {
                TeacherFeedbackStatus.Open
            }
            unreadByTeacher = (data["unreadByTeacher"] as? Number)?.toInt() ?: 0
            updatedAt = (data["updatedAt"] as? Number)?.toLong() ?: 0L
            publish()
        }
        val messagesListener = threadRef.collection("messages")
            .orderBy("createdAt", Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    close(error)
                    return@addSnapshotListener
                }
                messages = snapshot?.documents.orEmpty().mapNotNull { document ->
                    val body = document.getString("body")?.trim().orEmpty()
                    if (body.isBlank()) return@mapNotNull null
                    TeacherFeedbackMessage(
                        id = document.id,
                        senderRole = if (document.getString("senderRole") == "admin") {
                            TeacherFeedbackSenderRole.Admin
                        } else {
                            TeacherFeedbackSenderRole.Teacher
                        },
                        senderName = document.getString("senderName").orEmpty(),
                        body = body,
                        createdAt = document.getLong("createdAt") ?: 0L,
                    )
                }
                publish()
            }

        publish()
        awaitClose {
            threadListener.remove()
            messagesListener.remove()
        }
    }

    override suspend fun sendMessage(
        teacher: AuthenticatedTeacher,
        profile: TeacherProfile,
        body: String,
    ) {
        val message = body.trim()
        require(message.isNotBlank()) { "Write a message before sending." }
        require(message.length <= MaxFeedbackLength) {
            "Feedback must be $MaxFeedbackLength characters or fewer."
        }

        val now = System.currentTimeMillis()
        val threadRef = firestore.document("feedbackThreads/${teacher.uid}")
        val messageRef = threadRef.collection("messages").document()
        firestore.batch()
            .set(
                messageRef,
                mapOf(
                    "senderUid" to teacher.uid,
                    "senderRole" to "teacher",
                    "senderName" to profile.name.ifBlank { teacher.displayName ?: "Teacher" },
                    "body" to message,
                    "createdAt" to now,
                ),
            )
            .set(
                threadRef,
                mapOf(
                    "teacherUid" to teacher.uid,
                    "teacherName" to profile.name.ifBlank { teacher.displayName ?: "Teacher" },
                    "teacherEmail" to profile.email.ifBlank { teacher.email.orEmpty() },
                    "institutes" to profile.institutes,
                    "status" to "open",
                    "lastMessage" to message.take(160),
                    "lastSenderRole" to "teacher",
                    "updatedAt" to now,
                    "unreadByAdmin" to FieldValue.increment(1),
                ),
                com.google.firebase.firestore.SetOptions.merge(),
            )
            .commit()
            .await()
    }

    override suspend fun markTeacherRead(uid: String) {
        firestore.document("feedbackThreads/$uid")
            .set(
                mapOf("unreadByTeacher" to 0),
                com.google.firebase.firestore.SetOptions.merge(),
            )
            .await()
    }

    private companion object {
        const val MaxFeedbackLength = 2_000
    }
}

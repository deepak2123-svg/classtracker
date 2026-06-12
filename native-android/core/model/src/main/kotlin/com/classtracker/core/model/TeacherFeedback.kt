package com.classtracker.core.model

data class TeacherFeedbackConversation(
    val status: TeacherFeedbackStatus = TeacherFeedbackStatus.Open,
    val messages: List<TeacherFeedbackMessage> = emptyList(),
    val unreadByTeacher: Int = 0,
    val updatedAt: Long = 0L,
)

data class TeacherFeedbackMessage(
    val id: String,
    val senderRole: TeacherFeedbackSenderRole,
    val senderName: String,
    val body: String,
    val createdAt: Long,
)

enum class TeacherFeedbackSenderRole {
    Teacher,
    Admin,
}

enum class TeacherFeedbackStatus {
    Open,
    Resolved,
}

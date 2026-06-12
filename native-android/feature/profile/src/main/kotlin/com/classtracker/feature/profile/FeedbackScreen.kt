package com.classtracker.feature.profile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Send
import androidx.compose.material.icons.outlined.Forum
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.model.TeacherFeedbackConversation
import com.classtracker.core.model.TeacherFeedbackMessage
import com.classtracker.core.model.TeacherFeedbackSenderRole
import com.classtracker.core.model.TeacherFeedbackStatus
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun FeedbackScreen(
    conversation: TeacherFeedbackConversation,
    sending: Boolean,
    sent: Boolean,
    onSend: (String) -> Unit,
    onSentConsumed: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var draft by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    LaunchedEffect(conversation.messages.size) {
        if (conversation.messages.isNotEmpty()) {
            listState.animateScrollToItem(conversation.messages.lastIndex)
        }
    }
    LaunchedEffect(sent) {
        if (sent) {
            draft = ""
            onSentConsumed()
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .imePadding(),
    ) {
        Surface(
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 18.dp, vertical = 14.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text(
                    text = "Feedback & support",
                    style = MaterialTheme.typography.titleLarge,
                )
                Text(
                    text = if (conversation.status == TeacherFeedbackStatus.Resolved) {
                        "This conversation was marked resolved. Send a message to reopen it."
                    } else {
                        "Report an issue or share feedback. An administrator can reply here."
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textMuted,
                )
            }
        }

        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            state = listState,
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (conversation.messages.isEmpty()) {
                item {
                    EmptyFeedback()
                }
            } else {
                items(
                    items = conversation.messages,
                    key = TeacherFeedbackMessage::id,
                ) { message ->
                    FeedbackMessageBubble(message)
                }
            }
        }

        Surface(
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            shadowElevation = 3.dp,
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                OutlinedTextField(
                    value = draft,
                    onValueChange = { if (it.length <= 2_000) draft = it },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    maxLines = 6,
                    label = { Text("Your message") },
                    placeholder = { Text("Describe what happened and what you expected.") },
                    supportingText = {
                        Text(
                            text = "${draft.length}/2000",
                            modifier = Modifier.fillMaxWidth(),
                            textAlign = TextAlign.End,
                        )
                    },
                    shape = RoundedCornerShape(16.dp),
                )
                Button(
                    onClick = { onSend(draft) },
                    enabled = draft.isNotBlank() && !sending,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = colors.teal,
                        contentColor = MaterialTheme.colorScheme.onPrimary,
                    ),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Outlined.Send,
                        contentDescription = null,
                    )
                    Text(
                        text = if (sending) "Sending..." else "Send to admin",
                        modifier = Modifier.padding(start = 8.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun EmptyFeedback() {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = colors.surfaceSoft,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 20.dp, vertical = 26.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Icon(
                imageVector = Icons.Outlined.Forum,
                contentDescription = null,
                tint = colors.teal,
            )
            Text(
                text = "Start a conversation",
                style = MaterialTheme.typography.titleMedium,
            )
            Text(
                text = "Include enough detail for the administrator to understand and reproduce the issue.",
                style = MaterialTheme.typography.bodyMedium,
                color = colors.textMuted,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun FeedbackMessageBubble(message: TeacherFeedbackMessage) {
    val fromTeacher = message.senderRole == TeacherFeedbackSenderRole.Teacher
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (fromTeacher) Arrangement.End else Arrangement.Start,
    ) {
        Surface(
            modifier = Modifier.widthIn(max = 310.dp),
            color = if (fromTeacher) colors.teal else MaterialTheme.colorScheme.surface,
            contentColor = if (fromTeacher) {
                MaterialTheme.colorScheme.onPrimary
            } else {
                MaterialTheme.colorScheme.onSurface
            },
            shape = RoundedCornerShape(
                topStart = 18.dp,
                topEnd = 18.dp,
                bottomStart = if (fromTeacher) 18.dp else 5.dp,
                bottomEnd = if (fromTeacher) 5.dp else 18.dp,
            ),
            border = if (fromTeacher) null else {
                BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
            },
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp),
                verticalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                Text(
                    text = if (fromTeacher) "You" else message.senderName.ifBlank { "Admin" },
                    style = MaterialTheme.typography.labelSmall,
                    color = if (fromTeacher) {
                        MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.78f)
                    } else {
                        colors.textMuted
                    },
                )
                Text(
                    text = message.body,
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (message.createdAt > 0L) {
                    Text(
                        text = feedbackTimeFormat.format(Date(message.createdAt)),
                        style = MaterialTheme.typography.labelSmall,
                        color = if (fromTeacher) {
                            MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.68f)
                        } else {
                            colors.textSubtle
                        },
                    )
                }
            }
        }
    }
}

private val feedbackTimeFormat = SimpleDateFormat("d MMM, h:mm a", Locale.US)

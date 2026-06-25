package com.classtracker.feature.profile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.designsystem.rememberLedgrHaptics
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherEntry

@Composable
fun ManageClassesScreen(
    classes: List<TeacherClass>,
    entries: List<TeacherEntry>,
    deletingClassId: String?,
    deleteEnabled: Boolean,
    onDeleteClass: (TeacherClass) -> Unit,
    modifier: Modifier = Modifier,
) {
    val haptics = rememberLedgrHaptics()
    var pendingDelete by remember { mutableStateOf<TeacherClass?>(null) }
    val entryCounts = remember(entries) { entries.groupingBy(TeacherEntry::classId).eachCount() }

    pendingDelete?.let { teacherClass ->
        val count = entryCounts[teacherClass.id] ?: 0
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("Move class to recycle bin?") },
            text = {
                Text(
                    if (count == 0) {
                        "${teacherClass.sectionName} will be removed from your active classes."
                    } else {
                        "${teacherClass.sectionName} and its $count ${if (count == 1) "entry" else "entries"} will be moved together."
                    },
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        haptics.warning()
                        pendingDelete = null
                        onDeleteClass(teacherClass)
                    },
                ) {
                    Text("Move to recycle bin")
                }
            },
            dismissButton = {
                OutlinedButton(onClick = { pendingDelete = null }) {
                    Text("Cancel")
                }
            },
        )
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    text = "ACTIVE CLASSES",
                    style = MaterialTheme.typography.labelLarge,
                    color = colors.textSubtle,
                )
                Text(
                    text = "${classes.size} ${if (classes.size == 1) "class" else "classes"}",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.ExtraBold,
                )
                Text(
                    text = "Deleted classes stay recoverable in the web and admin recycle bin.",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    color = colors.textSecondary,
                )
            }
        }
        items(classes, key = TeacherClass::id) { teacherClass ->
            val deleting = deletingClassId == teacherClass.id
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surface,
                shape = RoundedCornerShape(18.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                    ) {
                        Text(
                            text = teacherClass.sectionName,
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.ExtraBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            text = teacherClass.instituteName,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Bold,
                            color = colors.textSecondary,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            text = "${entryCounts[teacherClass.id] ?: 0} entries",
                            style = MaterialTheme.typography.labelLarge,
                            color = colors.textSubtle,
                        )
                    }
                    OutlinedButton(
                        onClick = {
                            haptics.warning()
                            pendingDelete = teacherClass
                        },
                        enabled = deleteEnabled && deletingClassId == null,
                    ) {
                        if (deleting) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp,
                            )
                        } else {
                            Icon(
                                imageVector = Icons.Outlined.DeleteOutline,
                                contentDescription = null,
                                tint = colors.red,
                            )
                            Text(
                                text = "Delete",
                                modifier = Modifier.padding(start = 6.dp),
                                color = colors.red,
                            )
                        }
                    }
                }
            }
        }
    }
}

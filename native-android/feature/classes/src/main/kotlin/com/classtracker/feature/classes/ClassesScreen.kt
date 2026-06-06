package com.classtracker.feature.classes

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.School
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrSectionHeading
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.model.TeacherClass

@Composable
fun ClassesScreen(
    classes: List<TeacherClass>,
    entryCount: (String) -> Int,
    onClassClick: (TeacherClass) -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(
            start = 20.dp,
            top = 22.dp,
            end = 20.dp,
            bottom = 28.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            LedgrSectionHeading(
                title = "Classes",
                supportingText = "${classes.size} assigned",
                modifier = Modifier.padding(bottom = 8.dp),
            )
        }

        if (classes.isEmpty()) {
            item {
                LedgrEmptyState(
                    title = "No assigned classes",
                    message = "Classes assigned to your teacher account will be listed here.",
                    icon = Icons.Outlined.School,
                )
            }
        } else {
            items(
                items = classes,
                key = TeacherClass::id,
            ) { teacherClass ->
                ClassCard(
                    teacherClass = teacherClass,
                    entryCount = entryCount(teacherClass.id),
                    onClick = { onClassClick(teacherClass) },
                )
            }
        }
    }
}

@Composable
private fun ClassCard(
    teacherClass: TeacherClass,
    entryCount: Int,
    onClick: () -> Unit,
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = teacherClass.sectionName,
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    text = teacherClass.instituteName,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (teacherClass.subjectName.isNotBlank()) {
                    Text(
                        text = teacherClass.subjectName,
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(top = 5.dp),
                    )
                }
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = entryCount.toString(),
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    text = if (entryCount == 1) "entry" else "entries",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Icon(
                imageVector = Icons.Outlined.ChevronRight,
                contentDescription = "Open class",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Preview(showBackground = true, widthDp = 390, heightDp = 760)
@Composable
private fun ClassesScreenPreview() {
    LedgrTheme(darkTheme = false) {
        ClassesScreen(
            classes = listOf(
                TeacherClass(
                    id = "1",
                    sectionName = "KESHAV-1",
                    instituteName = "Genesis, Panipat",
                    subjectName = "Physics",
                    startTime = null,
                    endTime = null,
                ),
            ),
            entryCount = { 4 },
            onClassClick = {},
        )
    }
}

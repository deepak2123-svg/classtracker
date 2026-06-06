package com.classtracker.feature.today

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.BorderStroke
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.EventBusy
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrSectionHeading
import com.classtracker.core.designsystem.LedgrSummaryTile
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.model.TeacherDashboard
import com.classtracker.core.model.TeacherClass

@Composable
fun TodayScreen(
    dashboard: TeacherDashboard,
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
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        item {
            Text(
                text = dashboard.teacherName?.let { "Good morning, $it" } ?: "Teacher workspace",
                style = MaterialTheme.typography.headlineMedium,
                color = MaterialTheme.colorScheme.onBackground,
            )
            Text(
                text = "Today",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp),
            )
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                LedgrSummaryTile(
                    label = "Classes",
                    value = dashboard.classCount.toString(),
                    modifier = Modifier.weight(1f),
                )
                LedgrSummaryTile(
                    label = "Entries",
                    value = dashboard.entryCountToday.toString(),
                    modifier = Modifier.weight(1f),
                )
                LedgrSummaryTile(
                    label = "Minutes",
                    value = dashboard.studyMinutesToday.toString(),
                    modifier = Modifier.weight(1f),
                )
            }
        }

        item {
            LedgrSectionHeading(
                title = "Upcoming classes",
                supportingText = "Your next teaching sessions",
            )
        }

        if (dashboard.upcomingClasses.isEmpty()) {
            item {
                LedgrEmptyState(
                    title = "No classes to show",
                    message = "Assigned classes will appear here after your account is connected.",
                    icon = Icons.Outlined.EventBusy,
                )
            }
        } else {
            items(
                items = dashboard.upcomingClasses,
                key = TeacherClass::id,
            ) { teacherClass ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                    ),
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
                ) {
                    androidx.compose.foundation.layout.Column(
                        modifier = Modifier.padding(16.dp),
                    ) {
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
                }
            }
        }
    }
}

@Preview(showBackground = true, widthDp = 390, heightDp = 760)
@Composable
private fun TodayScreenPreview() {
    LedgrTheme(darkTheme = false) {
        TodayScreen(dashboard = TeacherDashboard.Empty)
    }
}

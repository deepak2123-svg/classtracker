package com.classtracker.feature.today

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
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

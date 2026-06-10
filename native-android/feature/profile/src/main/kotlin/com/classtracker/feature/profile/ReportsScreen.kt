package com.classtracker.feature.profile

import android.content.Intent
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material.icons.outlined.Summarize
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrPill
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherProfile
import com.classtracker.core.model.TeacherReportClassRow
import com.classtracker.core.model.TeacherReportPeriod
import com.classtracker.core.model.TeacherReportSummary
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.formatReportMinutes
import com.classtracker.core.model.teacherReport
import com.classtracker.core.model.toShareText
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun ReportsScreen(
    snapshot: TeacherSnapshot,
    todayKey: String,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val instituteOptions = remember(snapshot.classes) {
        snapshot.classes.map(TeacherClass::instituteName).distinct().sorted()
    }
    val customBounds = remember(snapshot.entries, todayKey) {
        val keys = snapshot.entries.map(TeacherEntry::dateKey)
        (keys.minOrNull() ?: todayKey) to (keys.maxOrNull() ?: todayKey)
    }
    var period by remember { mutableStateOf(TeacherReportPeriod.Weekly) }
    var selectedInstitute by remember { mutableStateOf<String?>(null) }
    val report = remember(snapshot, todayKey, period, selectedInstitute, customBounds) {
        snapshot.teacherReport(
            period = period,
            todayKey = todayKey,
            instituteName = selectedInstitute,
            customStartDateKey = customBounds.first,
            customEndDateKey = customBounds.second,
        )
    }

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            ReportsHero(report = report)
        }
        item {
            PeriodSelector(
                selected = period,
                onSelected = { period = it },
            )
        }
        item {
            ScopeSelector(
                institutes = instituteOptions,
                selectedInstitute = selectedInstitute,
                onSelected = { selectedInstitute = it },
            )
        }
        item {
            ReportMetrics(report = report)
        }
        item {
            Button(
                onClick = {
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_SUBJECT, "Ledgr ${report.period.label} Report")
                        putExtra(Intent.EXTRA_TEXT, report.toShareText())
                    }
                    context.startActivity(
                        Intent.createChooser(intent, "Share teacher report"),
                    )
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(
                    imageVector = Icons.Outlined.IosShare,
                    contentDescription = null,
                    modifier = Modifier.size(19.dp),
                )
                Text(
                    text = "Share report",
                    modifier = Modifier.padding(start = 8.dp),
                )
            }
        }
        item {
            Text(
                text = "CLASS BREAKDOWN",
                style = MaterialTheme.typography.labelSmall,
                color = colors.textMuted,
                modifier = Modifier.padding(start = 2.dp, top = 2.dp),
            )
        }
        if (report.totalEntries == 0) {
            item {
                LedgrEmptyState(
                    title = "No report entries",
                    message = "Try another period or institute scope.",
                    icon = Icons.Outlined.Summarize,
                )
            }
        } else {
            items(
                items = report.classRows.filter { it.entryCount > 0 },
                key = TeacherReportClassRow::classId,
            ) { row ->
                ReportClassCard(row = row)
            }
        }
    }
}

@Composable
private fun ReportsHero(report: TeacherReportSummary) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = colors.surfaceSoft,
        shape = RoundedCornerShape(24.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Surface(
                    modifier = Modifier.size(52.dp),
                    color = colors.green.copy(alpha = 0.12f),
                    contentColor = colors.green,
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, colors.green.copy(alpha = 0.20f)),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Outlined.Download,
                            contentDescription = null,
                            modifier = Modifier.size(26.dp),
                        )
                    }
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "REPORTS & EXPORT",
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.textMuted,
                    )
                    Text(
                        text = "${report.period.label} teacher report",
                        style = MaterialTheme.typography.headlineSmall.copy(
                            fontSize = 26.sp,
                            lineHeight = 28.sp,
                        ),
                        modifier = Modifier.padding(top = 4.dp),
                    )
                    Text(
                        text = "${report.range.label} · ${report.scopeLabel}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.textSecondary,
                        modifier = Modifier.padding(top = 5.dp),
                    )
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LedgrPill("${report.totalEntries} entries")
                LedgrPill(formatReportMinutes(report.totalMinutes))
                LedgrPill("${report.activeDays} days")
            }
        }
    }
}

@Composable
private fun PeriodSelector(
    selected: TeacherReportPeriod,
    onSelected: (TeacherReportPeriod) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "PERIOD",
            style = MaterialTheme.typography.labelSmall,
            color = colors.textMuted,
            modifier = Modifier.padding(start = 2.dp),
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            TeacherReportPeriod.entries.forEach { period ->
                SelectorChip(
                    label = period.label,
                    selected = selected == period,
                    onClick = { onSelected(period) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun ScopeSelector(
    institutes: List<String>,
    selectedInstitute: String?,
    onSelected: (String?) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            text = "SCOPE",
            style = MaterialTheme.typography.labelSmall,
            color = colors.textMuted,
            modifier = Modifier.padding(start = 2.dp),
        )
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            SelectorChip(
                label = "All institutes",
                selected = selectedInstitute == null,
                onClick = { onSelected(null) },
                modifier = Modifier.fillMaxWidth(),
            )
            institutes.chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { institute ->
                        SelectorChip(
                            label = institute,
                            selected = selectedInstitute == institute,
                            onClick = { onSelected(institute) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (row.size == 1) {
                        Box(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun ReportMetrics(report: TeacherReportSummary) {
    val metrics = listOf(
        "Entries" to report.totalEntries.toString(),
        "Teaching Time" to formatReportMinutes(report.totalMinutes),
        "Classes" to report.classCount.toString(),
        "Timed" to report.timedEntryCount.toString(),
    )
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        metrics.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { (label, value) ->
                    Surface(
                        modifier = Modifier.weight(1f),
                        color = MaterialTheme.colorScheme.surface,
                        shape = RoundedCornerShape(16.dp),
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                    ) {
                        Column(
                            modifier = Modifier.padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            Text(
                                text = label.uppercase(),
                                style = MaterialTheme.typography.labelSmall,
                                color = colors.textSubtle,
                            )
                            Text(
                                text = value,
                                style = MaterialTheme.typography.headlineSmall,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ReportClassCard(row: TeacherReportClassRow) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(
            modifier = Modifier.padding(15.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Box(
                    modifier = Modifier
                        .padding(top = 5.dp)
                        .size(11.dp)
                        .background(colors.teal, CircleShape),
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = row.className,
                        style = MaterialTheme.typography.titleLarge.copy(fontSize = 18.sp),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        text = "${row.instituteName} · ${row.subjectName}",
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textMuted,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                Text(
                    text = formatReportMinutes(row.totalMinutes),
                    style = MaterialTheme.typography.titleMedium,
                    color = colors.textSecondary,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                LedgrPill("${row.entryCount} entries")
                LedgrPill("${row.timedEntryCount} timed")
                row.statusCounts.maxByOrNull { it.value }?.let { (status, count) ->
                    LedgrPill("${status.replaceFirstChar { it.uppercase() }} $count")
                }
            }
        }
    }
}

@Composable
private fun SelectorChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val containerColor by animateColorAsState(
        targetValue = if (selected) colors.forest else MaterialTheme.colorScheme.surface,
        label = "report-chip-container",
    )
    val contentColor by animateColorAsState(
        targetValue = if (selected) Color.White else MaterialTheme.colorScheme.onSurface,
        label = "report-chip-content",
    )
    val borderColor by animateColorAsState(
        targetValue = if (selected) colors.forest else MaterialTheme.colorScheme.outline,
        label = "report-chip-border",
    )
    val scale by animateFloatAsState(
        targetValue = if (selected) 1.02f else 1f,
        animationSpec = spring(stiffness = 460f, dampingRatio = 0.82f),
        label = "report-chip-scale",
    )
    Surface(
        modifier = modifier
            .graphicsLayer {
                scaleX = scale
                scaleY = scale
            }
            .clickable(onClick = onClick),
        color = containerColor,
        contentColor = contentColor,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, borderColor),
    ) {
        Box(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 12.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

private fun todayKey(): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

@Preview(showBackground = true, widthDp = 390, heightDp = 844)
@Composable
private fun ReportsScreenPreview() {
    val snapshot = TeacherSnapshot(
        profile = TeacherProfile(
            uid = "1",
            name = "Deepak Kumar",
            email = "teacher@example.com",
            photoUrl = null,
            subjects = listOf("GS"),
            institutes = listOf("KIS"),
        ),
        classes = listOf(
            TeacherClass("1", "Madhav 3", "KIS SIP", "GS", null, null),
            TeacherClass("2", "Keshav 1", "GIS Karnal", "GS", null, null),
        ),
        entries = listOf(
            TeacherEntry(
                id = "e1",
                classId = "1",
                dateKey = todayKey(),
                title = "Physical Geography",
                body = "",
                tag = "note",
                status = "started",
                timeStart = "09:00",
                timeEnd = "10:30",
                teacherName = "Deepak",
                createdAt = 1L,
            ),
        ),
        trashedEntries = emptyList(),
        availableInstitutes = listOf("KIS SIP", "GIS Karnal"),
        configuredInstituteCount = 2,
        revision = 1L,
    )
    LedgrTheme(darkTheme = false) {
        ReportsScreen(
            snapshot = snapshot,
            todayKey = todayKey(),
        )
    }
}

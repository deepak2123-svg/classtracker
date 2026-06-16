package com.classtracker.feature.profile

import android.app.DatePickerDialog
import android.content.Intent
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.FileProvider
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
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.ChevronLeft
import androidx.compose.material.icons.outlined.ChevronRight
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material.icons.outlined.SaveAlt
import androidx.compose.material.icons.outlined.Summarize
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
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
import com.classtracker.core.designsystem.rememberLedgrHaptics
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherProfile
import com.classtracker.core.model.TeacherReportClassRow
import com.classtracker.core.model.TeacherReportPeriod
import com.classtracker.core.model.TeacherReportSummary
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.PublishedSyllabus
import com.classtracker.core.model.progress
import com.classtracker.core.model.formatReportMinutes
import com.classtracker.core.model.teacherReport
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun ReportsScreen(
    snapshot: TeacherSnapshot,
    todayKey: String,
    syllabi: List<PublishedSyllabus> = emptyList(),
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val haptics = rememberLedgrHaptics()
    val coroutineScope = rememberCoroutineScope()
    val instituteOptions = remember(snapshot.classes) {
        snapshot.classes.map(TeacherClass::instituteName).distinct().sorted()
    }
    val customBounds = remember(snapshot.entries, todayKey) {
        val keys = snapshot.entries.map(TeacherEntry::dateKey)
        (keys.minOrNull() ?: todayKey) to (keys.maxOrNull() ?: todayKey)
    }
    var period by remember { mutableStateOf(TeacherReportPeriod.Weekly) }
    var selectedMonthDate by remember(todayKey) { mutableStateOf(monthStartKey(todayKey)) }
    var showMonthPicker by remember { mutableStateOf(false) }
    var selectedInstitutes by remember(instituteOptions) { mutableStateOf<Set<String>>(emptySet()) }
    var customStartDate by remember(customBounds) { mutableStateOf(customBounds.first) }
    var customEndDate by remember(customBounds) { mutableStateOf(customBounds.second) }
    var pdfExportState by remember { mutableStateOf<PdfExportState>(PdfExportState.Idle) }
    val report = remember(
        snapshot,
        todayKey,
        period,
        selectedMonthDate,
        selectedInstitutes,
        customStartDate,
        customEndDate,
    ) {
        snapshot.teacherReport(
            period = period,
            todayKey = todayKey,
            instituteNames = selectedInstitutes.takeIf { it.isNotEmpty() },
            monthlyDateKey = selectedMonthDate,
            customStartDateKey = customStartDate,
            customEndDateKey = customEndDate,
        )
    }
    val savePdfLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.CreateDocument("application/pdf"),
    ) { destination ->
        if (destination == null) return@rememberLauncherForActivityResult
        pdfExportState = PdfExportState.InProgress
        coroutineScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val export = createReportPdf(
                        context = context,
                        snapshot = snapshot,
                        report = report,
                        syllabi = syllabi,
                    )
                    context.contentResolver.openOutputStream(destination)?.use { output ->
                        export.file.inputStream().use { input ->
                            input.copyTo(output)
                        }
                    } ?: throw IOException("Unable to open the selected location.")
                    export
                }
            }.onSuccess { export ->
                pdfExportState = PdfExportState.Completed("Saved ${export.fileName}")
            }.onFailure { error ->
                pdfExportState = PdfExportState.Failed(
                    error.localizedMessage ?: "Unable to save PDF.",
                )
            }
        }
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
                onSelected = {
                    haptics.selection()
                    period = it
                },
            )
        }
        if (period == TeacherReportPeriod.Monthly) {
            item {
                MonthSelectionCard(
                    selectedMonthDate = selectedMonthDate,
                    onPreviousMonth = {
                        haptics.selection()
                        selectedMonthDate = shiftReportMonth(selectedMonthDate, -1)
                    },
                    onChooseMonth = {
                        haptics.selection()
                        showMonthPicker = true
                    },
                    onNextMonth = {
                        haptics.selection()
                        selectedMonthDate = shiftReportMonth(selectedMonthDate, 1)
                    },
                )
            }
        }
        if (period == TeacherReportPeriod.Custom) {
            item {
                CustomRangeCard(
                    startDateKey = customStartDate,
                    endDateKey = customEndDate,
                    onStartSelected = { customStartDate = it },
                    onEndSelected = { customEndDate = it },
                )
            }
        }
        item {
            ScopeSelector(
                institutes = instituteOptions,
                selectedInstitutes = selectedInstitutes,
                onAllSelected = {
                    haptics.selection()
                    selectedInstitutes = emptySet()
                },
                onInstituteToggled = { institute ->
                    haptics.selection()
                    selectedInstitutes = if (institute in selectedInstitutes) {
                        selectedInstitutes - institute
                    } else {
                        selectedInstitutes + institute
                    }
                },
            )
        }
        item {
            ReportMetrics(report = report)
        }
        item {
            val isExporting = pdfExportState == PdfExportState.InProgress
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                OutlinedButton(
                    onClick = {
                        haptics.confirm()
                        savePdfLauncher.launch(reportPdfFileName(snapshot, report))
                    },
                    enabled = !isExporting,
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(
                        imageVector = Icons.Outlined.SaveAlt,
                        contentDescription = null,
                        modifier = Modifier.size(19.dp),
                    )
                    Text(
                        text = "Save PDF",
                        modifier = Modifier.padding(start = 7.dp),
                    )
                }
                Button(
                    onClick = {
                        haptics.confirm()
                        pdfExportState = PdfExportState.InProgress
                        coroutineScope.launch {
                            runCatching {
                                withContext(Dispatchers.IO) {
                                    createReportPdf(
                                        context = context,
                                        snapshot = snapshot,
                                        report = report,
                                        syllabi = syllabi,
                                    )
                                }
                            }.onSuccess { export ->
                                val shareResult = runCatching {
                                    val intent = Intent(Intent.ACTION_SEND).apply {
                                        type = "application/pdf"
                                        putExtra(
                                            Intent.EXTRA_SUBJECT,
                                            "Ledgr ${report.period.label} Report",
                                        )
                                        putExtra(Intent.EXTRA_STREAM, export.uri)
                                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                    }
                                    context.startActivity(
                                        Intent.createChooser(intent, "Share PDF report"),
                                    )
                                }
                                pdfExportState = shareResult.fold(
                                    onSuccess = {
                                        PdfExportState.Completed("PDF ready to share")
                                    },
                                    onFailure = { error ->
                                        PdfExportState.Failed(
                                            error.localizedMessage ?: "Unable to share PDF.",
                                        )
                                    },
                                )
                            }.onFailure { error ->
                                pdfExportState = PdfExportState.Failed(
                                    error.localizedMessage ?: "Unable to create PDF.",
                                )
                            }
                        }
                    },
                    enabled = !isExporting,
                    modifier = Modifier.weight(1f),
                ) {
                    Icon(
                        imageVector = Icons.Outlined.IosShare,
                        contentDescription = null,
                        modifier = Modifier.size(19.dp),
                    )
                    Text(
                        text = if (isExporting) "Preparing..." else "Share PDF",
                        modifier = Modifier.padding(start = 7.dp),
                    )
                }
            }
        }
        if (pdfExportState != PdfExportState.Idle) {
            item {
                ExportStatusMessage(state = pdfExportState)
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

    if (showMonthPicker) {
        MonthPickerDialog(
            selectedMonthDate = selectedMonthDate,
            onDismiss = { showMonthPicker = false },
            onSelected = {
                selectedMonthDate = it
                showMonthPicker = false
            },
        )
    }
}

private sealed class PdfExportState {
    object Idle : PdfExportState()
    object InProgress : PdfExportState()
    data class Completed(val message: String) : PdfExportState()
    data class Failed(val message: String) : PdfExportState()
}

private data class ReportPdfExport(
    val uri: Uri,
    val fileName: String,
    val file: File,
)

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
                    Text(
                        text = "${displayDate(report.range.startDateKey)} - " +
                            displayDate(report.range.endDateKey),
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.textMuted,
                        modifier = Modifier.padding(top = 3.dp),
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
private fun MonthSelectionCard(
    selectedMonthDate: String,
    onPreviousMonth: () -> Unit,
    onChooseMonth: () -> Unit,
    onNextMonth: () -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            IconButton(onClick = onPreviousMonth) {
                Icon(
                    imageVector = Icons.Outlined.ChevronLeft,
                    contentDescription = "Previous month",
                )
            }
            Surface(
                modifier = Modifier
                    .weight(1f)
                    .clickable(onClick = onChooseMonth),
                color = colors.surfaceSoft,
                shape = RoundedCornerShape(14.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                ) {
                    Icon(
                        imageVector = Icons.Outlined.CalendarMonth,
                        contentDescription = null,
                        tint = colors.teal,
                        modifier = Modifier.size(20.dp),
                    )
                    Column(
                        modifier = Modifier.padding(start = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            text = "REPORT MONTH",
                            style = MaterialTheme.typography.labelSmall,
                            color = colors.textMuted,
                        )
                        Text(
                            text = reportMonthLabel(selectedMonthDate),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
            }
            IconButton(onClick = onNextMonth) {
                Icon(
                    imageVector = Icons.Outlined.ChevronRight,
                    contentDescription = "Next month",
                )
            }
        }
    }
}

@Composable
private fun MonthPickerDialog(
    selectedMonthDate: String,
    onDismiss: () -> Unit,
    onSelected: (String) -> Unit,
) {
    val selected = remember(selectedMonthDate) {
        parseDateKey(selectedMonthDate) ?: Calendar.getInstance()
    }
    var displayedYear by remember(selectedMonthDate) {
        mutableStateOf(selected.get(Calendar.YEAR))
    }
    val selectedYear = selected.get(Calendar.YEAR)
    val selectedMonth = selected.get(Calendar.MONTH)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Choose report month") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    IconButton(onClick = { displayedYear -= 1 }) {
                        Icon(Icons.Outlined.ChevronLeft, contentDescription = "Previous year")
                    }
                    Text(
                        text = displayedYear.toString(),
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    IconButton(onClick = { displayedYear += 1 }) {
                        Icon(Icons.Outlined.ChevronRight, contentDescription = "Next year")
                    }
                }
                monthNames.chunked(3).forEachIndexed { rowIndex, months ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        months.forEachIndexed { columnIndex, monthName ->
                            val monthIndex = (rowIndex * 3) + columnIndex
                            SelectorChip(
                                label = monthName,
                                selected = displayedYear == selectedYear &&
                                    monthIndex == selectedMonth,
                                onClick = {
                                    onSelected(monthDateKey(displayedYear, monthIndex))
                                },
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close")
            }
        },
    )
}

@Composable
private fun CustomRangeCard(
    startDateKey: String,
    endDateKey: String,
    onStartSelected: (String) -> Unit,
    onEndSelected: (String) -> Unit,
) {
    val context = LocalContext.current
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = "CUSTOM DATE RANGE",
                style = MaterialTheme.typography.labelSmall,
                color = colors.textMuted,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                DateField(
                    label = "From",
                    dateKey = startDateKey,
                    onClick = {
                        showReportDatePicker(
                            context = context,
                            initialDateKey = startDateKey,
                            onSelected = onStartSelected,
                        )
                    },
                    modifier = Modifier.weight(1f),
                )
                DateField(
                    label = "To",
                    dateKey = endDateKey,
                    onClick = {
                        showReportDatePicker(
                            context = context,
                            initialDateKey = endDateKey,
                            onSelected = onEndSelected,
                        )
                    },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun DateField(
    label: String,
    dateKey: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.clickable(onClick = onClick),
        color = colors.surfaceSoft,
        contentColor = MaterialTheme.colorScheme.onSurface,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 11.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Text(
                text = label.uppercase(),
                style = MaterialTheme.typography.labelSmall,
                color = colors.textSubtle,
            )
            Text(
                text = displayDate(dateKey),
                style = MaterialTheme.typography.titleMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = dateKey,
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
            )
        }
    }
}

@Composable
private fun ScopeSelector(
    institutes: List<String>,
    selectedInstitutes: Set<String>,
    onAllSelected: () -> Unit,
    onInstituteToggled: (String) -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = "REPORT SCOPE",
                style = MaterialTheme.typography.labelSmall,
                color = colors.textMuted,
            )
            Text(
                text = if (selectedInstitutes.isEmpty()) {
                    "Currently including every institute"
                } else {
                    "Currently including ${selectedInstitutes.size} of ${institutes.size} institutes"
                },
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(
                text = "Use all institutes, or select one or more specific institutes below.",
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSecondary,
            )
            SelectorChip(
                label = "Use all institutes",
                selected = selectedInstitutes.isEmpty(),
                onClick = onAllSelected,
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                text = "CHOOSE SPECIFIC INSTITUTES",
                style = MaterialTheme.typography.labelSmall,
                color = colors.textMuted,
                modifier = Modifier.padding(top = 2.dp),
            )
            institutes.chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { institute ->
                        SelectorChip(
                            label = institute,
                            selected = institute in selectedInstitutes,
                            onClick = { onInstituteToggled(institute) },
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
private fun ExportStatusMessage(state: PdfExportState) {
    when (state) {
        PdfExportState.Idle -> Unit
        PdfExportState.InProgress -> Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            Text(
                text = "Preparing PDF...",
                style = MaterialTheme.typography.bodySmall,
                color = colors.textMuted,
            )
        }
        is PdfExportState.Completed -> Text(
            text = state.message,
            style = MaterialTheme.typography.bodySmall,
            color = colors.green,
            modifier = Modifier.padding(start = 2.dp),
        )
        is PdfExportState.Failed -> Text(
            text = state.message,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(start = 2.dp),
        )
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
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

private fun todayKey(): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

private val monthNames = listOf(
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
)

private fun monthStartKey(dateKey: String): String {
    val calendar = parseDateKey(dateKey) ?: Calendar.getInstance()
    calendar.set(Calendar.DAY_OF_MONTH, 1)
    return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(calendar.time)
}

private fun shiftReportMonth(dateKey: String, amount: Int): String {
    val calendar = parseDateKey(dateKey) ?: Calendar.getInstance()
    calendar.set(Calendar.DAY_OF_MONTH, 1)
    calendar.add(Calendar.MONTH, amount)
    return SimpleDateFormat("yyyy-MM-dd", Locale.US).format(calendar.time)
}

private fun monthDateKey(year: Int, month: Int): String =
    "%04d-%02d-01".format(Locale.US, year, month + 1)

private fun reportMonthLabel(dateKey: String): String {
    val calendar = parseDateKey(dateKey) ?: Calendar.getInstance()
    return SimpleDateFormat("MMMM yyyy", Locale.US).format(calendar.time)
}

private fun showReportDatePicker(
    context: android.content.Context,
    initialDateKey: String,
    onSelected: (String) -> Unit,
) {
    val calendar = parseDateKey(initialDateKey) ?: Calendar.getInstance()
    DatePickerDialog(
        context,
        { _, year, month, day ->
            onSelected(
                "%04d-%02d-%02d".format(
                    Locale.US,
                    year,
                    month + 1,
                    day,
                ),
            )
        },
        calendar.get(Calendar.YEAR),
        calendar.get(Calendar.MONTH),
        calendar.get(Calendar.DAY_OF_MONTH),
    ).show()
}

private fun reportPdfFileName(
    snapshot: TeacherSnapshot,
    report: TeacherReportSummary,
): String =
    "ClassLog_${fileSafePdfPart(snapshot.profile.name)}_" +
        "${fileSafePdfPart(report.period.label)}_" +
        "${fileSafePdfPart(report.scopeLabel)}_" +
        "${report.range.startDateKey}_${report.range.endDateKey}.pdf"

private fun createReportPdf(
    context: android.content.Context,
    snapshot: TeacherSnapshot,
    report: TeacherReportSummary,
    syllabi: List<PublishedSyllabus>,
): ReportPdfExport {
    val outputDir = File(context.filesDir, "reports")
    if (!outputDir.exists() && !outputDir.mkdirs()) {
        throw IOException("Unable to create reports directory.")
    }
    val fileName = reportPdfFileName(snapshot, report)
    val file = File(outputDir, fileName)
    val document = PdfDocument()
    fun finishExport(): ReportPdfExport {
        writePdfDocument(document = document, file = file)
        return ReportPdfExport(
            uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file,
            ),
            fileName = fileName,
            file = file,
        )
    }
    try {
        val groups = buildPdfGroups(snapshot = snapshot, report = report, syllabi = syllabi)
        val pageWidth = 595f
        val pageHeight = 842f
        val marginX = 40f
        val marginBottom = 40f
        val contentWidth = pageWidth - (marginX * 2f)
        var pageNumber = 1
        var page = document.startPage(
            PdfDocument.PageInfo.Builder(pageWidth.toInt(), pageHeight.toInt(), pageNumber).create(),
        )
        var canvas = page.canvas
        var y = 44f

        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.rgb(16, 24, 40)
            textSize = 20f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val sectionPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.rgb(16, 24, 40)
            textSize = 14f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val classPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.rgb(16, 24, 40)
            textSize = 11.5f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val bodyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.rgb(71, 85, 105)
            textSize = 11f
        }
        val mutedPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.rgb(102, 112, 133)
            textSize = 10f
        }
        val cardLabelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.rgb(102, 112, 133)
            textSize = 9f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val cardValuePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.rgb(16, 24, 40)
            textSize = 18f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val tableHeadPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.WHITE
            textSize = 8.8f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val tableBodyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.rgb(16, 24, 40)
            textSize = 8.8f
        }
        val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.FILL
        }
        val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 0.8f
            color = android.graphics.Color.rgb(220, 227, 234)
        }

        fun ensureSpace(required: Float) {
            if (y + required <= pageHeight - marginBottom) return
            document.finishPage(page)
            pageNumber += 1
            page = document.startPage(
                PdfDocument.PageInfo.Builder(pageWidth.toInt(), pageHeight.toInt(), pageNumber).create(),
            )
            canvas = page.canvas
            y = 44f
        }

        fun drawRoundedBox(
            left: Float,
            top: Float,
            width: Float,
            height: Float,
            fillColor: Int,
            strokeColor: Int = android.graphics.Color.rgb(220, 227, 234),
            radius: Float = 12f,
        ) {
            fillPaint.color = fillColor
            canvas.drawRoundRect(left, top, left + width, top + height, radius, radius, fillPaint)
            strokePaint.color = strokeColor
            canvas.drawRoundRect(left, top, left + width, top + height, radius, radius, strokePaint)
        }

        fun drawLine(
            left: Float,
            top: Float,
            width: Float,
            color: Int = android.graphics.Color.rgb(220, 227, 234),
        ) {
            strokePaint.color = color
            canvas.drawLine(left, top, left + width, top, strokePaint)
        }

        fun wrappedLines(
            value: String,
            paint: Paint,
            width: Float,
            maxLines: Int = Int.MAX_VALUE,
        ): List<String> {
            var remaining = value.replace(Regex("\\s+"), " ").trim().ifBlank { "-" }
            val lines = mutableListOf<String>()
            while (remaining.isNotEmpty() && lines.size < maxLines) {
                var count = paint.breakText(remaining, true, width, null).coerceAtLeast(1)
                if (count < remaining.length) {
                    val breakAt = remaining.take(count).lastIndexOf(' ')
                    if (breakAt > 0) count = breakAt
                }
                var line = remaining.take(count).trim()
                remaining = remaining.drop(count).trimStart()
                if (lines.size == maxLines - 1 && remaining.isNotEmpty()) {
                    while (paint.measureText("$line...") > width && line.isNotEmpty()) {
                        line = line.dropLast(1)
                    }
                    lines += "$line..."
                    remaining = ""
                } else {
                    lines += line
                }
            }
            return lines.ifEmpty { listOf("-") }
        }

        fun drawCellText(
            text: String,
            paint: Paint,
            left: Float,
            top: Float,
            width: Float,
            maxLines: Int = 4,
            lineHeight: Float = 11f,
        ) {
            wrappedLines(text, paint, width, maxLines).forEachIndexed { index, line ->
                canvas.drawText(line, left, top + (index * lineHeight), paint)
            }
        }

        fun drawTableHeader(columnLefts: List<Float>, columnWidths: List<Float>) {
            ensureSpace(28f)
            fillPaint.color = android.graphics.Color.rgb(31, 69, 104)
            canvas.drawRect(marginX, y, pageWidth - marginX, y + 26f, fillPaint)
            val labels = listOf("Date", "Time", "Status", "Title", "Notes")
            labels.forEachIndexed { index, label ->
                canvas.drawText(label, columnLefts[index] + 6f, y + 17f, tableHeadPaint)
            }
            y += 26f
        }

        canvas.drawText("ClassLog", marginX, y, titlePaint)
        y += 20f
        canvas.drawText(
            "${snapshot.profile.name} · ${report.period.label} · ${report.scopeLabel}",
            marginX,
            y,
            bodyPaint,
        )
        y += 16f
        canvas.drawText(
            "Exported ${exportedDateLabel()}",
            marginX,
            y,
            bodyPaint,
        )
        y += 16f
        canvas.drawText(
            "${report.range.label}: ${displayDate(report.range.startDateKey)} - " +
                displayDate(report.range.endDateKey),
            marginX,
            y,
            mutedPaint,
        )
        y += 20f

        if (report.totalEntries == 0) {
            drawRoundedBox(
                left = marginX,
                top = y,
                width = contentWidth,
                height = 64f,
                fillColor = android.graphics.Color.rgb(248, 250, 252),
            )
            canvas.drawText("No entries found for this period.", marginX + 16f, y + 28f, sectionPaint)
            canvas.drawText("Try a wider range if you want a larger export.", marginX + 16f, y + 46f, mutedPaint)
            document.finishPage(page)
            return finishExport()
        }

        val summaryCards = listOf(
            "Institutes" to groups.size.toString(),
            "Classes" to report.classCount.toString(),
            "Entries" to report.totalEntries.toString(),
        )
        val cardGap = 10f
        val cardWidth = (contentWidth - (cardGap * (summaryCards.size - 1))) / summaryCards.size
        summaryCards.forEachIndexed { index, card ->
            val left = marginX + (index * (cardWidth + cardGap))
            drawRoundedBox(
                left = left,
                top = y,
                width = cardWidth,
                height = 54f,
                fillColor = android.graphics.Color.rgb(248, 250, 252),
            )
            canvas.drawText(card.first.uppercase(Locale.US), left + 12f, y + 18f, cardLabelPaint)
            canvas.drawText(card.second, left + 12f, y + 40f, cardValuePaint)
        }
        y += 72f

        val columnWidths = listOf(72f, 82f, 76f, 110f, contentWidth - 72f - 82f - 76f - 110f)
        val columnLefts = columnWidths.runningFold(marginX) { acc, width -> acc + width }.dropLast(1)

        groups.forEach { institute ->
            ensureSpace(44f)
            canvas.drawText(institute.name, marginX, y, sectionPaint)
            Paint(mutedPaint).apply { textAlign = Paint.Align.RIGHT }.also { rightPaint ->
                canvas.drawText(
                    "${institute.classes.size} class${if (institute.classes.size == 1) "" else "es"} · " +
                        "${institute.entryCount} entr${if (institute.entryCount == 1) "y" else "ies"}",
                    pageWidth - marginX,
                    y,
                    rightPaint,
                )
            }
            y += 12f
            drawLine(marginX, y, contentWidth)
            y += 18f

            institute.classes.forEach { classGroup ->
                ensureSpace(70f)
                drawRoundedBox(
                    left = marginX,
                    top = y,
                    width = contentWidth,
                    height = 30f,
                    fillColor = android.graphics.Color.rgb(248, 250, 252),
                    radius = 10f,
                )
                canvas.drawText(classGroup.className, marginX + 12f, y + 19f, classPaint)
                if (classGroup.subjectName.isNotBlank()) {
                    Paint(mutedPaint).apply { textAlign = Paint.Align.RIGHT }.also { rightPaint ->
                        canvas.drawText(classGroup.subjectName, pageWidth - marginX - 12f, y + 19f, rightPaint)
                    }
                }
                y += 38f
                if (classGroup.syllabusProgress.isNotBlank()) {
                    ensureSpace(24f)
                    canvas.drawText(
                        classGroup.syllabusProgress,
                        marginX + 4f,
                        y + 10f,
                        bodyPaint,
                    )
                    y += 22f
                }
                drawTableHeader(columnLefts, columnWidths)

                classGroup.entries.forEachIndexed { index, row ->
                    val titleLines = wrappedLines(row.title, tableBodyPaint, columnWidths[3] - 12f, 3)
                    val notesLines = wrappedLines(row.notes, tableBodyPaint, columnWidths[4] - 12f, 4)
                    val statusLines = wrappedLines(row.status, tableBodyPaint, columnWidths[2] - 12f, 2)
                    val maxLines = maxOf(1, titleLines.size, notesLines.size, statusLines.size)
                    val rowHeight = maxOf(28f, 15f + (maxLines * 11f))
                    if (y + rowHeight > pageHeight - marginBottom) {
                        document.finishPage(page)
                        pageNumber += 1
                        page = document.startPage(
                            PdfDocument.PageInfo.Builder(
                                pageWidth.toInt(),
                                pageHeight.toInt(),
                                pageNumber,
                            ).create(),
                        )
                        canvas = page.canvas
                        y = 44f
                        drawTableHeader(columnLefts, columnWidths)
                    }

                    fillPaint.color = if (index % 2 == 0) {
                        android.graphics.Color.WHITE
                    } else {
                        android.graphics.Color.rgb(248, 250, 252)
                    }
                    canvas.drawRect(marginX, y, pageWidth - marginX, y + rowHeight, fillPaint)
                    strokePaint.color = android.graphics.Color.rgb(220, 227, 234)
                    strokePaint.strokeWidth = 0.4f
                    var cellLeft = marginX
                    columnWidths.forEach { width ->
                        canvas.drawRect(cellLeft, y, cellLeft + width, y + rowHeight, strokePaint)
                        cellLeft += width
                    }
                    val textTop = y + 17f
                    drawCellText(formatExportPdfDate(row.dateKey), tableBodyPaint, columnLefts[0] + 6f, textTop, columnWidths[0] - 12f, 1)
                    drawCellText(row.timeLabel, tableBodyPaint, columnLefts[1] + 6f, textTop, columnWidths[1] - 12f, 2)
                    drawCellText(row.status, tableBodyPaint, columnLefts[2] + 6f, textTop, columnWidths[2] - 12f, 2)
                    drawCellText(row.title, tableBodyPaint, columnLefts[3] + 6f, textTop, columnWidths[3] - 12f, 3)
                    drawCellText(row.notes, tableBodyPaint, columnLefts[4] + 6f, textTop, columnWidths[4] - 12f, 4)
                    y += rowHeight
                }
                y += 18f
            }
        }
        document.finishPage(page)
        return finishExport()
    } finally {
        document.close()
    }
}

private fun writePdfDocument(document: PdfDocument, file: File) {
    val tempFile = File(file.parentFile, "${file.name}.tmp")
    FileOutputStream(tempFile).use(document::writeTo)
    if (file.exists() && !file.delete()) {
        tempFile.delete()
        throw IOException("Unable to replace existing report file.")
    }
    if (!tempFile.renameTo(file)) {
        tempFile.copyTo(file, overwrite = true)
        if (!tempFile.delete()) {
            throw IOException("Unable to finalize report file.")
        }
    }
}

private data class PdfInstituteGroup(
    val name: String,
    val classes: List<PdfClassGroup>,
    val entryCount: Int,
)

private data class PdfClassGroup(
    val className: String,
    val subjectName: String,
    val syllabusProgress: String,
    val entries: List<PdfEntryRow>,
)

private data class PdfEntryRow(
    val dateKey: String,
    val timeLabel: String,
    val status: String,
    val title: String,
    val notes: String,
)

private fun buildPdfGroups(
    snapshot: TeacherSnapshot,
    report: TeacherReportSummary,
    syllabi: List<PublishedSyllabus>,
): List<PdfInstituteGroup> {
    val scopedInstituteNames = report.scopedInstituteNames
    val scopedClasses = snapshot.classes
        .filter { teacherClass ->
            scopedInstituteNames == null ||
                scopedInstituteNames.any { it.equals(teacherClass.instituteName, ignoreCase = true) }
        }
    val classById = scopedClasses.associateBy(TeacherClass::id)
    val entriesByClass = snapshot.entries
        .filter { it.classId in classById.keys }
        .filter { it.dateKey in report.range.startDateKey..report.range.endDateKey }
        .sortedWith(
            compareBy<TeacherEntry> { it.dateKey }
                .thenBy { it.timeStart.orEmpty() }
                .thenBy { it.timeEnd.orEmpty() }
                .thenBy { it.status.lowercase(Locale.US) }
                .thenBy { it.title.lowercase(Locale.US) },
        )
        .groupBy(TeacherEntry::classId)

    return scopedClasses
        .mapNotNull { teacherClass ->
            val entries = entriesByClass[teacherClass.id].orEmpty()
            if (entries.isEmpty()) {
                null
            } else {
                teacherClass to entries.map { entry ->
                    PdfEntryRow(
                        dateKey = entry.dateKey,
                        timeLabel = formatPdfTime(entry.timeStart, entry.timeEnd),
                        status = formatPdfStatus(entry.status),
                        title = entry.title.ifBlank { "-" },
                        notes = entry.body.ifBlank { "-" },
                    )
                }
            }
        }
        .groupBy { it.first.instituteName.ifBlank { "No Institute" } }
        .toSortedMap(compareBy(String.CASE_INSENSITIVE_ORDER) { it })
        .map { (instituteName, classPairs) ->
            val classes = classPairs
                .sortedWith(
                    compareBy<Pair<TeacherClass, List<PdfEntryRow>>> {
                        it.first.sectionName.lowercase(Locale.US)
                    }.thenBy {
                        it.first.subjectName.lowercase(Locale.US)
                    },
                )
                .map { (teacherClass, entries) ->
                    PdfClassGroup(
                        className = teacherClass.sectionName.ifBlank { "Untitled Class" },
                        subjectName = teacherClass.subjectName,
                        syllabusProgress = syllabi
                            .filter { syllabus ->
                                syllabus.targets.any { target ->
                                    target.teacherUid == snapshot.profile.uid &&
                                        target.classId == teacherClass.id
                                }
                            }
                            .maxByOrNull(PublishedSyllabus::version)
                            ?.let { syllabus ->
                                val progress = syllabus.progress(snapshot.entriesForClass(teacherClass.id))
                                "Syllabus progress: ${progress.percent}% · " +
                                    "${progress.completedChapters}/${progress.totalChapters} chapters"
                            }
                            .orEmpty(),
                        entries = entries,
                    )
                }
            PdfInstituteGroup(
                name = instituteName,
                classes = classes,
                entryCount = classes.sumOf { it.entries.size },
            )
        }
}

private fun displayDate(dateKey: String): String = runCatching {
    val parsed = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
        isLenient = false
    }.parse(dateKey)
    SimpleDateFormat("d MMM yyyy", Locale.US).format(requireNotNull(parsed))
}.getOrDefault(dateKey)

private fun parseDateKey(value: String): Calendar? {
    val parsed = runCatching {
        SimpleDateFormat("yyyy-MM-dd", Locale.US).apply { isLenient = false }.parse(value)
    }.getOrNull() ?: return null
    return Calendar.getInstance().apply { time = parsed }
}

private fun exportedDateLabel(): String =
    SimpleDateFormat("d MMMM yyyy", Locale.forLanguageTag("en-IN")).format(Date())

private fun formatExportPdfDate(dateKey: String): String = runCatching {
    val parsed = SimpleDateFormat("yyyy-MM-dd", Locale.US).apply {
        isLenient = false
    }.parse(dateKey)
    SimpleDateFormat("dd MMM yyyy", Locale.forLanguageTag("en-IN")).format(requireNotNull(parsed))
}.getOrDefault(dateKey)

private fun formatPdfTime(start: String?, end: String?): String = when {
    !start.isNullOrBlank() && !end.isNullOrBlank() -> "$start - $end"
    !start.isNullOrBlank() -> start
    else -> "-"
}

private fun formatPdfStatus(status: String): String = when (status.lowercase(Locale.US)) {
    "started" -> "Started"
    "inprogress", "in_progress", "in progress" -> "In Progress"
    "completed" -> "Completed"
    else -> status.ifBlank { "-" }.replaceFirstChar { char ->
        if (char.isLowerCase()) char.titlecase(Locale.US) else char.toString()
    }
}

private fun fileSafePdfPart(value: String): String =
    value.trim()
        .replace(Regex("""[<>:"/\\|?*\u0000-\u001F]"""), "")
        .replace(Regex("""[,;]+"""), "_")
        .replace(Regex("""\s+"""), "_")
        .trim('_')
        .ifBlank { "report" }

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

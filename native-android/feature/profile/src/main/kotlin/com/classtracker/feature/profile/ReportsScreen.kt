package com.classtracker.feature.profile

import android.app.DatePickerDialog
import android.content.Intent
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
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
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Calendar
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
    var customStartDate by remember(customBounds) { mutableStateOf(customBounds.first) }
    var customEndDate by remember(customBounds) { mutableStateOf(customBounds.second) }
    val report = remember(
        snapshot,
        todayKey,
        period,
        selectedInstitute,
        customStartDate,
        customEndDate,
    ) {
        snapshot.teacherReport(
            period = period,
            todayKey = todayKey,
            instituteName = selectedInstitute,
            customStartDateKey = customStartDate,
            customEndDateKey = customEndDate,
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
                    val pdfUri = createReportPdf(
                        context = context,
                        report = report,
                    )
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "application/pdf"
                        putExtra(Intent.EXTRA_SUBJECT, "Ledgr ${report.period.label} Report")
                        putExtra(Intent.EXTRA_STREAM, pdfUri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    context.startActivity(
                        Intent.createChooser(intent, "Share PDF report"),
                    )
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(
                    imageVector = Icons.Outlined.Download,
                    contentDescription = null,
                    modifier = Modifier.size(19.dp),
                )
                Text(
                    text = "Share PDF",
                    modifier = Modifier.padding(start = 8.dp),
                )
            }
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
                    text = "Share text summary",
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

private fun createReportPdf(
    context: android.content.Context,
    report: TeacherReportSummary,
): android.net.Uri {
    val outputDir = File(context.cacheDir, "reports").apply { mkdirs() }
    val file = File(
        outputDir,
        "ledgr-${report.period.label.lowercase(Locale.US)}-" +
            "${report.range.startDateKey}-${report.range.endDateKey}.pdf",
    )
    val document = PdfDocument()
    try {
        val pageWidth = 595
        val pageHeight = 842
        val margin = 40f
        var pageNumber = 1
        var page = document.startPage(
            PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create(),
        )
        var canvas = page.canvas
        var y = margin
        val titlePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.rgb(15, 23, 42)
            textSize = 22f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val headingPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.rgb(15, 23, 42)
            textSize = 14f
            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
        }
        val bodyPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.rgb(71, 85, 105)
            textSize = 11f
        }
        val mutedPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = android.graphics.Color.rgb(100, 116, 139)
            textSize = 10f
        }

        fun ensureSpace(required: Float) {
            if (y + required <= pageHeight - margin) return
            document.finishPage(page)
            pageNumber += 1
            page = document.startPage(
                PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create(),
            )
            canvas = page.canvas
            y = margin
        }

        fun drawLine(text: String, paint: Paint, advance: Float = 17f) {
            ensureSpace(advance + 4f)
            canvas.drawText(text, margin, y, paint)
            y += advance
        }

        drawLine("Ledgr Teacher Report", titlePaint, 28f)
        drawLine("${report.period.label} · ${report.scopeLabel}", bodyPaint)
        drawLine(
            "${report.range.label}: ${report.range.startDateKey} to ${report.range.endDateKey}",
            mutedPaint,
        )
        y += 12f
        drawLine("Summary", headingPaint, 20f)
        drawLine("Entries: ${report.totalEntries}", bodyPaint)
        drawLine("Teaching time: ${formatReportMinutes(report.totalMinutes)}", bodyPaint)
        drawLine("Active days: ${report.activeDays}", bodyPaint)
        drawLine("Classes logged: ${report.classCount}", bodyPaint)
        y += 12f
        drawLine("Class breakdown", headingPaint, 20f)

        val rows = report.classRows.filter { it.entryCount > 0 }
        if (rows.isEmpty()) {
            drawLine("No entries in this report window.", bodyPaint)
        } else {
            rows.forEach { row ->
                ensureSpace(54f)
                canvas.drawText(row.className.take(52), margin, y, headingPaint)
                y += 15f
                canvas.drawText(
                    "${row.instituteName} · ${row.subjectName}",
                    margin,
                    y,
                    mutedPaint,
                )
                y += 14f
                canvas.drawText(
                    "${row.entryCount} entries · ${formatReportMinutes(row.totalMinutes)} · " +
                        "${row.timedEntryCount} timed",
                    margin,
                    y,
                    bodyPaint,
                )
                y += 21f
            }
        }
        document.finishPage(page)
        FileOutputStream(file).use(document::writeTo)
    } finally {
        document.close()
    }
    return FileProvider.getUriForFile(
        context,
        "${context.packageName}.fileprovider",
        file,
    )
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

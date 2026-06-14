package com.classtracker.feature.today

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Book
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrPill
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.designsystem.ledgrSectionTone
import com.classtracker.core.model.TeacherClassDraft
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherDashboard
import com.classtracker.core.model.TeacherEntry
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private const val AllInstitutes = "All Classes"
private val HomeCanvas = Color(0xFFEFEEE8)
private val HomeInk = Color(0xFF10204A)
private val HomeMuted = Color(0xFF85837D)
private val HomeBorder = Color(0xFFD4D0C7)
private val HomeChip = Color(0xFFECEAE4)
private val HomeWarning = Color(0xFFFFF0BF)

@Composable
private fun homeCanvasColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.background else HomeCanvas

@Composable
private fun homeSurfaceColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.surface else Color.White

@Composable
private fun homeInkColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.onSurface else HomeInk

@Composable
private fun homeMutedColor() =
    if (LedgrTheme.isDark) colors.textMuted else HomeMuted

@Composable
private fun homeBorderColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.outlineVariant else HomeBorder

@Composable
private fun homeChipColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.surfaceVariant else HomeChip

@Composable
private fun homeWarningColor() =
    if (LedgrTheme.isDark) colors.warningSurface else HomeWarning

@Composable
private fun homeStrongTextColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.onSurface else Color(0xFF111827)

@Composable
fun HomeScreen(
    dashboard: TeacherDashboard,
    classes: List<TeacherClass>,
    entries: List<TeacherEntry>,
    onClassClick: (TeacherClass) -> Unit,
    classCreateEnabled: Boolean,
    onAddClassClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val institutes = remember(classes) {
        classes.map(TeacherClass::instituteName).distinct()
    }
    var selectedInstitute by rememberSaveable { mutableStateOf(AllInstitutes) }
    val visibleClasses = remember(classes, selectedInstitute) {
        if (selectedInstitute == AllInstitutes) {
            classes
        } else {
            classes.filter { it.instituteName == selectedInstitute }
        }
    }
    val visibleClassIds = remember(visibleClasses) { visibleClasses.mapTo(hashSetOf(), TeacherClass::id) }
    val loggedToday = visibleClasses.count { it.id in dashboard.loggedClassIdsToday }
    val notLoggedToday = (visibleClasses.size - loggedToday).coerceAtLeast(0)
    val monthPrefix = currentMonthPrefix()
    val monthEntries = entries.count {
        it.classId in visibleClassIds && it.dateKey.startsWith(monthPrefix)
    }

    if (selectedInstitute != AllInstitutes && selectedInstitute !in institutes) {
        selectedInstitute = AllInstitutes
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(homeCanvasColor()),
        contentPadding = PaddingValues(
            start = 16.dp,
            top = 18.dp,
            end = 16.dp,
            bottom = 22.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            HomeSummaryCard(
                visibleCount = visibleClasses.size,
                loggedToday = loggedToday,
                monthEntries = monthEntries,
                notLoggedToday = notLoggedToday,
            )
        }

        if (institutes.size > 1) {
            item {
                InstituteFilterCard(
                    classes = classes,
                    institutes = institutes,
                    selectedInstitute = selectedInstitute,
                    onInstituteSelected = { selectedInstitute = it },
                )
            }
        }

        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 2.dp, top = 0.dp, end = 2.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text(
                        text = "YOUR CLASSES",
                        style = MaterialTheme.typography.labelLarge.copy(
                            fontSize = 14.sp,
                            lineHeight = 18.sp,
                            fontWeight = FontWeight.ExtraBold,
                        ),
                        color = homeMutedColor(),
                    )
                    Text(
                        text = "${visibleClasses.size} " +
                            if (visibleClasses.size == 1) "class ready" else "classes ready",
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontSize = 19.sp,
                            lineHeight = 23.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = homeInkColor(),
                        ),
                    )
                }
                Text(
                    text = "${visibleClasses.size}/${visibleClasses.size} shown",
                    style = MaterialTheme.typography.labelLarge.copy(
                        fontSize = 14.sp,
                        fontWeight = FontWeight.ExtraBold,
                    ),
                    color = homeMutedColor(),
                )
            }
        }

        if (visibleClasses.isEmpty()) {
            item {
                LedgrEmptyState(
                    title = "No classes yet",
                    message = "Assigned classes will appear here.",
                    icon = Icons.Outlined.Book,
                )
            }
        } else {
            items(
                items = visibleClasses,
                key = TeacherClass::id,
            ) { teacherClass ->
                HomeClassCard(
                    teacherClass = teacherClass,
                    loggedToday = teacherClass.id in dashboard.loggedClassIdsToday,
                    onClick = { onClassClick(teacherClass) },
                )
            }
        }

        if (classCreateEnabled) {
            item {
                AddClassCard(onClick = onAddClassClick)
            }
        }

        item {
            Text(
                text = "Every class. Every teacher. One place.",
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                style = MaterialTheme.typography.bodySmall,
                color = colors.textSubtle,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewClassScreen(
    availableInstitutes: List<String>,
    availableSectionsByInstitute: Map<String, List<String>> = emptyMap(),
    subjectOptions: List<String>,
    saving: Boolean,
    onSaveClass: (TeacherClassDraft) -> Unit,
    modifier: Modifier = Modifier,
) {
    val firstInstitute = remember(availableInstitutes) { availableInstitutes.firstOrNull().orEmpty() }
    var instituteName by rememberSaveable(firstInstitute) { mutableStateOf(firstInstitute) }
    var sectionName by rememberSaveable { mutableStateOf("") }
    var subjectName by rememberSaveable { mutableStateOf(subjectOptions.firstOrNull().orEmpty()) }
    var instituteExpanded by rememberSaveable { mutableStateOf(false) }
    var sectionExpanded by rememberSaveable { mutableStateOf(false) }
    var subjectExpanded by rememberSaveable { mutableStateOf(false) }
    val availableSections = remember(instituteName, availableSectionsByInstitute) {
        availableSectionsByInstitute.sectionsForInstitute(instituteName)
    }

    LaunchedEffect(instituteName, availableSections) {
        if (availableSections.isNotEmpty() && sectionName !in availableSections) {
            sectionName = availableSections.first()
        }
    }

    LaunchedEffect(subjectOptions) {
        if (subjectName !in subjectOptions) {
            subjectName = subjectOptions.firstOrNull().orEmpty()
        }
    }

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .imePadding(),
        contentPadding = PaddingValues(
            start = 16.dp,
            top = 16.dp,
            end = 16.dp,
            bottom = 120.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surface,
                shape = RoundedCornerShape(22.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
                shadowElevation = 4.dp,
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    Text(
                        text = "NEW CLASS",
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.textMuted,
                    )
                    Text(
                        text = "Add a class",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.ExtraBold,
                    )
                    if (availableInstitutes.isEmpty()) {
                        Surface(
                            color = colors.warningSurface,
                            contentColor = Color(0xFF9A3412),
                            shape = RoundedCornerShape(14.dp),
                            border = BorderStroke(1.dp, Color(0xFFFED7AA)),
                        ) {
                            Text(
                                text = "Your admin hasn't created any institutes yet. Contact them before adding a class.",
                                modifier = Modifier.padding(12.dp),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                    } else {
                        ExposedDropdownMenuBox(
                            expanded = instituteExpanded,
                            onExpandedChange = { instituteExpanded = !instituteExpanded },
                        ) {
                            OutlinedTextField(
                                value = instituteName,
                                onValueChange = {},
                                readOnly = true,
                                modifier = Modifier
                                    .menuAnchor()
                                    .fillMaxWidth(),
                                label = { Text("Institute") },
                                trailingIcon = {
                                    ExposedDropdownMenuDefaults.TrailingIcon(
                                        expanded = instituteExpanded,
                                    )
                                },
                                singleLine = true,
                            )
                            ExposedDropdownMenu(
                                expanded = instituteExpanded,
                                onDismissRequest = { instituteExpanded = false },
                            ) {
                                availableInstitutes.forEach { institute ->
                                    BorderedDropdownOption(
                                        text = institute,
                                        selected = institute == instituteName,
                                        onClick = {
                                            instituteName = institute
                                            sectionName = availableSectionsByInstitute
                                                .sectionsForInstitute(institute)
                                                .firstOrNull()
                                                .orEmpty()
                                            instituteExpanded = false
                                        },
                                    )
                                }
                            }
                        }
                    }
                    if (availableSections.isNotEmpty()) {
                        ExposedDropdownMenuBox(
                            expanded = sectionExpanded,
                            onExpandedChange = { sectionExpanded = !sectionExpanded },
                        ) {
                            OutlinedTextField(
                                value = sectionName,
                                onValueChange = {},
                                readOnly = true,
                                modifier = Modifier
                                    .menuAnchor()
                                    .fillMaxWidth(),
                                label = { Text("Class / Section") },
                                trailingIcon = {
                                    ExposedDropdownMenuDefaults.TrailingIcon(
                                        expanded = sectionExpanded,
                                    )
                                },
                                singleLine = true,
                            )
                            ExposedDropdownMenu(
                                expanded = sectionExpanded,
                                onDismissRequest = { sectionExpanded = false },
                            ) {
                                availableSections.forEach { section ->
                                    BorderedDropdownOption(
                                        text = section,
                                        selected = section == sectionName,
                                        onClick = {
                                            sectionName = section
                                            sectionExpanded = false
                                        },
                                    )
                                }
                            }
                        }
                    } else {
                        OutlinedTextField(
                            value = sectionName,
                            onValueChange = { sectionName = it },
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Class / Section") },
                            placeholder = { Text("e.g. Madhav 3") },
                            singleLine = true,
                        )
                    }
                    if (subjectOptions.isEmpty()) {
                        Surface(
                            color = colors.warningSurface,
                            contentColor = Color(0xFF9A3412),
                            shape = RoundedCornerShape(14.dp),
                            border = BorderStroke(1.dp, Color(0xFFFED7AA)),
                        ) {
                            Text(
                                text = "Your administrator has not assigned a subject yet. Contact them before adding a class.",
                                modifier = Modifier.padding(12.dp),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                    } else {
                        ExposedDropdownMenuBox(
                            expanded = subjectExpanded,
                            onExpandedChange = { subjectExpanded = !subjectExpanded },
                        ) {
                            OutlinedTextField(
                                value = subjectName,
                                onValueChange = {},
                                readOnly = true,
                                modifier = Modifier
                                    .menuAnchor()
                                    .fillMaxWidth(),
                                label = { Text("Subject") },
                                trailingIcon = {
                                    ExposedDropdownMenuDefaults.TrailingIcon(
                                        expanded = subjectExpanded,
                                    )
                                },
                                singleLine = true,
                            )
                            ExposedDropdownMenu(
                                expanded = subjectExpanded,
                                onDismissRequest = { subjectExpanded = false },
                            ) {
                                subjectOptions.forEach { subject ->
                                    BorderedDropdownOption(
                                        text = subject,
                                        selected = subject == subjectName,
                                        onClick = {
                                            subjectName = subject
                                            subjectExpanded = false
                                        },
                                    )
                                }
                            }
                        }
                    }
                    Button(
                        onClick = {
                            onSaveClass(
                                TeacherClassDraft(
                                    instituteName = instituteName,
                                    sectionName = sectionName,
                                    subjectName = subjectName,
                                ),
                            )
                        },
                        enabled = !saving &&
                            availableInstitutes.isNotEmpty() &&
                            instituteName.isNotBlank() &&
                            sectionName.isNotBlank() &&
                            subjectName.isNotBlank(),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Add,
                            contentDescription = null,
                            modifier = Modifier.size(19.dp),
                        )
                        Text(
                            text = if (saving) "Adding..." else "Add Class",
                            modifier = Modifier.padding(start = 8.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun BorderedDropdownOption(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp)
            .heightIn(min = 48.dp)
            .clickable(onClick = onClick),
        color = if (selected) {
            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.36f)
        } else {
            homeSurfaceColor()
        },
        contentColor = homeStrongTextColor(),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(
            width = if (selected) 1.4.dp else 1.dp,
            color = if (selected) MaterialTheme.colorScheme.primary else homeBorderColor(),
        ),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 11.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(
                modifier = Modifier.size(8.dp),
                shape = CircleShape,
                color = if (selected) MaterialTheme.colorScheme.primary else homeMutedColor(),
            ) {}
            Text(
                text = text,
                style = MaterialTheme.typography.titleMedium.copy(
                    fontSize = 15.sp,
                    lineHeight = 19.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = homeStrongTextColor(),
                ),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

private fun Map<String, List<String>>.sectionsForInstitute(instituteName: String): List<String> {
    val normalizedInstitute = instituteName.normalizedLabel()
    return entries.firstOrNull { (key, _) ->
        key.normalizedLabel() == normalizedInstitute
    }?.value.orEmpty()
}

private fun String.normalizedLabel(): String =
    trim().replace(Regex("""\s+"""), " ").lowercase(Locale.US)

@Composable
private fun AddClassCard(
    onClick: () -> Unit,
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(2.dp, MaterialTheme.colorScheme.outline),
        shadowElevation = 2.dp,
    ) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(13.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(
                modifier = Modifier.size(48.dp),
                color = colors.surfaceSoft,
                shape = RoundedCornerShape(16.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = Icons.Outlined.School,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                    )
                }
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Text(
                    text = "Create new class",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.ExtraBold,
                )
                Text(
                    text = "Add a class like the web app.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textSecondary,
                )
            }
            Icon(
                imageVector = Icons.Outlined.Add,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
            )
        }
    }
}

@Composable
private fun HomeSummaryCard(
    visibleCount: Int,
    loggedToday: Int,
    monthEntries: Int,
    notLoggedToday: Int,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = homeSurfaceColor(),
        shape = RoundedCornerShape(22.dp),
        border = BorderStroke(1.dp, homeBorderColor()),
        shadowElevation = 0.dp,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top,
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text(
                        text = "TODAY",
                        style = sectionLabelStyle(),
                        color = homeMutedColor(),
                    )
                    Text(
                        text = currentDateLabel().replace(", ", ",\n"),
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontSize = 23.sp,
                            lineHeight = 26.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = homeInkColor(),
                        ),
                    )
                }
                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = "VISIBLE",
                        style = sectionLabelStyle(),
                        color = homeMutedColor(),
                    )
                    Text(
                        text = visibleCount.toString(),
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontSize = 32.sp,
                            lineHeight = 33.sp,
                            color = homeInkColor(),
                        ),
                    )
                }
            }
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                SummaryPill("$loggedToday logged today")
                SummaryPill("$monthEntries entries this month")
                SummaryPill(
                    text = "$notLoggedToday not logged today",
                    warning = notLoggedToday > 0,
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SummaryPill(
    text: String,
    modifier: Modifier = Modifier,
    warning: Boolean = false,
) {
    Surface(
        modifier = modifier.height(26.dp),
        shape = RoundedCornerShape(999.dp),
        color = if (warning) homeWarningColor() else homeChipColor(),
        contentColor = if (warning) {
            if (LedgrTheme.isDark) Color(0xFFFDE68A) else Color(0xFF9A6700)
        } else {
            if (LedgrTheme.isDark) MaterialTheme.colorScheme.onSurfaceVariant else Color(0xFF4A5568)
        },
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 11.dp),
            horizontalArrangement = Arrangement.spacedBy(5.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (warning) {
                Icon(
                    imageVector = Icons.Outlined.WarningAmber,
                    contentDescription = null,
                    modifier = Modifier.size(14.dp),
                )
            }
            Text(
                text = text,
                style = MaterialTheme.typography.labelLarge.copy(
                    fontSize = 12.sp,
                    lineHeight = 15.sp,
                    fontWeight = FontWeight.ExtraBold,
                ),
                maxLines = 1,
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun InstituteFilterCard(
    classes: List<TeacherClass>,
    institutes: List<String>,
    selectedInstitute: String,
    onInstituteSelected: (String) -> Unit,
) {
    val options = listOf(AllInstitutes) + institutes
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = homeSurfaceColor(),
        shape = RoundedCornerShape(22.dp),
        border = BorderStroke(1.dp, homeBorderColor()),
        shadowElevation = 0.dp,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 13.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            Text(
                text = "INSTITUTE FILTER",
                style = sectionLabelStyle(),
                color = homeMutedColor(),
                modifier = Modifier.padding(horizontal = 2.dp, vertical = 1.dp),
            )
            options.chunked(2).forEach { rowOptions ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    rowOptions.forEach { institute ->
                        val toneSeed = classes.firstOrNull {
                            it.instituteName == institute
                        }?.sectionName ?: institute
                        InstituteOption(
                            label = institute,
                            toneSeed = toneSeed,
                            selected = institute == selectedInstitute,
                            onClick = { onInstituteSelected(institute) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (rowOptions.size == 1) {
                        Box(modifier = Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun InstituteOption(
    label: String,
    toneSeed: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val allClasses = label == AllInstitutes
    val tone = ledgrSectionTone(toneSeed)
    val background = if (allClasses) {
        homeSurfaceColor()
    } else {
        tone.surface
    }
    val borderColor = when {
        selected && allClasses -> colors.outlineStrong
        selected -> tone.accent
        allClasses -> MaterialTheme.colorScheme.outline
        else -> tone.border
    }
    val textColor = homeStrongTextColor()

    Surface(
        modifier = modifier
            .height(42.dp)
            .clickable(onClick = onClick),
        color = background,
        contentColor = textColor,
        shape = RoundedCornerShape(15.dp),
        border = BorderStroke(if (selected) 1.4.dp else 1.2.dp, borderColor),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier.size(10.dp),
                contentAlignment = Alignment.Center,
            ) {
                Surface(
                    modifier = Modifier.size(10.dp),
                    shape = CircleShape,
                    color = if (allClasses) {
                        if (selected) colors.textSecondary else Color.Transparent
                    } else {
                        tone.accent
                    },
                    border = BorderStroke(
                        1.dp,
                        if (allClasses) colors.outlineStrong else tone.border,
                    ),
                ) {}
            }
            Text(
                text = label,
                style = MaterialTheme.typography.titleMedium.copy(
                    fontSize = 13.sp,
                    lineHeight = 16.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = textColor,
                ),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun HomeClassCard(
    teacherClass: TeacherClass,
    loggedToday: Boolean,
    onClick: () -> Unit,
) {
    val tone = ledgrSectionTone(teacherClass.sectionName)
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .height(70.dp)
            .clickable(onClick = onClick),
        color = tone.surface,
        contentColor = tone.text,
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.1.dp, tone.border),
        shadowElevation = 0.dp,
    ) {
        Row(
            modifier = Modifier.padding(start = 16.dp, top = 10.dp, end = 16.dp, bottom = 9.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    text = teacherClass.sectionName,
                    style = MaterialTheme.typography.titleLarge.copy(
                        fontSize = 18.sp,
                        lineHeight = 20.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = homeStrongTextColor(),
                    ),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    MiniHomePill(
                        text = teacherClass.instituteName.ifBlank { "No institute" },
                        dotColor = tone.accent,
                        prominent = true,
                        modifier = Modifier.weight(1f, fill = false),
                    )
                    if (teacherClass.subjectName.isNotBlank()) {
                        MiniHomePill(
                            text = teacherClass.subjectName,
                            dotColor = null,
                        )
                    }
                }
            }
            Surface(
                modifier = Modifier.size(22.dp),
                shape = CircleShape,
                color = if (loggedToday) tone.accent.copy(alpha = 0.16f) else Color.Transparent,
                border = BorderStroke(
                    1.6.dp,
                    if (loggedToday) tone.accent else Color(0xFFBDBEC4),
                ),
            ) {}
        }
    }
}

@Composable
private fun MiniHomePill(
    text: String,
    dotColor: Color?,
    prominent: Boolean = false,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.height(if (prominent) 23.dp else 20.dp),
        color = if (LedgrTheme.isDark) {
            MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.82f)
        } else {
            Color.White.copy(alpha = if (prominent) 0.82f else 0.62f)
        },
        contentColor = homeStrongTextColor(),
        shape = RoundedCornerShape(999.dp),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = if (prominent) 10.dp else 9.dp),
            horizontalArrangement = Arrangement.spacedBy(if (prominent) 7.dp else 6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            dotColor?.let {
                Box(
                    modifier = Modifier
                        .size(if (prominent) 8.dp else 7.dp)
                        .background(it, CircleShape),
                )
            }
            Text(
                text = text,
                style = MaterialTheme.typography.labelMedium.copy(
                    fontSize = if (prominent) 11.sp else 10.sp,
                    lineHeight = if (prominent) 14.sp else 12.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = homeStrongTextColor(),
                ),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun sectionLabelStyle() = MaterialTheme.typography.labelLarge.copy(
    fontSize = 13.sp,
    lineHeight = 16.sp,
    fontWeight = FontWeight.ExtraBold,
)

private fun currentDateLabel(): String =
    SimpleDateFormat("EEEE, d MMMM", Locale.getDefault()).format(Date())

private fun currentMonthPrefix(): String =
    SimpleDateFormat("yyyy-MM", Locale.US).format(Date())

@Preview(showBackground = true, widthDp = 390, heightDp = 844)
@Composable
private fun HomeScreenPreview() {
    val classes = listOf(
        TeacherClass("1", "VIRAT-1", "GIS Karnal, Haryana", "GS", null, null),
        TeacherClass("2", "10th C", "KIS SIP, Karnal, Haryana", "SS", null, null),
        TeacherClass("3", "11th", "KIS Competition Wing", "GS", null, null),
    )
    LedgrTheme(darkTheme = false) {
        HomeScreen(
            dashboard = TeacherDashboard(
                teacherName = "Deepak",
                classCount = classes.size,
                entryCountToday = 0,
                studyMinutesToday = 0,
                upcomingClasses = classes,
                entryCountThisMonth = 0,
                instituteCount = 3,
            ),
            classes = classes,
            entries = emptyList(),
            onClassClick = {},
            classCreateEnabled = true,
            onAddClassClick = {},
        )
    }
}

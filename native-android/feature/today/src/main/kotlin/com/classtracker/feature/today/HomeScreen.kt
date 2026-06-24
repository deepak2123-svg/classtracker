package com.classtracker.feature.today

import android.content.Context
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.zIndex
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrPill
import com.classtracker.core.designsystem.ledgrPressScale
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.designsystem.ledgrSectionTone
import com.classtracker.core.designsystem.rememberLedgrHaptics
import com.classtracker.core.model.PublishedSyllabus
import com.classtracker.core.model.TeacherClassDraft
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherDashboard
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.completedSyllabusUnitIds
import com.classtracker.core.model.progressForCompletedUnitIds
import com.classtracker.core.model.syllabusChapterCompletionMarker
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.abs

private const val AllInstitutes = "All Classes"
private const val HomeClassOrderPrefs = "ledgr_home_class_order"
private const val HomeClassOrderDelimiter = "|"
private const val HomeSwipeHorizontalBias = 1.45f
private const val HomeSwipeTouchSlopMultiplier = 1.15f

@Composable
private fun homeCanvasColor() =
    colors.canvas

@Composable
private fun homeSurfaceColor() =
    MaterialTheme.colorScheme.surface

@Composable
private fun homePanelSurfaceColor() =
    colors.panelSurface

@Composable
private fun homeInkColor() =
    MaterialTheme.colorScheme.onSurface

@Composable
private fun homeMutedColor() =
    colors.textMuted

@Composable
private fun homeBorderColor() =
    colors.borderSoft

@Composable
private fun homePanelBorderColor() =
    colors.panelBorder

@Composable
private fun homeChipColor() =
    colors.chipSurface

@Composable
private fun homeWarningColor() =
    colors.warningSurfaceStrong

@Composable
private fun homeHeroPanelSurfaceColor() =
    colors.heroPanelSurface

@Composable
private fun homeHeroPanelBorderColor() =
    colors.heroPanelBorder

@Composable
private fun homeHeroTextColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.onSurface else Color.White

@Composable
private fun homeHeroMutedColor() =
    colors.heroTextMuted

@Composable
private fun homeStrongTextColor() =
    MaterialTheme.colorScheme.onSurface

@Composable
private fun homeClassBorderColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.outlineVariant
    else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.68f)

@Composable
private fun homeLoggedIndicatorColor() =
    colors.successStrong

@Composable
private fun homeDragHandleColor() =
    if (LedgrTheme.isDark) colors.textMuted.copy(alpha = 0.78f)
    else MaterialTheme.colorScheme.onSurface.copy(alpha = 0.48f)

@Composable
fun HomeScreen(
    dashboard: TeacherDashboard,
    classes: List<TeacherClass>,
    entries: List<TeacherEntry>,
    publishedSyllabi: List<PublishedSyllabus> = emptyList(),
    teacherUid: String = "",
    onClassClick: (TeacherClass) -> Unit,
    onClassHistoryClick: (TeacherClass) -> Unit = {},
    onClassSyllabusClick: (TeacherClass) -> Unit = {},
    classCreateEnabled: Boolean,
    onAddClassClick: () -> Unit,
    orderStorageKey: String? = null,
    modifier: Modifier = Modifier,
) {
    val haptics = rememberLedgrHaptics()
    val context = LocalContext.current
    val classOrderStore = remember(context) {
        context.applicationContext.getSharedPreferences(HomeClassOrderPrefs, Context.MODE_PRIVATE)
    }
    val classOrderPreferenceKey = remember(orderStorageKey) {
        homeClassOrderPreferenceKey(orderStorageKey)
    }
    val persistClassOrder = remember(classOrderStore, classOrderPreferenceKey) {
        { order: List<String> ->
            classOrderStore.edit()
                .putString(classOrderPreferenceKey, order.joinToString(HomeClassOrderDelimiter))
                .apply()
        }
    }
    val institutes = remember(classes) {
        classes.map(TeacherClass::instituteName).distinct()
    }
    var selectedInstitute by rememberSaveable { mutableStateOf(AllInstitutes) }
    var classOrder by rememberSaveable(classOrderPreferenceKey) {
        mutableStateOf(readHomeClassOrder(classOrderStore, classOrderPreferenceKey))
    }
    val allClassIds = remember(classes) { classes.map(TeacherClass::id) }

    LaunchedEffect(allClassIds, classOrderPreferenceKey) {
        val normalizedOrder = classOrder.filter { it in allClassIds } +
            allClassIds.filterNot { it in classOrder }
        if (normalizedOrder != classOrder) {
            classOrder = normalizedOrder
            persistClassOrder(normalizedOrder)
        }
    }

    val orderedClasses = remember(classes, classOrder) {
        val classesById = classes.associateBy(TeacherClass::id)
        val orderedIds = classOrder.ifEmpty { allClassIds }
        val ordered = orderedIds.mapNotNull(classesById::get)
        val orderedIdSet = ordered.mapTo(hashSetOf(), TeacherClass::id)
        ordered + classes.filterNot { it.id in orderedIdSet }
    }
    val visibleClasses = remember(orderedClasses, selectedInstitute) {
        if (selectedInstitute == AllInstitutes) {
            orderedClasses
        } else {
            orderedClasses.filter { it.instituteName == selectedInstitute }
        }
    }
    val visibleClassIds = remember(visibleClasses) { visibleClasses.mapTo(hashSetOf(), TeacherClass::id) }
    val loggedToday = remember(visibleClasses, dashboard.loggedClassIdsToday) {
        visibleClasses.count { it.id in dashboard.loggedClassIdsToday }
    }
    val notLoggedToday = remember(visibleClasses.size, loggedToday) {
        (visibleClasses.size - loggedToday).coerceAtLeast(0)
    }
    val monthPrefix = currentMonthPrefix()
    val entriesByClass = remember(entries) {
        entries.groupBy(TeacherEntry::classId)
    }
    val homeHistoryPreviews = remember(entriesByClass) {
        entriesByClass.mapValues { (_, classEntries) ->
            buildHomeClassHistoryPreview(classEntries)
        }
    }
    val latestSyllabusByClass = remember(classes, publishedSyllabi, teacherUid) {
        classes.associate { teacherClass ->
            teacherClass.id to publishedSyllabi
                .asSequence()
                .filter { it.appliesTo(teacherUid, teacherClass.id) }
                .maxByOrNull(PublishedSyllabus::version)
        }
    }
    val homeSyllabusPreviews = remember(classes, entriesByClass, latestSyllabusByClass) {
        classes.associate { teacherClass ->
            teacherClass.id to buildHomeClassSyllabusPreview(
                syllabus = latestSyllabusByClass[teacherClass.id],
                classEntries = entriesByClass[teacherClass.id].orEmpty(),
            )
        }
    }
    val monthEntries = remember(visibleClassIds, entriesByClass, monthPrefix) {
        visibleClassIds.sumOf { classId ->
            entriesByClass[classId].orEmpty().count { it.dateKey.startsWith(monthPrefix) }
        }
    }

    LaunchedEffect(selectedInstitute, institutes) {
        if (selectedInstitute != AllInstitutes && selectedInstitute !in institutes) {
            selectedInstitute = AllInstitutes
        }
    }

    var draggingClassId by remember { mutableStateOf<String?>(null) }
    var dragOffsetY by remember { mutableStateOf(0f) }
    var dragMoved by remember { mutableStateOf(false) }
    val dragStepPx = with(LocalDensity.current) { 88.dp.toPx() }
    val moveVisibleClass = rememberUpdatedState<(String, Int) -> Boolean>(move@{ classId, direction ->
        val visibleIds = visibleClasses.map(TeacherClass::id)
        val currentVisibleIndex = visibleIds.indexOf(classId)
        if (currentVisibleIndex == -1) return@move false
        val targetVisibleIndex = (currentVisibleIndex + direction).coerceIn(0, visibleIds.lastIndex)
        if (targetVisibleIndex == currentVisibleIndex) return@move false

        val targetId = visibleIds[targetVisibleIndex]
        val nextOrder = (classOrder.ifEmpty { allClassIds }).toMutableList()
        val fromIndex = nextOrder.indexOf(classId)
        if (fromIndex == -1 || targetId !in nextOrder) return@move false

        val movingId = nextOrder.removeAt(fromIndex)
        val targetIndexAfterRemoval = nextOrder.indexOf(targetId)
        val insertIndex = if (direction > 0) targetIndexAfterRemoval + 1 else targetIndexAfterRemoval
        nextOrder.add(insertIndex.coerceIn(0, nextOrder.size), movingId)
        classOrder = nextOrder
        true
    })

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
                val isDragging = draggingClassId == teacherClass.id
                val historyPreview = homeHistoryPreviews[teacherClass.id] ?: HomeClassHistoryPreview(
                    entryCount = 0,
                    latestTitle = "No past entries",
                )
                val syllabusPreview = homeSyllabusPreviews[teacherClass.id] ?: HomeClassSyllabusPreview(
                    available = false,
                    percent = 0,
                    completedChapters = 0,
                    totalChapters = 0,
                    nextChapter = null,
                )
                HomeClassCard(
                    teacherClass = teacherClass,
                    loggedToday = teacherClass.id in dashboard.loggedClassIdsToday,
                    isDragging = isDragging,
                    historyPreview = historyPreview,
                    syllabusPreview = syllabusPreview,
                    onClick = { onClassClick(teacherClass) },
                    onHistoryClick = { onClassHistoryClick(teacherClass) },
                    onSyllabusClick = { onClassSyllabusClick(teacherClass) },
                    reorderHandleModifier = Modifier.pointerInput(teacherClass.id, dragStepPx) {
                        detectDragGesturesAfterLongPress(
                            onDragStart = {
                                draggingClassId = teacherClass.id
                                dragOffsetY = 0f
                                dragMoved = false
                                haptics.dragStart()
                            },
                            onDragCancel = {
                                if (dragMoved) persistClassOrder(classOrder)
                                draggingClassId = null
                                dragOffsetY = 0f
                                dragMoved = false
                            },
                            onDragEnd = {
                                if (dragMoved) haptics.dragDrop()
                                if (dragMoved) persistClassOrder(classOrder)
                                draggingClassId = null
                                dragOffsetY = 0f
                                dragMoved = false
                            },
                            onDrag = { change, dragAmount ->
                                change.consume()
                                dragOffsetY += dragAmount.y
                                while (dragOffsetY > dragStepPx) {
                                    if (moveVisibleClass.value(teacherClass.id, 1)) {
                                        dragOffsetY -= dragStepPx
                                        dragMoved = true
                                        haptics.selection()
                                    } else {
                                        dragOffsetY = dragStepPx
                                        break
                                    }
                                }
                                while (dragOffsetY < -dragStepPx) {
                                    if (moveVisibleClass.value(teacherClass.id, -1)) {
                                        dragOffsetY += dragStepPx
                                        dragMoved = true
                                        haptics.selection()
                                    } else {
                                        dragOffsetY = -dragStepPx
                                        break
                                    }
                                }
                            },
                        )
                    },
                    modifier = Modifier
                        .zIndex(if (isDragging) 1f else 0f)
                        .graphicsLayer {
                            translationY = if (isDragging) dragOffsetY else 0f
                        },
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

private data class HomeClassHistoryPreview(
    val entryCount: Int,
    val latestTitle: String,
)

private data class HomeClassSyllabusPreview(
    val available: Boolean,
    val percent: Int,
    val completedChapters: Int,
    val totalChapters: Int,
    val nextChapter: String?,
)

private enum class HomeClassRevealState {
    Center,
    History,
    Syllabus,
}

private fun homeRevealStateForOffset(
    offsetPx: Float,
    revealDistancePx: Float,
): HomeClassRevealState = when {
    offsetPx >= revealDistancePx * 0.46f -> HomeClassRevealState.History
    offsetPx <= -revealDistancePx * 0.46f -> HomeClassRevealState.Syllabus
    else -> HomeClassRevealState.Center
}

private enum class GestureAxisLock {
    Horizontal,
    Vertical,
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
    val haptics = rememberLedgrHaptics()
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
                            contentColor = colors.warningTextStrong,
                            shape = RoundedCornerShape(14.dp),
                            border = BorderStroke(1.dp, colors.warningBorder),
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
                            contentColor = colors.warningTextStrong,
                            shape = RoundedCornerShape(14.dp),
                            border = BorderStroke(1.dp, colors.warningBorder),
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
                            haptics.confirm()
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
        color = homePanelSurfaceColor(),
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(1.dp, homePanelBorderColor()),
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
                    text = "Add a class.",
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
    val dateLabel = remember { currentDateLabel().replace(", ", ",\n") }
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = homeHeroPanelSurfaceColor(),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, homeHeroPanelBorderColor()),
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
                        color = homeHeroMutedColor(),
                    )
                    Text(
                        text = dateLabel,
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontSize = 23.sp,
                            lineHeight = 26.sp,
                            fontWeight = FontWeight.ExtraBold,
                            color = homeHeroTextColor(),
                        ),
                    )
                }
                Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = "VISIBLE",
                        style = sectionLabelStyle(),
                        color = homeHeroMutedColor(),
                    )
                    Text(
                        text = visibleCount.toString(),
                        style = MaterialTheme.typography.headlineMedium.copy(
                            fontSize = 32.sp,
                            lineHeight = 33.sp,
                            color = homeHeroTextColor(),
                        ),
                    )
                }
            }
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SummaryPill("$loggedToday logged today")
                    SummaryPill("$monthEntries entries this month")
                }
                SummaryPill(
                    text = "$notLoggedToday not logged today",
                    warning = notLoggedToday > 0,
                )
            }
        }
    }
}

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
            colors.warningText
        } else {
            if (LedgrTheme.isDark) MaterialTheme.colorScheme.onSurfaceVariant else colors.textSecondary
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

@Composable
private fun InstituteFilterCard(
    classes: List<TeacherClass>,
    institutes: List<String>,
    selectedInstitute: String,
    onInstituteSelected: (String) -> Unit,
) {
    val optionRows = remember(institutes) {
        (listOf(AllInstitutes) + institutes).chunked(2)
    }
    val toneSeedByOption = remember(classes, institutes) {
        buildMap {
            put(AllInstitutes, AllInstitutes)
            institutes.forEach { institute ->
                put(
                    institute,
                    classes.firstOrNull { it.instituteName == institute }?.sectionName ?: institute,
                )
            }
        }
    }
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = homeHeroPanelSurfaceColor(),
        shape = RoundedCornerShape(22.dp),
        border = BorderStroke(1.dp, homeHeroPanelBorderColor()),
        shadowElevation = 0.dp,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 13.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            Text(
                text = "INSTITUTE FILTER",
                style = sectionLabelStyle(),
                color = homeHeroMutedColor(),
                modifier = Modifier.padding(horizontal = 2.dp, vertical = 1.dp),
            )
            optionRows.forEach { rowOptions ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    rowOptions.forEach { institute ->
                        InstituteOption(
                            label = institute,
                            toneSeed = toneSeedByOption[institute] ?: institute,
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
        if (LedgrTheme.isDark) {
            if (selected) MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.92f)
            else MaterialTheme.colorScheme.surface.copy(alpha = 0.86f)
        } else {
            homeSurfaceColor()
        }
    } else if (LedgrTheme.isDark) {
        if (selected) tone.accent.copy(alpha = 0.22f)
        else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.74f)
    } else {
        tone.surface
    }
    val borderColor = when {
        LedgrTheme.isDark && allClasses && selected ->
            MaterialTheme.colorScheme.outline.copy(alpha = 0.9f)

        LedgrTheme.isDark && allClasses ->
            MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.82f)

        LedgrTheme.isDark && selected ->
            tone.accent.copy(alpha = 0.58f)

        LedgrTheme.isDark ->
            MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.82f)

        else -> homeClassBorderColor()
    }
    val textColor = homeStrongTextColor()

    Surface(
        modifier = modifier
            .height(42.dp)
            .clickable(onClick = onClick),
        color = background,
        contentColor = textColor,
        shape = RoundedCornerShape(15.dp),
        border = BorderStroke(if (selected) 1.35.dp else 1.05.dp, borderColor),
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
                    modifier = Modifier.size(if (selected) 10.dp else 9.dp),
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
    isDragging: Boolean,
    historyPreview: HomeClassHistoryPreview,
    syllabusPreview: HomeClassSyllabusPreview,
    onClick: () -> Unit,
    onHistoryClick: () -> Unit,
    onSyllabusClick: () -> Unit,
    reorderHandleModifier: Modifier = Modifier,
    modifier: Modifier = Modifier,
) {
    val tone = ledgrSectionTone(teacherClass.sectionName)
    val haptics = rememberLedgrHaptics()
    val cardInteractionSource = remember(teacherClass.id) { MutableInteractionSource() }
    val cardShape = RoundedCornerShape(18.dp)
    val revealDistancePx = with(LocalDensity.current) { 92.dp.toPx() }
    val panelSlideDistancePx = with(LocalDensity.current) { 22.dp.toPx() }
    var revealState by remember(teacherClass.id) { mutableStateOf(HomeClassRevealState.Center) }
    var dragDeltaPx by remember { mutableStateOf(0f) }
    val settledOffsetPx = when (revealState) {
        HomeClassRevealState.Center -> 0f
        HomeClassRevealState.History -> revealDistancePx
        HomeClassRevealState.Syllabus -> -revealDistancePx
    }
    val currentOffsetPx = (settledOffsetPx + dragDeltaPx).coerceIn(-revealDistancePx, revealDistancePx)
    val swipeOffsetPx by animateFloatAsState(
        targetValue = currentOffsetPx,
        animationSpec = spring(stiffness = 560f, dampingRatio = 0.88f),
        label = "homeClassCardSwipeOffset",
    )
    val revealProgress = (abs(swipeOffsetPx) / revealDistancePx).coerceIn(0f, 1f)
    val historyPanelProgress = when {
        swipeOffsetPx > 0f -> revealProgress
        revealState == HomeClassRevealState.History -> 1f
        else -> 0f
    }
    val syllabusPanelProgress = when {
        swipeOffsetPx < 0f -> revealProgress
        revealState == HomeClassRevealState.Syllabus -> 1f
        else -> 0f
    }
    val cardTranslationX = swipeOffsetPx
    val swipeRevealModifier = Modifier.pointerInput(teacherClass.id, isDragging, settledOffsetPx) {
        if (!isDragging) {
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false)
                val touchSlop = viewConfiguration.touchSlop
                var axisLock: GestureAxisLock? = null
                var totalDeltaX = 0f
                var totalDeltaY = 0f
                var gestureDragDeltaPx = 0f
                var gestureOffsetPx = settledOffsetPx
                var dragHandled = false
                var feedbackState = revealState

                while (true) {
                    val event = awaitPointerEvent()
                    val change = event.changes.firstOrNull { it.id == down.id } ?: break
                    if (!change.pressed) break

                    val delta = change.position - change.previousPosition
                    totalDeltaX += delta.x
                    totalDeltaY += delta.y

                    if (axisLock == null) {
                        val absX = abs(totalDeltaX)
                        val absY = abs(totalDeltaY)
                        if (absX > touchSlop || absY > touchSlop) {
                            axisLock = if (
                                absX >= touchSlop * HomeSwipeTouchSlopMultiplier &&
                                absX > absY * HomeSwipeHorizontalBias
                            ) {
                                GestureAxisLock.Horizontal
                            } else {
                                GestureAxisLock.Vertical
                            }
                        }
                    }

                    when (axisLock) {
                        GestureAxisLock.Horizontal -> {
                            change.consume()
                            gestureDragDeltaPx = if (dragHandled) {
                                gestureDragDeltaPx + delta.x
                            } else {
                                totalDeltaX
                            }
                            dragHandled = true
                            dragDeltaPx = gestureDragDeltaPx
                                .coerceIn(
                                    -revealDistancePx - settledOffsetPx,
                                    revealDistancePx - settledOffsetPx,
                                )
                            gestureOffsetPx = (settledOffsetPx + dragDeltaPx)
                                .coerceIn(-revealDistancePx, revealDistancePx)
                            val previewState = homeRevealStateForOffset(
                                offsetPx = gestureOffsetPx,
                                revealDistancePx = revealDistancePx,
                            )
                            if (previewState != feedbackState) {
                                if (previewState != HomeClassRevealState.Center) {
                                    haptics.selection()
                                }
                                feedbackState = previewState
                            }
                        }

                        GestureAxisLock.Vertical -> break
                        null -> Unit
                    }
                }

                if (dragHandled) {
                    val nextState = homeRevealStateForOffset(
                        offsetPx = gestureOffsetPx,
                        revealDistancePx = revealDistancePx,
                    )
                    if (nextState != revealState && nextState == HomeClassRevealState.Center) {
                        haptics.selection()
                    }
                    revealState = nextState
                    dragDeltaPx = 0f
                }
            }
        }
    }
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(76.dp)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxSize(),
            color = tone.surface,
            contentColor = tone.text,
            shape = cardShape,
            border = BorderStroke(0.95.dp, homeClassBorderColor()),
            shadowElevation = if (isDragging) 4.dp else 0.dp,
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(cardShape),
            ) {
                HomeClassActionPanel(
                    title = "History",
                    primary = "${historyPreview.entryCount}",
                    secondary = if (historyPreview.entryCount == 1) "entry" else "entries",
                    tertiary = if (historyPreview.entryCount > 0) {
                        historyPreview.latestTitle
                    } else {
                        "No past entries"
                    },
                    visible = revealState == HomeClassRevealState.History || swipeOffsetPx > 16f,
                    onClick = {
                        haptics.selection()
                        revealState = HomeClassRevealState.Center
                        dragDeltaPx = 0f
                        onHistoryClick()
                    },
                    modifier = Modifier
                        .align(Alignment.CenterStart)
                        .graphicsLayer {
                            alpha = historyPanelProgress
                            translationX = -panelSlideDistancePx * (1f - historyPanelProgress)
                        },
                )
                HomeClassActionPanel(
                    title = "Syllabus",
                    primary = if (syllabusPreview.available) "${syllabusPreview.percent}%" else "--",
                    secondary = if (syllabusPreview.available) {
                        "${syllabusPreview.completedChapters}/${syllabusPreview.totalChapters}"
                    } else {
                        "No plan"
                    },
                    tertiary = syllabusPreview.nextChapter?.let { "Next: $it" } ?: "Open coverage",
                    visible = revealState == HomeClassRevealState.Syllabus || swipeOffsetPx < -16f,
                    onClick = {
                        haptics.selection()
                        revealState = HomeClassRevealState.Center
                        dragDeltaPx = 0f
                        onSyllabusClick()
                    },
                    modifier = Modifier
                        .align(Alignment.CenterEnd)
                        .graphicsLayer {
                            alpha = syllabusPanelProgress
                            translationX = panelSlideDistancePx * (1f - syllabusPanelProgress)
                        },
                )
                Surface(
                    modifier = Modifier
                        .fillMaxSize()
                        .graphicsLayer {
                            translationX = cardTranslationX
                        }
                        .ledgrPressScale(
                            interactionSource = cardInteractionSource,
                            enabled = !isDragging,
                        )
                        .clickable(
                            interactionSource = cardInteractionSource,
                            indication = null,
                        ) {
                            if (revealState == HomeClassRevealState.Center) {
                                onClick()
                            } else {
                                haptics.selection()
                                revealState = HomeClassRevealState.Center
                                dragDeltaPx = 0f
                            }
                        },
                    color = tone.surface,
                    contentColor = tone.text,
                    shape = cardShape,
                ) {
                    Row(
                        modifier = Modifier.padding(start = 16.dp, top = 11.dp, end = 14.dp, bottom = 11.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxHeight()
                                .then(swipeRevealModifier),
                            contentAlignment = Alignment.CenterStart,
                        ) {
                            Column(
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
                        }
                        Row(
                            modifier = Modifier.width(70.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            DragHandleAffordance(modifier = reorderHandleModifier)
                            LoggedClassIndicator(
                                loggedToday = loggedToday,
                                modifier = Modifier.clickable {
                                    haptics.selection()
                                    revealState = HomeClassRevealState.Center
                                    dragDeltaPx = 0f
                                    onSyllabusClick()
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HomeClassActionPanel(
    title: String,
    primary: String,
    secondary: String,
    tertiary: String,
    visible: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier
            .width(96.dp)
            .fillMaxHeight()
            .clickable(enabled = visible, onClick = onClick),
        color = homeHeroPanelSurfaceColor(),
        contentColor = homeHeroTextColor(),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, homeHeroPanelBorderColor()),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.labelMedium.copy(
                    fontSize = 10.sp,
                    lineHeight = 12.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = homeHeroMutedColor(),
                ),
                maxLines = 1,
            )
            Text(
                text = primary,
                style = MaterialTheme.typography.titleLarge.copy(
                    fontSize = 17.sp,
                    lineHeight = 19.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = homeHeroTextColor(),
                ),
                maxLines = 1,
            )
            Text(
                text = secondary,
                style = MaterialTheme.typography.labelMedium.copy(
                    fontSize = 10.sp,
                    lineHeight = 12.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = homeHeroTextColor(),
                ),
                maxLines = 1,
            )
            Text(
                text = tertiary,
                style = MaterialTheme.typography.labelSmall.copy(
                    fontSize = 9.sp,
                    lineHeight = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = homeHeroMutedColor(),
                ),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
private fun DragHandleAffordance(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier.size(width = 28.dp, height = 28.dp),
            verticalArrangement = Arrangement.spacedBy(3.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            repeat(3) {
                Surface(
                    modifier = Modifier.size(width = 16.dp, height = 3.dp),
                    shape = RoundedCornerShape(999.dp),
                    color = homeDragHandleColor(),
                ) {}
            }
        }
    }
}

@Composable
private fun LoggedClassIndicator(
    loggedToday: Boolean,
    modifier: Modifier = Modifier,
) {
    val active = homeLoggedIndicatorColor()
    val inactive = if (LedgrTheme.isDark) {
        MaterialTheme.colorScheme.outlineVariant
    } else {
        colors.indicatorInactive
    }

    Box(
        modifier = modifier.size(28.dp),
        contentAlignment = Alignment.Center,
    ) {
        Surface(
            modifier = Modifier.size(25.dp),
            shape = CircleShape,
            color = if (loggedToday) active.copy(alpha = 0.14f) else Color.Transparent,
            border = BorderStroke(if (loggedToday) 1.8.dp else 1.4.dp, if (loggedToday) active else inactive),
        ) {}
        if (loggedToday) {
            Surface(
                modifier = Modifier.size(11.dp),
                shape = CircleShape,
                color = active,
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

private fun homeClassOrderPreferenceKey(storageKey: String?): String {
    val scopedKey = storageKey
        ?.takeIf(String::isNotBlank)
        ?.replace(Regex("[^A-Za-z0-9_.-]"), "_")
        ?: "default"
    return "class_order_$scopedKey"
}

private fun readHomeClassOrder(
    store: android.content.SharedPreferences,
    key: String,
): List<String> =
    store.getString(key, null)
        ?.split(HomeClassOrderDelimiter)
        ?.filter(String::isNotBlank)
        .orEmpty()

private fun buildHomeClassHistoryPreview(
    classEntries: List<TeacherEntry>,
): HomeClassHistoryPreview {
    var latestEntry: TeacherEntry? = null
    classEntries.forEach { entry ->
        val currentLatest = latestEntry
        if (
            currentLatest == null ||
            entry.dateKey > currentLatest.dateKey ||
            (entry.dateKey == currentLatest.dateKey && entry.createdAt > currentLatest.createdAt) ||
            (
                entry.dateKey == currentLatest.dateKey &&
                    entry.createdAt == currentLatest.createdAt &&
                    entry.timeStart.orEmpty() > currentLatest.timeStart.orEmpty()
                )
        ) {
            latestEntry = entry
        }
    }
    return HomeClassHistoryPreview(
        entryCount = classEntries.size,
        latestTitle = latestEntry?.title?.takeIf(String::isNotBlank) ?: "No past entries",
    )
}

private fun buildHomeClassSyllabusPreview(
    syllabus: PublishedSyllabus?,
    classEntries: List<TeacherEntry>,
): HomeClassSyllabusPreview {
    val resolvedSyllabus = syllabus ?: return HomeClassSyllabusPreview(
            available = false,
            percent = 0,
            completedChapters = 0,
            totalChapters = 0,
            nextChapter = null,
        )
    val relevantEntries = classEntries.filter {
        it.syllabusTemplateId == resolvedSyllabus.templateId &&
            it.syllabusVersion <= resolvedSyllabus.version
    }
    val completedUnitIds = completedSyllabusUnitIds(relevantEntries)
    val progress = resolvedSyllabus.progressForCompletedUnitIds(completedUnitIds)
    val nextChapter = resolvedSyllabus.chapters.firstOrNull { chapter ->
        val chapterCompleted = syllabusChapterCompletionMarker(chapter.id) in completedUnitIds ||
            (chapter.topics.isNotEmpty() && chapter.topics.all { it.id in completedUnitIds })
        !chapterCompleted
    }?.title
    return HomeClassSyllabusPreview(
        available = true,
        percent = progress.percent,
        completedChapters = progress.completedChapters,
        totalChapters = progress.totalChapters,
        nextChapter = nextChapter,
    )
}

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

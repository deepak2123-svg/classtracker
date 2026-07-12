package com.ledgr.timetable.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.ledgr.timetable.data.Institute
import com.ledgr.timetable.data.Section
import com.ledgr.timetable.data.TIME_SLOT_TYPE_BREAK
import com.ledgr.timetable.data.TIME_SLOT_TYPE_CLASS
import com.ledgr.timetable.data.Teacher
import com.ledgr.timetable.domain.AssignmentConflict
import com.ledgr.timetable.domain.AssignmentConflictType
import com.ledgr.timetable.domain.AvailabilityWarning
import com.ledgr.timetable.domain.DraftAssignment
import com.ledgr.timetable.domain.DraftTeacherUnavailability
import com.ledgr.timetable.domain.DraftTimeSlot
import com.ledgr.timetable.ui.theme.TimetableTheme
import kotlin.math.roundToInt

@Composable
fun TimetableApp() {
    val context = LocalContext.current
    val viewModel = viewModel<TimetableViewModel>(
        factory = TimetableViewModel.factory(context),
    )
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    TimetableTheme {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.surface,
        ) {
            val navController = rememberNavController()
            TimetableNavHost(
                navController = navController,
                uiState = uiState,
                viewModel = viewModel,
            )
        }
    }
}

@Composable
private fun TimetableNavHost(
    navController: NavHostController,
    uiState: TimetableUiState,
    viewModel: TimetableViewModel,
) {
    NavHost(
        navController = navController,
        startDestination = TimetableRoute.Home.route,
    ) {
        composable(TimetableRoute.Home.route) {
            HomeScreen(
                uiState = uiState,
                onCreateInstitute = viewModel::createInstitute,
                onOpenInstitute = { institute ->
                    viewModel.selectInstitute(institute.id)
                    navController.navigate(TimetableRoute.WizardTimeSlots.route)
                },
                onOpenRoster = { institute ->
                    viewModel.selectInstitute(institute.id)
                    navController.navigate(TimetableRoute.Roster.route)
                },
            )
        }
        composable(TimetableRoute.Roster.route) {
            InstituteRosterSettingsScreen(
                uiState = uiState,
                onCreateTeacher = viewModel::createTeacher,
                onRenameTeacher = viewModel::renameTeacher,
                onDeleteTeacher = viewModel::deleteTeacher,
                onCreateSection = viewModel::createSection,
                onRenameSection = viewModel::renameSection,
                onDeleteSection = viewModel::deleteSection,
                onBackHome = { navController.navigateHome() },
                onContinue = { navController.navigate(TimetableRoute.WizardTimeSlots.route) },
            )
        }
        composable(TimetableRoute.WizardTimeSlots.route) {
            WizardTimeSlotsScreen(
                uiState = uiState,
                onStartDraft = viewModel::startTimeSlotDraft,
                onAddTimeSlot = viewModel::addTimeSlot,
                onUpdateTimeSlot = viewModel::updateTimeSlot,
                onMoveTimeSlot = viewModel::moveTimeSlot,
                onDeleteTimeSlot = viewModel::deleteTimeSlot,
                navController = navController,
            )
        }
        composable(TimetableRoute.WizardAssign.route) {
            WizardAssignScreen(
                uiState = uiState,
                onStartDraft = viewModel::startTimeSlotDraft,
                onAssignTeacher = viewModel::assignTeacherToSubjectSlot,
                onClearAssignment = viewModel::clearAssignment,
                navController = navController,
            )
        }
        composable(TimetableRoute.WizardAvailability.route) {
            WizardAvailabilityScreen(
                uiState = uiState,
                onStartDraft = viewModel::startTimeSlotDraft,
                onToggleTeacherUnavailability = viewModel::toggleTeacherUnavailability,
                navController = navController,
            )
        }
        composable(TimetableRoute.WizardReviewSave.route) {
            WizardReviewSaveScreen(uiState = uiState, navController = navController)
        }
        composable(TimetableRoute.TimetableView.route) {
            TimetableViewScreen(uiState = uiState, navController = navController)
        }
        composable(TimetableRoute.History.route) {
            HistoryScreen(uiState = uiState, navController = navController)
        }
    }
}

@Composable
private fun HomeScreen(
    uiState: TimetableUiState,
    onCreateInstitute: (String) -> Unit,
    onOpenInstitute: (Institute) -> Unit,
    onOpenRoster: (Institute) -> Unit,
) {
    var instituteName by rememberSaveable { mutableStateOf("") }

    AppScaffold(
        title = "Ledgr",
        subtitle = "Your institutes",
    ) {
        AddNameRow(
            value = instituteName,
            onValueChange = { instituteName = it },
            label = "Institute name",
            actionLabel = "+ Create",
            onSubmit = {
                onCreateInstitute(instituteName)
                instituteName = ""
            },
        )
        if (uiState.institutes.isEmpty()) {
            EmptyStateCard(
                title = "No institutes yet",
                body = "Create the first institute to begin.",
            )
        } else {
            uiState.institutes.forEach { institute ->
                key(institute.id) {
                    InstituteRow(
                        institute = institute,
                        onOpenInstitute = { onOpenInstitute(institute) },
                        onOpenRoster = { onOpenRoster(institute) },
                    )
                }
            }
        }
    }
}

@Composable
private fun InstituteRosterSettingsScreen(
    uiState: TimetableUiState,
    onCreateTeacher: (String) -> Unit,
    onRenameTeacher: (Teacher, String) -> Unit,
    onDeleteTeacher: (Teacher) -> Unit,
    onCreateSection: (String) -> Unit,
    onRenameSection: (Section, String) -> Unit,
    onDeleteSection: (Section) -> Unit,
    onBackHome: () -> Unit,
    onContinue: () -> Unit,
) {
    val institute = uiState.selectedInstitute

    if (institute == null) {
        AppScaffold(
            title = "Roster settings",
            subtitle = "Choose an institute first",
        ) {
            EmptyStateCard(
                title = "No institute selected",
                body = "Open roster settings from an institute row.",
            )
            ActionButton(
                label = "Back to home",
                onClick = onBackHome,
                style = ActionStyle.Primary,
            )
        }
        return
    }

    AppScaffold(
        title = institute.name,
        subtitle = "Roster settings",
    ) {
        TeacherRosterSection(
            teachers = uiState.teachers,
            onCreateTeacher = onCreateTeacher,
            onRenameTeacher = onRenameTeacher,
            onDeleteTeacher = onDeleteTeacher,
        )
        SectionRosterSection(
            sections = uiState.sections,
            onCreateSection = onCreateSection,
            onRenameSection = onRenameSection,
            onDeleteSection = onDeleteSection,
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            ActionButton(
                label = "Home",
                onClick = onBackHome,
                style = ActionStyle.Outlined,
                modifier = Modifier.weight(1f),
            )
            ActionButton(
                label = "Build",
                onClick = onContinue,
                style = ActionStyle.Primary,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun TeacherRosterSection(
    teachers: List<Teacher>,
    onCreateTeacher: (String) -> Unit,
    onRenameTeacher: (Teacher, String) -> Unit,
    onDeleteTeacher: (Teacher) -> Unit,
) {
    var teacherName by rememberSaveable { mutableStateOf("") }

    RosterSectionShell(title = "Teachers") {
        AddNameRow(
            value = teacherName,
            onValueChange = { teacherName = it },
            label = "Teacher name",
            actionLabel = "+ Add",
            onSubmit = {
                onCreateTeacher(teacherName)
                teacherName = ""
            },
        )
        if (teachers.isEmpty()) {
            EmptyStateCard(
                title = "No teachers yet",
                body = "Add teachers for this institute.",
            )
        } else {
            teachers.forEach { teacher ->
                key(teacher.id) {
                    EditableNameRow(
                        name = teacher.name,
                        meta = "Teacher",
                        onRename = { onRenameTeacher(teacher, it) },
                        onDelete = { onDeleteTeacher(teacher) },
                    )
                }
            }
        }
    }
}

@Composable
private fun SectionRosterSection(
    sections: List<Section>,
    onCreateSection: (String) -> Unit,
    onRenameSection: (Section, String) -> Unit,
    onDeleteSection: (Section) -> Unit,
) {
    var sectionName by rememberSaveable { mutableStateOf("") }

    RosterSectionShell(title = "Sections") {
        AddNameRow(
            value = sectionName,
            onValueChange = { sectionName = it },
            label = "Section name",
            actionLabel = "+ Add",
            onSubmit = {
                onCreateSection(sectionName)
                sectionName = ""
            },
        )
        if (sections.isEmpty()) {
            EmptyStateCard(
                title = "No sections yet",
                body = "Add sections for this institute.",
            )
        } else {
            sections.forEach { section ->
                key(section.id) {
                    EditableNameRow(
                        name = section.name,
                        meta = "Section",
                        onRename = { onRenameSection(section, it) },
                        onDelete = { onDeleteSection(section) },
                    )
                }
            }
        }
    }
}

@Composable
private fun WizardTimeSlotsScreen(
    uiState: TimetableUiState,
    onStartDraft: () -> Unit,
    onAddTimeSlot: (String, String, String) -> Unit,
    onUpdateTimeSlot: (DraftTimeSlot, String, String, String) -> Unit,
    onMoveTimeSlot: (Int, Int) -> Unit,
    onDeleteTimeSlot: (DraftTimeSlot) -> Unit,
    navController: NavHostController,
) {
    LaunchedEffect(uiState.selectedInstitute?.id) {
        onStartDraft()
    }

    AppScaffold(
        title = "Time slots",
        subtitle = selectedInstituteLabel(uiState),
        progressStep = 1,
    ) {
        TimeSlotEditorPanel(onAddTimeSlot = onAddTimeSlot)
        if (uiState.draftTimeSlots.isEmpty()) {
            EmptyStateCard(
                title = "No time slots yet",
                body = "Add the first period for this timetable.",
            )
        } else {
            uiState.draftTimeSlots.forEachIndexed { index, slot ->
                key(slot.id) {
                    DraftTimeSlotRow(
                        slot = slot,
                        index = index,
                        isFirst = index == 0,
                        isLast = index == uiState.draftTimeSlots.lastIndex,
                        onUpdateTimeSlot = onUpdateTimeSlot,
                        onMoveUp = { onMoveTimeSlot(index, index - 1) },
                        onMoveDown = { onMoveTimeSlot(index, index + 1) },
                        onDeleteTimeSlot = { onDeleteTimeSlot(slot) },
                    )
                }
            }
        }
        ActionButton(
            label = "Next: Assign",
            onClick = {
                navController.navigate(TimetableRoute.WizardAssign.route)
            },
            style = ActionStyle.Primary,
        )
        ActionButton(
            label = "Back to home",
            onClick = {
                navController.navigateHome()
            },
            style = ActionStyle.Outlined,
        )
    }
}

@Composable
private fun TimeSlotEditorPanel(
    onAddTimeSlot: (String, String, String) -> Unit,
) {
    var startTime by rememberSaveable { mutableStateOf("") }
    var endTime by rememberSaveable { mutableStateOf("") }
    var type by rememberSaveable { mutableStateOf(TIME_SLOT_TYPE_CLASS) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 15.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = "Add period",
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurface,
            )
            TimeFields(
                startTime = startTime,
                endTime = endTime,
                onStartTimeChange = { startTime = it },
                onEndTimeChange = { endTime = it },
            )
            TimeSlotTypeChooser(
                selectedType = type,
                onSelectedTypeChange = { type = it },
            )
            ActionButton(
                label = "+ Add time slot",
                onClick = {
                    onAddTimeSlot(startTime, endTime, type)
                    startTime = ""
                    endTime = ""
                    type = TIME_SLOT_TYPE_CLASS
                },
                style = ActionStyle.Primary,
            )
        }
    }
}

@Composable
private fun DraftTimeSlotRow(
    slot: DraftTimeSlot,
    index: Int,
    isFirst: Boolean,
    isLast: Boolean,
    onUpdateTimeSlot: (DraftTimeSlot, String, String, String) -> Unit,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    onDeleteTimeSlot: () -> Unit,
) {
    var isEditing by rememberSaveable { mutableStateOf(false) }
    var startTime by rememberSaveable { mutableStateOf(slot.startTime) }
    var endTime by rememberSaveable { mutableStateOf(slot.endTime) }
    var type by rememberSaveable { mutableStateOf(slot.type) }

    LaunchedEffect(slot, isEditing) {
        if (!isEditing) {
            startTime = slot.startTime
            endTime = slot.endTime
            type = slot.type
        }
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 15.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (isEditing) {
                TimeFields(
                    startTime = startTime,
                    endTime = endTime,
                    onStartTimeChange = { startTime = it },
                    onEndTimeChange = { endTime = it },
                )
                TimeSlotTypeChooser(
                    selectedType = type,
                    onSelectedTypeChange = { type = it },
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    ActionButton(
                        label = "Cancel",
                        onClick = {
                            startTime = slot.startTime
                            endTime = slot.endTime
                            type = slot.type
                            isEditing = false
                        },
                        style = ActionStyle.Outlined,
                        modifier = Modifier.weight(1f),
                    )
                    ActionButton(
                        label = "Save",
                        onClick = {
                            onUpdateTimeSlot(slot, startTime, endTime, type)
                            isEditing = false
                        },
                        style = ActionStyle.Primary,
                        modifier = Modifier.weight(1f),
                    )
                }
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(11.dp),
                ) {
                    Surface(
                        modifier = Modifier.weight(1f),
                        shape = CircleShape,
                        color = if (slot.type == TIME_SLOT_TYPE_CLASS) {
                            MaterialTheme.colorScheme.primaryContainer
                        } else {
                            MaterialTheme.colorScheme.surfaceContainerHighest
                        },
                        contentColor = if (slot.type == TIME_SLOT_TYPE_CLASS) {
                            MaterialTheme.colorScheme.onPrimaryContainer
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                    ) {
                        Text(
                            text = "${slot.startTime} - ${slot.endTime}",
                            modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp),
                            style = MaterialTheme.typography.labelMedium,
                        )
                    }
                    Text(
                        text = if (slot.type == TIME_SLOT_TYPE_CLASS) "Class" else "Break",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        text = "#${index + 1}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.outline,
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    ActionButton(
                        label = "Edit",
                        onClick = { isEditing = true },
                        style = ActionStyle.Tonal,
                        modifier = Modifier.weight(1f),
                    )
                    ActionButton(
                        label = "Up",
                        onClick = onMoveUp,
                        style = if (isFirst) ActionStyle.Outlined else ActionStyle.Tonal,
                        modifier = Modifier.weight(1f),
                    )
                    ActionButton(
                        label = "Down",
                        onClick = onMoveDown,
                        style = if (isLast) ActionStyle.Outlined else ActionStyle.Tonal,
                        modifier = Modifier.weight(1f),
                    )
                }
                ActionButton(
                    label = "Remove",
                    onClick = onDeleteTimeSlot,
                    style = ActionStyle.Danger,
                )
            }
        }
    }
}

@Composable
private fun TimeFields(
    startTime: String,
    endTime: String,
    onStartTimeChange: (String) -> Unit,
    onEndTimeChange: (String) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        OutlinedTextField(
            value = startTime,
            onValueChange = onStartTimeChange,
            modifier = Modifier.weight(1f),
            label = { Text("Start") },
            singleLine = true,
            shape = MaterialTheme.shapes.medium,
        )
        OutlinedTextField(
            value = endTime,
            onValueChange = onEndTimeChange,
            modifier = Modifier.weight(1f),
            label = { Text("End") },
            singleLine = true,
            shape = MaterialTheme.shapes.medium,
        )
    }
}

@Composable
private fun TimeSlotTypeChooser(
    selectedType: String,
    onSelectedTypeChange: (String) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        ActionButton(
            label = "Class",
            onClick = { onSelectedTypeChange(TIME_SLOT_TYPE_CLASS) },
            style = if (selectedType == TIME_SLOT_TYPE_CLASS) ActionStyle.Primary else ActionStyle.Outlined,
            modifier = Modifier.weight(1f),
        )
        ActionButton(
            label = "Break",
            onClick = { onSelectedTypeChange(TIME_SLOT_TYPE_BREAK) },
            style = if (selectedType == TIME_SLOT_TYPE_BREAK) ActionStyle.Primary else ActionStyle.Outlined,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun WizardAssignScreen(
    uiState: TimetableUiState,
    onStartDraft: () -> Unit,
    onAssignTeacher: (String, String, String, String) -> Unit,
    onClearAssignment: (DraftAssignment) -> Unit,
    navController: NavHostController,
) {
    LaunchedEffect(uiState.selectedInstitute?.id) {
        onStartDraft()
    }

    val targetBounds = remember { mutableStateMapOf<AssignTargetKey, Rect>() }
    var draggingTeacher by remember { mutableStateOf<DraggingTeacher?>(null) }
    val classSlots = uiState.draftTimeSlots.filter { it.type == TIME_SLOT_TYPE_CLASS }
    val conflictAssignmentIds = remember(uiState.assignmentConflicts) {
        uiState.assignmentConflicts.flatMap { it.assignmentIds }.toSet()
    }
    val unavailableAssignmentIds = remember(uiState.availabilityWarnings) {
        uiState.availabilityWarnings.map { it.assignmentId }.toSet()
    }

    Box(modifier = Modifier.fillMaxSize()) {
        AppScaffold(
            title = "Assign",
            subtitle = selectedInstituteLabel(uiState),
            progressStep = 2,
        ) {
            DndHintCard()
            TeacherPoolCard(
                teachers = uiState.teachers,
                draggingTeacher = draggingTeacher,
                onDragStart = { teacher, position ->
                    draggingTeacher = DraggingTeacher(teacher = teacher, position = position)
                },
                onDrag = { delta ->
                    draggingTeacher = draggingTeacher?.copy(
                        position = draggingTeacher!!.position + delta,
                    )
                },
                onDragEnd = {
                    val draggedTeacher = draggingTeacher
                    val target = draggedTeacher?.let { drag ->
                        targetBounds.entries.firstOrNull { (_, bounds) ->
                            bounds.contains(drag.position)
                        }?.key
                    }
                    if (draggedTeacher != null && target != null) {
                        onAssignTeacher(
                            target.slotId,
                            target.sectionId,
                            target.subjectName,
                            draggedTeacher.teacher.id,
                        )
                    }
                    draggingTeacher = null
                },
                onDragCancel = { draggingTeacher = null },
            )
            AssignmentConflictSummary(
                conflicts = uiState.assignmentConflicts,
                teachers = uiState.teachers,
                sections = uiState.sections,
                slots = classSlots,
            )
            when {
                uiState.teachers.isEmpty() -> EmptyStateCard(
                    title = "No teachers yet",
                    body = "Add teachers in roster settings before assigning.",
                )
                uiState.sections.isEmpty() -> EmptyStateCard(
                    title = "No sections yet",
                    body = "Add sections in roster settings before assigning.",
                )
                classSlots.isEmpty() -> EmptyStateCard(
                    title = "No class periods yet",
                    body = "Add at least one class time slot before assigning teachers.",
                )
                else -> classSlots.forEach { slot ->
                    TimeSlotAssignmentGroup(
                        slot = slot,
                        sections = uiState.sections,
                        teachers = uiState.teachers,
                        assignments = uiState.draftAssignments,
                        conflictAssignmentIds = conflictAssignmentIds,
                        unavailableAssignmentIds = unavailableAssignmentIds,
                        onTargetBoundsChanged = { key, bounds ->
                            targetBounds[key] = bounds
                        },
                        onClearAssignment = onClearAssignment,
                    )
                }
            }
            ActionButton(
                label = "Next: Availability",
                onClick = {
                navController.navigate(TimetableRoute.WizardAvailability.route)
            },
                style = ActionStyle.Primary,
            )
            ActionButton(
                label = "Back to home",
                onClick = {
                navController.navigateHome()
            },
                style = ActionStyle.Outlined,
            )
        }
        draggingTeacher?.let { drag ->
            DragGhost(
                teacher = drag.teacher,
                position = drag.position,
                modifier = Modifier.zIndex(1f),
            )
        }
    }
}

@Composable
private fun DndHintCard() {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.primaryContainer,
        contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
    ) {
        Text(
            text = "Drag a teacher onto a subject slot to assign. Conflicts are flagged, not blocked.",
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 10.dp),
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
private fun TeacherPoolCard(
    teachers: List<Teacher>,
    draggingTeacher: DraggingTeacher?,
    onDragStart: (Teacher, Offset) -> Unit,
    onDrag: (Offset) -> Unit,
    onDragEnd: () -> Unit,
    onDragCancel: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHighest,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 15.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = "Teacher pool",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (teachers.isEmpty()) {
                Text(
                    text = "No teachers available.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    teachers.forEach { teacher ->
                        DraggableTeacherChip(
                            teacher = teacher,
                            isDragging = draggingTeacher?.teacher?.id == teacher.id,
                            onDragStart = onDragStart,
                            onDrag = onDrag,
                            onDragEnd = onDragEnd,
                            onDragCancel = onDragCancel,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun DraggableTeacherChip(
    teacher: Teacher,
    isDragging: Boolean,
    onDragStart: (Teacher, Offset) -> Unit,
    onDrag: (Offset) -> Unit,
    onDragEnd: () -> Unit,
    onDragCancel: () -> Unit,
) {
    var bounds by remember { mutableStateOf(Rect.Zero) }

    Surface(
        modifier = Modifier
            .onGloballyPositioned { coordinates ->
                bounds = coordinates.boundsInRoot()
            }
            .pointerInput(teacher.id) {
                detectDragGestures(
                    onDragStart = { localOffset ->
                        onDragStart(teacher, bounds.topLeft + localOffset)
                    },
                    onDrag = { change, dragAmount ->
                        change.consume()
                        onDrag(dragAmount)
                    },
                    onDragEnd = onDragEnd,
                    onDragCancel = onDragCancel,
                )
            },
        shape = CircleShape,
        color = if (isDragging) {
            MaterialTheme.colorScheme.surfaceContainerHighest
        } else {
            MaterialTheme.colorScheme.secondaryContainer
        },
        contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
    ) {
        Text(
            text = ":: ${teacher.name}",
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp),
            style = MaterialTheme.typography.labelMedium,
        )
    }
}

@Composable
private fun DragGhost(
    teacher: Teacher,
    position: Offset,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier
            .offset {
                IntOffset(
                    x = (position.x - 90f).roundToInt(),
                    y = (position.y - 34f).roundToInt(),
                )
            },
        shape = CircleShape,
        color = MaterialTheme.colorScheme.secondaryContainer,
        contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
        shadowElevation = 8.dp,
    ) {
        Text(
            text = ":: ${teacher.name}",
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp),
            style = MaterialTheme.typography.labelMedium,
        )
    }
}

@Composable
private fun AssignmentConflictSummary(
    conflicts: List<AssignmentConflict>,
    teachers: List<Teacher>,
    sections: List<Section>,
    slots: List<DraftTimeSlot>,
) {
    if (conflicts.isEmpty()) return

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.errorContainer,
        contentColor = MaterialTheme.colorScheme.onErrorContainer,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = "Conflict flagged",
                style = MaterialTheme.typography.titleSmall,
            )
            conflicts.forEach { conflict ->
                Text(
                    text = conflictLabel(conflict, teachers, sections, slots),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

@Composable
private fun TimeSlotAssignmentGroup(
    slot: DraftTimeSlot,
    sections: List<Section>,
    teachers: List<Teacher>,
    assignments: List<DraftAssignment>,
    conflictAssignmentIds: Set<String>,
    unavailableAssignmentIds: Set<String>,
    onTargetBoundsChanged: (AssignTargetKey, Rect) -> Unit,
    onClearAssignment: (DraftAssignment) -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = "${slot.startTime} - ${slot.endTime}",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        sections.forEach { section ->
            SectionAssignmentCard(
                slot = slot,
                section = section,
                teachers = teachers,
                assignments = assignments,
                conflictAssignmentIds = conflictAssignmentIds,
                unavailableAssignmentIds = unavailableAssignmentIds,
                onTargetBoundsChanged = onTargetBoundsChanged,
                onClearAssignment = onClearAssignment,
            )
        }
    }
}

@Composable
private fun SectionAssignmentCard(
    slot: DraftTimeSlot,
    section: Section,
    teachers: List<Teacher>,
    assignments: List<DraftAssignment>,
    conflictAssignmentIds: Set<String>,
    unavailableAssignmentIds: Set<String>,
    onTargetBoundsChanged: (AssignTargetKey, Rect) -> Unit,
    onClearAssignment: (DraftAssignment) -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 15.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                text = section.name,
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurface,
            )
            DefaultAssignSubjects.forEach { subject ->
                val target = AssignTargetKey(
                    slotId = slot.id,
                    sectionId = section.id,
                    subjectName = subject,
                )
                val assignment = assignments.firstOrNull { item ->
                    item.slotId == slot.id &&
                        item.sectionId == section.id &&
                        item.subjectName == subject
                }
                val assignedTeacher = assignment?.let { assigned ->
                    teachers.firstOrNull { teacher -> teacher.id == assigned.teacherId }
                }
                SubjectDropSlot(
                    target = target,
                    subject = subject,
                    assignment = assignment,
                    assignedTeacher = assignedTeacher,
                    isConflict = assignment?.id in conflictAssignmentIds,
                    isAvailabilityWarning = assignment?.id in unavailableAssignmentIds,
                    onTargetBoundsChanged = onTargetBoundsChanged,
                    onClearAssignment = onClearAssignment,
                )
            }
        }
    }
}

@Composable
private fun SubjectDropSlot(
    target: AssignTargetKey,
    subject: String,
    assignment: DraftAssignment?,
    assignedTeacher: Teacher?,
    isConflict: Boolean,
    isAvailabilityWarning: Boolean,
    onTargetBoundsChanged: (AssignTargetKey, Rect) -> Unit,
    onClearAssignment: (DraftAssignment) -> Unit,
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .onGloballyPositioned { coordinates ->
                onTargetBoundsChanged(target, coordinates.boundsInRoot())
            },
        shape = MaterialTheme.shapes.medium,
        color = when {
            isConflict -> MaterialTheme.colorScheme.errorContainer
            isAvailabilityWarning -> MaterialTheme.colorScheme.errorContainer
            assignment != null -> MaterialTheme.colorScheme.surface
            else -> Color.Transparent
        },
        contentColor = if (isConflict || isAvailabilityWarning) {
            MaterialTheme.colorScheme.onErrorContainer
        } else {
            MaterialTheme.colorScheme.onSurface
        },
        border = BorderStroke(
            width = 1.5.dp,
            color = when {
                isConflict -> MaterialTheme.colorScheme.error
                isAvailabilityWarning -> MaterialTheme.colorScheme.error
                assignment != null -> Color.Transparent
                else -> MaterialTheme.colorScheme.outlineVariant
            },
        ),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = subject,
                    style = MaterialTheme.typography.labelMedium,
                )
                Text(
                    text = if (assignedTeacher == null) {
                        "Drop teacher here"
                    } else if (isConflict) {
                        "Conflict: ${assignedTeacher.name}"
                    } else if (isAvailabilityWarning) {
                        "Unavailable: ${assignedTeacher.name}"
                    } else {
                        assignedTeacher.name
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = if (isConflict || isAvailabilityWarning) {
                        MaterialTheme.colorScheme.onErrorContainer
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                )
            }
            if (assignment != null) {
                ActionButton(
                    label = "Clear",
                    onClick = { onClearAssignment(assignment) },
                    style = if (isConflict || isAvailabilityWarning) {
                        ActionStyle.Danger
                    } else {
                        ActionStyle.Outlined
                    },
                    modifier = Modifier.width(96.dp),
                )
            }
        }
    }
}

@Composable
private fun WizardAvailabilityScreen(
    uiState: TimetableUiState,
    onStartDraft: () -> Unit,
    onToggleTeacherUnavailability: (String, String) -> Unit,
    navController: NavHostController,
) {
    LaunchedEffect(uiState.selectedInstitute?.id) {
        onStartDraft()
    }

    val classSlots = uiState.draftTimeSlots.filter { it.type == TIME_SLOT_TYPE_CLASS }

    AppScaffold(
        title = "Availability",
        progressStep = 3,
        subtitle = selectedInstituteLabel(uiState),
    ) {
        Text(
            text = "Mark teacher unavailability",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = "Optional - leave blank if everyone is free for every class period.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        AvailabilityWarningSummary(
            warnings = uiState.availabilityWarnings,
            teachers = uiState.teachers,
            sections = uiState.sections,
            slots = classSlots,
        )
        when {
            uiState.teachers.isEmpty() -> EmptyStateCard(
                title = "No teachers yet",
                body = "Add teachers in roster settings before marking availability.",
            )
            classSlots.isEmpty() -> EmptyStateCard(
                title = "No class periods yet",
                body = "Add at least one class time slot before marking availability.",
            )
            else -> uiState.teachers.forEach { teacher ->
                key(teacher.id) {
                    TeacherAvailabilityCard(
                        teacher = teacher,
                        slots = classSlots,
                        unavailability = uiState.draftTeacherUnavailability,
                        warnings = uiState.availabilityWarnings,
                        onToggleSlot = { slotId ->
                            onToggleTeacherUnavailability(teacher.id, slotId)
                        },
                    )
                }
            }
        }
        ActionButton(
            label = "Next: Review",
            onClick = {
                navController.navigate(TimetableRoute.WizardReviewSave.route)
            },
            style = ActionStyle.Primary,
        )
        ActionButton(
            label = "Back to home",
            onClick = {
                navController.navigateHome()
            },
            style = ActionStyle.Outlined,
        )
    }
}

@Composable
private fun AvailabilityWarningSummary(
    warnings: List<AvailabilityWarning>,
    teachers: List<Teacher>,
    sections: List<Section>,
    slots: List<DraftTimeSlot>,
) {
    if (warnings.isEmpty()) return

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.medium,
        color = MaterialTheme.colorScheme.errorContainer,
        contentColor = MaterialTheme.colorScheme.onErrorContainer,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Text(
                text = "Unavailable assignment",
                style = MaterialTheme.typography.titleSmall,
            )
            warnings.forEach { warning ->
                Text(
                    text = availabilityWarningLabel(warning, teachers, sections, slots),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
}

@Composable
private fun TeacherAvailabilityCard(
    teacher: Teacher,
    slots: List<DraftTimeSlot>,
    unavailability: List<DraftTeacherUnavailability>,
    warnings: List<AvailabilityWarning>,
    onToggleSlot: (String) -> Unit,
) {
    val blockedSlotIds = unavailability
        .filter { mark -> mark.teacherId == teacher.id }
        .map { mark -> mark.slotId }
        .toSet()
    val warningSlotIds = warnings
        .filter { warning -> warning.teacherId == teacher.id }
        .map { warning -> warning.slotId }
        .toSet()

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 15.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text = teacher.name,
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                AvailabilityBadge(
                    label = if (blockedSlotIds.isEmpty()) {
                        "All free"
                    } else {
                        "${blockedSlotIds.size} blocked"
                    },
                    isBlocked = blockedSlotIds.isNotEmpty(),
                )
            }
            slots.forEach { slot ->
                val isUnavailable = slot.id in blockedSlotIds
                AvailabilitySlotToggle(
                    slot = slot,
                    isUnavailable = isUnavailable,
                    hasWarning = slot.id in warningSlotIds,
                    onToggle = { onToggleSlot(slot.id) },
                )
            }
        }
    }
}

@Composable
private fun AvailabilityBadge(
    label: String,
    isBlocked: Boolean,
) {
    Surface(
        shape = CircleShape,
        color = if (isBlocked) {
            MaterialTheme.colorScheme.tertiaryContainer
        } else {
            MaterialTheme.colorScheme.secondaryContainer
        },
        contentColor = if (isBlocked) {
            MaterialTheme.colorScheme.onTertiaryContainer
        } else {
            MaterialTheme.colorScheme.onSecondaryContainer
        },
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 11.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
        )
    }
}

@Composable
private fun AvailabilitySlotToggle(
    slot: DraftTimeSlot,
    isUnavailable: Boolean,
    hasWarning: Boolean,
    onToggle: () -> Unit,
) {
    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggle),
        shape = MaterialTheme.shapes.medium,
        color = when {
            hasWarning -> MaterialTheme.colorScheme.errorContainer
            isUnavailable -> MaterialTheme.colorScheme.tertiaryContainer
            else -> MaterialTheme.colorScheme.surface
        },
        contentColor = when {
            hasWarning -> MaterialTheme.colorScheme.onErrorContainer
            isUnavailable -> MaterialTheme.colorScheme.onTertiaryContainer
            else -> MaterialTheme.colorScheme.onSurface
        },
        border = BorderStroke(
            width = 1.5.dp,
            color = when {
                hasWarning -> MaterialTheme.colorScheme.error
                isUnavailable -> MaterialTheme.colorScheme.tertiary
                else -> MaterialTheme.colorScheme.outlineVariant
            },
        ),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                text = slotLabel(slot),
                style = MaterialTheme.typography.labelMedium,
            )
            Text(
                text = when {
                    hasWarning -> "Unavailable - assigned"
                    isUnavailable -> "Unavailable"
                    else -> "Available"
                },
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun WizardReviewSaveScreen(
    uiState: TimetableUiState,
    navController: NavHostController,
) {
    PlaceholderScreen(
        title = "Review and save",
        description = selectedInstituteLabel(uiState),
        progressStep = 4,
        primaryActions = listOf(
            PlaceholderAction("Open timetable view") {
                navController.navigate(TimetableRoute.TimetableView.route)
            },
        ),
        secondaryActions = listOf(
            PlaceholderAction("Back to home") {
                navController.navigateHome()
            },
        ),
    )
}

@Composable
private fun TimetableViewScreen(
    uiState: TimetableUiState,
    navController: NavHostController,
) {
    PlaceholderScreen(
        title = "Timetable view",
        description = selectedInstituteLabel(uiState),
        primaryActions = listOf(
            PlaceholderAction("Open roster settings") {
                navController.navigate(TimetableRoute.Roster.route)
            },
            PlaceholderAction("Open history") {
                navController.navigate(TimetableRoute.History.route)
            },
        ),
        secondaryActions = listOf(
            PlaceholderAction("Back to home") {
                navController.navigateHome()
            },
        ),
    )
}

@Composable
private fun HistoryScreen(
    uiState: TimetableUiState,
    navController: NavHostController,
) {
    PlaceholderScreen(
        title = "History",
        description = selectedInstituteLabel(uiState),
        primaryActions = listOf(
            PlaceholderAction("View timetable") {
                navController.navigate(TimetableRoute.TimetableView.route)
            },
            PlaceholderAction("Duplicate as new") {
                navController.navigate(TimetableRoute.WizardAssign.route)
            },
        ),
        secondaryActions = listOf(
            PlaceholderAction("Back to home") {
                navController.navigateHome()
            },
        ),
    )
}

@Composable
private fun AppScaffold(
    title: String,
    subtitle: String,
    progressStep: Int? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
            .safeDrawingPadding(),
    ) {
        AppHeader(title = title, description = subtitle)
        progressStep?.let { WizardProgress(step = it, totalSteps = 4) }
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            content = content,
        )
    }
}

@Composable
private fun PlaceholderScreen(
    title: String,
    description: String,
    primaryActions: List<PlaceholderAction>,
    secondaryActions: List<PlaceholderAction> = emptyList(),
    progressStep: Int? = null,
) {
    AppScaffold(
        title = title,
        subtitle = description,
        progressStep = progressStep,
    ) {
        ScreenSampleCard()
        PeriodSampleRow()
        ChipSampleRow()
        primaryActions.forEachIndexed { index, action ->
            ActionButton(
                label = action.label,
                onClick = action.onClick,
                style = if (index == 0) ActionStyle.Primary else ActionStyle.Tonal,
            )
        }
        secondaryActions.forEach { action ->
            ActionButton(
                label = action.label,
                onClick = action.onClick,
                style = ActionStyle.Outlined,
            )
        }
    }
}

@Composable
private fun AppHeader(
    title: String,
    description: String,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 18.dp, top = 14.dp, end = 18.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Surface(
            modifier = Modifier.size(34.dp),
            shape = CircleShape,
            color = MaterialTheme.colorScheme.surfaceContainer,
            contentColor = MaterialTheme.colorScheme.onSurface,
        ) {
            Box(contentAlignment = Alignment.Center) {
                Text(
                    text = "L",
                    style = MaterialTheme.typography.labelLarge,
                )
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun AddNameRow(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    actionLabel: String,
    onSubmit: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.weight(1f),
            label = { Text(label) },
            singleLine = true,
            shape = CircleShape,
        )
        Button(
            onClick = onSubmit,
            enabled = value.trim().isNotEmpty(),
            modifier = Modifier.height(56.dp),
            shape = CircleShape,
            contentPadding = PaddingValues(horizontal = 16.dp),
        ) {
            Text(actionLabel)
        }
    }
}

@Composable
private fun InstituteRow(
    institute: Institute,
    onOpenInstitute: () -> Unit,
    onOpenRoster: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 15.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Text(
                        text = institute.name,
                        style = MaterialTheme.typography.titleSmall,
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    Text(
                        text = "No active timetable yet",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                TonalBadge(label = "LOCAL")
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                ActionButton(
                    label = "Roster",
                    onClick = onOpenRoster,
                    style = ActionStyle.Outlined,
                    modifier = Modifier.weight(1f),
                )
                ActionButton(
                    label = "Build",
                    onClick = onOpenInstitute,
                    style = ActionStyle.Primary,
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun RosterSectionShell(
    title: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        content()
    }
}

@Composable
private fun EditableNameRow(
    name: String,
    meta: String,
    onRename: (String) -> Unit,
    onDelete: () -> Unit,
) {
    var isEditing by rememberSaveable { mutableStateOf(false) }
    var editName by rememberSaveable { mutableStateOf(name) }

    LaunchedEffect(name, isEditing) {
        if (!isEditing) {
            editName = name
        }
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 15.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (isEditing) {
                OutlinedTextField(
                    value = editName,
                    onValueChange = { editName = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text("$meta name") },
                    shape = CircleShape,
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    ActionButton(
                        label = "Cancel",
                        onClick = {
                            editName = name
                            isEditing = false
                        },
                        style = ActionStyle.Outlined,
                        modifier = Modifier.weight(1f),
                    )
                    ActionButton(
                        label = "Save",
                        onClick = {
                            onRename(editName)
                            isEditing = false
                        },
                        style = ActionStyle.Primary,
                        modifier = Modifier.weight(1f),
                    )
                }
                ActionButton(
                    label = "Remove",
                    onClick = {
                        onDelete()
                        isEditing = false
                    },
                    style = ActionStyle.Danger,
                )
            } else {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Text(
                            text = name,
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Text(
                            text = meta,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ActionButton(
                            label = "Edit",
                            onClick = { isEditing = true },
                            style = ActionStyle.Tonal,
                            modifier = Modifier.width(92.dp),
                        )
                        ActionButton(
                            label = "Remove",
                            onClick = onDelete,
                            style = ActionStyle.Outlined,
                            modifier = Modifier.width(112.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyStateCard(
    title: String,
    body: String,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceContainer,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 15.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                text = body,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun WizardProgress(
    step: Int,
    totalSteps: Int,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 20.dp, top = 8.dp, end = 20.dp, bottom = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        repeat(totalSteps) { index ->
            Surface(
                modifier = Modifier
                    .height(6.dp)
                    .weight(1f),
                shape = CircleShape,
                color = if (index < step) {
                    MaterialTheme.colorScheme.primary
                } else {
                    MaterialTheme.colorScheme.surfaceContainerHighest
                },
                content = {},
            )
        }
    }
}

@Composable
private fun ScreenSampleCard() {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer,
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 15.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = "Grade 6 - A",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = "4 periods ready",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            TonalBadge(label = "READY")
        }
    }
}

@Composable
private fun PeriodSampleRow() {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = MaterialTheme.shapes.large,
        color = MaterialTheme.colorScheme.surfaceContainer,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 15.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(11.dp),
        ) {
            Surface(
                modifier = Modifier.weight(1f),
                shape = CircleShape,
                color = MaterialTheme.colorScheme.primaryContainer,
                contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
            ) {
                Text(
                    text = "08:00 - 08:45",
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp),
                    style = MaterialTheme.typography.labelMedium,
                )
            }
            Text(
                text = "45m",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Text(
                text = "::",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.outline,
            )
        }
    }
}

@Composable
private fun ChipSampleRow() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        TonalChip(
            label = "Mathematics",
            containerColor = MaterialTheme.colorScheme.primaryContainer,
            contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
        )
        TonalChip(
            label = "Mr. Rao",
            containerColor = MaterialTheme.colorScheme.secondaryContainer,
            contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
        )
        TonalChip(
            label = "Conflict check",
            containerColor = MaterialTheme.colorScheme.tertiaryContainer,
            contentColor = MaterialTheme.colorScheme.onTertiaryContainer,
        )
    }
}

@Composable
private fun TonalChip(
    label: String,
    containerColor: androidx.compose.ui.graphics.Color,
    contentColor: androidx.compose.ui.graphics.Color,
) {
    Surface(
        shape = CircleShape,
        color = containerColor,
        contentColor = contentColor,
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 15.dp, vertical = 8.dp),
            style = MaterialTheme.typography.labelMedium,
        )
    }
}

@Composable
private fun TonalBadge(label: String) {
    Surface(
        shape = CircleShape,
        color = MaterialTheme.colorScheme.secondaryContainer,
        contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
    ) {
        Text(
            text = label,
            modifier = Modifier.padding(horizontal = 11.dp, vertical = 4.dp),
            style = MaterialTheme.typography.labelSmall,
        )
    }
}

@Composable
private fun ActionButton(
    label: String,
    onClick: () -> Unit,
    style: ActionStyle,
    modifier: Modifier = Modifier,
) {
    val baseModifier = modifier.heightIn(min = 48.dp)
    when (style) {
        ActionStyle.Primary -> {
            Button(
                onClick = onClick,
                modifier = baseModifier,
                shape = CircleShape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
            ) {
                Text(text = label)
            }
        }
        ActionStyle.Tonal -> {
            Button(
                onClick = onClick,
                modifier = baseModifier,
                shape = CircleShape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                ),
                elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
            ) {
                Text(text = label)
            }
        }
        ActionStyle.Outlined -> {
            OutlinedButton(
                onClick = onClick,
                modifier = baseModifier,
                shape = CircleShape,
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                ),
                border = BorderStroke(1.5.dp, MaterialTheme.colorScheme.outlineVariant),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
            ) {
                Text(text = label)
            }
        }
        ActionStyle.Danger -> {
            OutlinedButton(
                onClick = onClick,
                modifier = baseModifier.fillMaxWidth(),
                shape = CircleShape,
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = MaterialTheme.colorScheme.error,
                ),
                border = BorderStroke(1.5.dp, MaterialTheme.colorScheme.errorContainer),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
            ) {
                Text(text = label)
            }
        }
    }
}

private fun selectedInstituteLabel(uiState: TimetableUiState): String {
    return uiState.selectedInstitute?.name ?: "Select an institute from Home"
}

private fun conflictLabel(
    conflict: AssignmentConflict,
    teachers: List<Teacher>,
    sections: List<Section>,
    slots: List<DraftTimeSlot>,
): String {
    val slotLabel = slots.firstOrNull { it.id == conflict.slotId }?.let { slot ->
        "${slot.startTime}-${slot.endTime}"
    } ?: "this slot"
    return when (conflict.type) {
        AssignmentConflictType.TeacherDoubleBooked -> {
            val teacherName = teachers.firstOrNull { it.id == conflict.teacherId }?.name
                ?: "A teacher"
            "$teacherName is double-booked at $slotLabel."
        }
        AssignmentConflictType.SectionDoubleBooked -> {
            val sectionName = sections.firstOrNull { it.id == conflict.sectionId }?.name
                ?: "A section"
            "$sectionName has more than one subject at $slotLabel."
        }
    }
}

private fun availabilityWarningLabel(
    warning: AvailabilityWarning,
    teachers: List<Teacher>,
    sections: List<Section>,
    slots: List<DraftTimeSlot>,
): String {
    val teacherName = teachers.firstOrNull { it.id == warning.teacherId }?.name ?: "A teacher"
    val sectionName = sections.firstOrNull { it.id == warning.sectionId }?.name ?: "a section"
    val slotText = slots.firstOrNull { it.id == warning.slotId }?.let(::slotLabel) ?: "this slot"
    return "$teacherName is unavailable for $sectionName ${warning.subjectName} at $slotText."
}

private fun slotLabel(slot: DraftTimeSlot): String {
    return "${slot.startTime} - ${slot.endTime}"
}

private data class PlaceholderAction(
    val label: String,
    val onClick: () -> Unit,
)

private data class AssignTargetKey(
    val slotId: String,
    val sectionId: String,
    val subjectName: String,
)

private data class DraggingTeacher(
    val teacher: Teacher,
    val position: Offset,
)

private val DefaultAssignSubjects = listOf("Mathematics", "Science")

private enum class ActionStyle {
    Primary,
    Tonal,
    Outlined,
    Danger,
}

private enum class TimetableRoute(val route: String) {
    Home("home"),
    Roster("roster"),
    WizardTimeSlots("wizard/time-slots"),
    WizardAssign("wizard/assign"),
    WizardAvailability("wizard/availability"),
    WizardReviewSave("wizard/review-save"),
    TimetableView("timetable-view"),
    History("history"),
}

private fun NavHostController.navigateHome() {
    navigate(TimetableRoute.Home.route) {
        popUpTo(TimetableRoute.Home.route) {
            inclusive = true
        }
        launchSingleTop = true
    }
}

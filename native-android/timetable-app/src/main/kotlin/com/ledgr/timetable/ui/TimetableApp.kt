package com.ledgr.timetable.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.ledgr.timetable.data.Institute
import com.ledgr.timetable.data.Section
import com.ledgr.timetable.data.Teacher
import com.ledgr.timetable.ui.theme.TimetableTheme

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
            WizardTimeSlotsScreen(uiState = uiState, navController = navController)
        }
        composable(TimetableRoute.WizardAssign.route) {
            WizardAssignScreen(uiState = uiState, navController = navController)
        }
        composable(TimetableRoute.WizardAvailability.route) {
            WizardAvailabilityScreen(uiState = uiState, navController = navController)
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
    navController: NavHostController,
) {
    PlaceholderScreen(
        title = "Time slots",
        description = selectedInstituteLabel(uiState),
        progressStep = 1,
        primaryActions = listOf(
            PlaceholderAction("Next: Assign") {
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
private fun WizardAssignScreen(
    uiState: TimetableUiState,
    navController: NavHostController,
) {
    PlaceholderScreen(
        title = "Assign",
        description = selectedInstituteLabel(uiState),
        progressStep = 2,
        primaryActions = listOf(
            PlaceholderAction("Next: Availability") {
                navController.navigate(TimetableRoute.WizardAvailability.route)
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
private fun WizardAvailabilityScreen(
    uiState: TimetableUiState,
    navController: NavHostController,
) {
    PlaceholderScreen(
        title = "Availability",
        description = selectedInstituteLabel(uiState),
        progressStep = 3,
        primaryActions = listOf(
            PlaceholderAction("Next: Review") {
                navController.navigate(TimetableRoute.WizardReviewSave.route)
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

private data class PlaceholderAction(
    val label: String,
    val onClick: () -> Unit,
)

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

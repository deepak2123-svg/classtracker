package com.ledgr.timetable.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.ledgr.timetable.ui.theme.TimetableTheme

@Composable
fun TimetableApp() {
    TimetableTheme {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.surface,
        ) {
            val navController = rememberNavController()
            TimetableNavHost(navController = navController)
        }
    }
}

@Composable
private fun TimetableNavHost(navController: NavHostController) {
    NavHost(
        navController = navController,
        startDestination = TimetableRoute.Home.route,
    ) {
        composable(TimetableRoute.Home.route) {
            HomeScreen(navController = navController)
        }
        composable(TimetableRoute.Roster.route) {
            InstituteRosterSettingsScreen(navController = navController)
        }
        composable(TimetableRoute.WizardTimeSlots.route) {
            WizardTimeSlotsScreen(navController = navController)
        }
        composable(TimetableRoute.WizardAssign.route) {
            WizardAssignScreen(navController = navController)
        }
        composable(TimetableRoute.WizardAvailability.route) {
            WizardAvailabilityScreen(navController = navController)
        }
        composable(TimetableRoute.WizardReviewSave.route) {
            WizardReviewSaveScreen(navController = navController)
        }
        composable(TimetableRoute.TimetableView.route) {
            TimetableViewScreen(navController = navController)
        }
        composable(TimetableRoute.History.route) {
            HistoryScreen(navController = navController)
        }
    }
}

@Composable
private fun HomeScreen(navController: NavHostController) {
    PlaceholderScreen(
        title = "Home",
        description = "Institute list placeholder.",
        primaryActions = listOf(
            PlaceholderAction("Open roster settings") {
                navController.navigate(TimetableRoute.Roster.route)
            },
            PlaceholderAction("Start build wizard") {
                navController.navigate(TimetableRoute.WizardTimeSlots.route)
            },
            PlaceholderAction("Open timetable view") {
                navController.navigate(TimetableRoute.TimetableView.route)
            },
            PlaceholderAction("Open history") {
                navController.navigate(TimetableRoute.History.route)
            },
            PlaceholderAction("Duplicate from previous") {
                navController.navigate(TimetableRoute.WizardAssign.route)
            },
        ),
    )
}

@Composable
private fun InstituteRosterSettingsScreen(navController: NavHostController) {
    PlaceholderScreen(
        title = "Institute roster settings",
        description = "Shared teachers and sections placeholder.",
        primaryActions = listOf(
            PlaceholderAction("Continue to time slots") {
                navController.navigate(TimetableRoute.WizardTimeSlots.route)
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
private fun WizardTimeSlotsScreen(navController: NavHostController) {
    PlaceholderScreen(
        title = "Build wizard: Time slots",
        description = "Period setup placeholder.",
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
private fun WizardAssignScreen(navController: NavHostController) {
    PlaceholderScreen(
        title = "Build wizard: Assign",
        description = "Manual assignment and conflict flag placeholder.",
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
private fun WizardAvailabilityScreen(navController: NavHostController) {
    PlaceholderScreen(
        title = "Build wizard: Availability",
        description = "Teacher unavailability placeholder.",
        progressStep = 3,
        primaryActions = listOf(
            PlaceholderAction("Next: Review and save") {
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
private fun WizardReviewSaveScreen(navController: NavHostController) {
    PlaceholderScreen(
        title = "Build wizard: Review and save",
        description = "Conflict summary and validity picker placeholder.",
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
private fun TimetableViewScreen(navController: NavHostController) {
    PlaceholderScreen(
        title = "Timetable view",
        description = "Current active timetable placeholder.",
        primaryActions = listOf(
            PlaceholderAction("Quick edit assignment") {
                navController.navigate(TimetableRoute.WizardAssign.route)
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
private fun HistoryScreen(navController: NavHostController) {
    PlaceholderScreen(
        title = "History",
        description = "Superseded timetable list placeholder.",
        primaryActions = listOf(
            PlaceholderAction("View read-only timetable") {
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
private fun PlaceholderScreen(
    title: String,
    description: String,
    primaryActions: List<PlaceholderAction>,
    secondaryActions: List<PlaceholderAction> = emptyList(),
    progressStep: Int? = null,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.surface)
            .safeDrawingPadding(),
    ) {
        AppHeader(title = title, description = description)
        progressStep?.let { WizardProgress(step = it, totalSteps = 4) }
        Column(
            modifier = Modifier
                .weight(1f)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 18.dp, vertical = 6.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            ScreenSampleCard()
            PeriodSampleRow()
            ChipSampleRow()
            primaryActions.forEachIndexed { index, action ->
                ActionButton(
                    action = action,
                    style = if (index == 0) ActionStyle.Primary else ActionStyle.Tonal,
                )
            }
            secondaryActions.forEach { action ->
                ActionButton(action = action, style = ActionStyle.Outlined)
            }
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
    action: PlaceholderAction,
    style: ActionStyle,
) {
    when (style) {
        ActionStyle.Primary -> {
            Button(
                onClick = action.onClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp),
                shape = CircleShape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    contentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 14.dp),
            ) {
                Text(text = action.label)
            }
        }
        ActionStyle.Tonal -> {
            Button(
                onClick = action.onClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp),
                shape = CircleShape,
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer,
                    contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                ),
                elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 14.dp),
            ) {
                Text(text = action.label)
            }
        }
        ActionStyle.Outlined -> {
            OutlinedButton(
                onClick = action.onClick,
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 48.dp),
                shape = CircleShape,
                colors = ButtonDefaults.outlinedButtonColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    contentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                ),
                border = BorderStroke(1.5.dp, MaterialTheme.colorScheme.outlineVariant),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 14.dp),
            ) {
                Text(text = action.label)
            }
        }
    }
}

private data class PlaceholderAction(
    val label: String,
    val onClick: () -> Unit,
)

private enum class ActionStyle {
    Primary,
    Tonal,
    Outlined,
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

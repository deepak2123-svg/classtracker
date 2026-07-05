package com.ledgr.timetable.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.ledgr.timetable.ui.theme.TimetableTheme

@Composable
fun TimetableApp() {
    TimetableTheme {
        Surface(modifier = Modifier.fillMaxSize()) {
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
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.headlineMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Text(
            text = description,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        primaryActions.forEach { action ->
            Button(
                onClick = action.onClick,
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 20.dp, vertical = 14.dp),
            ) {
                Text(text = action.label)
            }
        }
        secondaryActions.forEach { action ->
            OutlinedButton(
                onClick = action.onClick,
                modifier = Modifier.fillMaxWidth(),
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

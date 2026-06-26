package com.classtracker.nativeapp

import android.app.Activity
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedContentTransitionScope
import androidx.compose.animation.EnterTransition
import androidx.compose.animation.ExitTransition
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerDefaults
import androidx.compose.foundation.pager.PagerSnapDistance
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.draw.clip
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavHostController
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrOfflineBanner
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.designsystem.LedgrThemeMode
import com.classtracker.core.designsystem.ledgrPressScale
import com.classtracker.core.designsystem.rememberLedgrHaptics
import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherEntryStatus
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.TeacherSyncSummary
import com.classtracker.core.model.TeacherTrashedEntry
import com.classtracker.core.model.SyllabusProgressSnapshotTitle
import com.classtracker.core.model.toDuplicateDraft
import com.classtracker.feature.auth.AuthScreen
import com.classtracker.feature.classes.ClassEntryScreen
import com.classtracker.feature.classes.ClassHistoryScreen
import com.classtracker.feature.classes.StatsScreen
import com.classtracker.feature.classes.SyllabusScreen
import com.classtracker.feature.entries.EntryEditorScreen
import com.classtracker.feature.profile.ProfileScreen
import com.classtracker.feature.profile.ManageClassesScreen
import com.classtracker.feature.profile.FeedbackScreen
import com.classtracker.feature.profile.RecycleBinScreen
import com.classtracker.feature.profile.ReportsScreen
import com.classtracker.feature.today.HomeScreen
import com.classtracker.feature.today.NewClassScreen
import java.text.SimpleDateFormat
import kotlin.math.abs
import java.util.Date
import java.util.Locale
import java.util.UUID
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val ClassPagerSnapMillis = 170
private const val ClassPagerPositionalThreshold = 0.82f
private const val EntrySaveSuccessRevealMillis = 160L
private const val PushTransitionMillis = 280
private const val ModalTransitionMillis = 320
private val PushMotionRoutes = setOf(
    AppRoutes.ClassEntryPattern,
    AppRoutes.ClassHistoryPattern,
)
private val ModalMotionRoutes = setOf(
    AppRoutes.AddClass,
    AppRoutes.ManageClasses,
    AppRoutes.Reports,
    AppRoutes.Feedback,
    AppRoutes.RecycleBin,
    AppRoutes.NewEntryPattern,
    AppRoutes.EditEntryPattern,
    AppRoutes.DuplicateEntryPattern,
)

private fun String?.usesPushMotion() = this in PushMotionRoutes

private fun String?.usesModalMotion() = this in ModalMotionRoutes

private fun NavHostController.navigateToTopLevel(destination: AppDestination) {
    navigate(destination.route) {
        popUpTo(graph.startDestinationId) {
            saveState = true
        }
        launchSingleTop = true
        restoreState = true
    }
}

private fun NavHostController.navigateToSyllabus() {
    navigate(AppDestination.Syllabus.route)
}

private fun NavHostController.navigateHomeAfterMutation() {
    navigate(AppDestination.Home.route) {
        popUpTo(graph.startDestinationId) {
            inclusive = false
        }
        launchSingleTop = true
    }
}

private fun NavHostController.navigateToClassEntry(classId: String) {
    navigate(AppRoutes.classEntry(classId))
}

private fun NavHostController.navigateToClassHistory(classId: String) {
    navigate(AppRoutes.classHistory(classId))
}

private fun NavHostController.replaceClassHistory(classId: String) {
    navigate(AppRoutes.classHistory(classId)) {
        popUpTo(AppRoutes.ClassHistoryPattern) {
            inclusive = true
        }
        launchSingleTop = true
    }
}

private fun NavHostController.navigateToClassHistorySingleTop(classId: String) {
    navigate(AppRoutes.classHistory(classId)) {
        launchSingleTop = true
    }
}

private fun NavHostController.navigateToNewEntry(classId: String, dateKey: String) {
    navigate(AppRoutes.newEntry(classId, dateKey))
}

private fun NavHostController.navigateToEditEntry(classId: String, entryId: String) {
    navigate(AppRoutes.editEntry(classId, entryId))
}

private fun NavHostController.navigateToDuplicateEntry(classId: String, entryId: String) {
    navigate(AppRoutes.duplicateEntry(classId, entryId))
}

private fun NavHostController.navigateToAddClass() {
    navigate(AppRoutes.AddClass)
}

private fun NavHostController.navigateToManageClasses() {
    navigate(AppRoutes.ManageClasses)
}

private fun NavHostController.navigateToReports() {
    navigate(AppRoutes.Reports)
}

private fun NavHostController.navigateToRecycleBin() {
    navigate(AppRoutes.RecycleBin)
}

private fun NavHostController.navigateToFeedback() {
    navigate(AppRoutes.Feedback)
}

private data class LedgrShellState(
    val checkingSession: Boolean,
    val teacher: AuthenticatedTeacher?,
    val snapshot: TeacherSnapshot?,
    val loadingData: Boolean,
    val authenticating: Boolean,
    val errorMessage: String?,
)

private fun MainUiState.toShellState() = LedgrShellState(
    checkingSession = checkingSession,
    teacher = teacher,
    snapshot = snapshot,
    loadingData = loadingData,
    authenticating = authenticating,
    errorMessage = errorMessage,
)

private val pushEnterTransition:
    AnimatedContentTransitionScope<NavBackStackEntry>.() -> EnterTransition = {
    slideIntoContainer(
        towards = AnimatedContentTransitionScope.SlideDirection.Left,
        animationSpec = tween(
            durationMillis = PushTransitionMillis,
            easing = FastOutSlowInEasing,
        ),
    ) + fadeIn(animationSpec = tween(durationMillis = 220))
}

private val pushExitTransition:
    AnimatedContentTransitionScope<NavBackStackEntry>.() -> ExitTransition = {
    slideOutOfContainer(
        towards = AnimatedContentTransitionScope.SlideDirection.Left,
        animationSpec = tween(
            durationMillis = PushTransitionMillis,
            easing = FastOutSlowInEasing,
        ),
    ) + fadeOut(animationSpec = tween(durationMillis = 180))
}

private val pushPopEnterTransition:
    AnimatedContentTransitionScope<NavBackStackEntry>.() -> EnterTransition = {
    slideIntoContainer(
        towards = AnimatedContentTransitionScope.SlideDirection.Right,
        animationSpec = tween(
            durationMillis = PushTransitionMillis,
            easing = FastOutSlowInEasing,
        ),
    ) + fadeIn(animationSpec = tween(durationMillis = 220))
}

private val pushPopExitTransition:
    AnimatedContentTransitionScope<NavBackStackEntry>.() -> ExitTransition = {
    slideOutOfContainer(
        towards = AnimatedContentTransitionScope.SlideDirection.Right,
        animationSpec = tween(
            durationMillis = PushTransitionMillis,
            easing = FastOutSlowInEasing,
        ),
    ) + fadeOut(animationSpec = tween(durationMillis = 180))
}

private val modalEnterTransition:
    AnimatedContentTransitionScope<NavBackStackEntry>.() -> EnterTransition = {
    slideInVertically(
        initialOffsetY = { it / 4 },
        animationSpec = tween(
            durationMillis = ModalTransitionMillis,
            easing = FastOutSlowInEasing,
        ),
    ) + fadeIn(animationSpec = tween(durationMillis = 220))
}

private val modalExitTransition:
    AnimatedContentTransitionScope<NavBackStackEntry>.() -> ExitTransition = {
    fadeOut(animationSpec = tween(durationMillis = 160))
}

private val modalPopEnterTransition:
    AnimatedContentTransitionScope<NavBackStackEntry>.() -> EnterTransition = {
    fadeIn(animationSpec = tween(durationMillis = 180))
}

private val modalPopExitTransition:
    AnimatedContentTransitionScope<NavBackStackEntry>.() -> ExitTransition = {
    slideOutVertically(
        targetOffsetY = { it / 3 },
        animationSpec = tween(
            durationMillis = ModalTransitionMillis,
            easing = FastOutSlowInEasing,
        ),
    ) + fadeOut(animationSpec = tween(durationMillis = 180))
}

@Composable
private fun appHomeCanvasColor() =
    LedgrTheme.colors.canvas

@Composable
private fun appHomeInkColor() =
    LedgrTheme.colors.appHomeInk

@Composable
private fun appTopButtonSurfaceColor() =
    MaterialTheme.colorScheme.surface

@Composable
private fun appTopButtonBorderColor() =
    LedgrTheme.colors.appTopButtonBorder

private data class DraftResolution(
    val draft: TeacherEntryDraft,
    val recoveredVisible: Boolean,
    val clearStoredDraft: Boolean,
)

private fun resolveDraftForEntry(
    baseDraft: TeacherEntryDraft,
    recovered: StoredEntryDraft?,
    todayKey: String,
    allowStaleRecovery: Boolean,
): DraftResolution {
    if (recovered == null) {
        return DraftResolution(
            draft = baseDraft,
            recoveredVisible = false,
            clearStoredDraft = false,
        )
    }
    if (allowStaleRecovery || recovered.draft.dateKey == todayKey) {
        return DraftResolution(
            draft = recovered.draft,
            recoveredVisible = true,
            clearStoredDraft = false,
        )
    }
    return DraftResolution(
        draft = baseDraft,
        recoveredVisible = false,
        clearStoredDraft = true,
    )
}

@Composable
fun LedgrApp(
    viewModel: MainViewModel,
    environment: String,
    googleWebClientId: String,
    googleSignInConfigured: Boolean,
    themeMode: LedgrThemeMode,
    onThemeModeChange: (LedgrThemeMode) -> Unit,
    reminderPreferences: ReminderPreferences,
    onReminderPreferencesChange: (ReminderPreferences) -> Unit,
    modifier: Modifier = Modifier,
) {
    val shellState by remember(viewModel.state) {
        viewModel.state
            .map { it.toShellState() }
            .distinctUntilChanged()
    }.collectAsStateWithLifecycle(initialValue = viewModel.state.value.toShellState())
    val context = LocalContext.current
    val activity = context as? Activity
    val scope = rememberCoroutineScope()
    var keepStartupLoadingVisible by rememberSaveable { mutableStateOf(true) }
    val credentialReader = remember(activity) {
        activity?.let(::GoogleCredentialReader)
    }

    LaunchedEffect(Unit) {
        delay(900)
        keepStartupLoadingVisible = false
    }

    when {
        keepStartupLoadingVisible -> FullScreenLoading(modifier = modifier)

        shellState.checkingSession -> FullScreenLoading(modifier = modifier)

        shellState.teacher == null -> AuthScreen(
            loading = shellState.authenticating,
            errorMessage = shellState.errorMessage,
            googleSignInConfigured = googleSignInConfigured,
            onGoogleSignIn = {
                if (credentialReader == null) {
                    viewModel.reportError("Google sign-in is unavailable on this screen.")
                } else {
                    scope.launch {
                        runCatching {
                            credentialReader.requestIdToken(googleWebClientId)
                        }.onSuccess(viewModel::signInWithGoogleIdToken)
                            .onFailure { error ->
                                viewModel.reportError(error.toSignInMessage())
                            }
                    }
                }
            },
            onEmailSignIn = viewModel::signInWithEmail,
            onCreateAccount = viewModel::createAccount,
            onClearError = viewModel::clearError,
            modifier = modifier,
        )

        shellState.snapshot == null && shellState.loadingData -> FullScreenLoading(modifier = modifier)

        shellState.snapshot == null -> FullScreenError(
            message = shellState.errorMessage ?: "Teacher data could not be loaded.",
            onRetry = viewModel::refresh,
            onSignOut = viewModel::signOut,
            modifier = modifier,
        )

        else -> TeacherApp(
            teacher = requireNotNull(shellState.teacher),
            snapshot = requireNotNull(shellState.snapshot),
            mainState = viewModel.state,
            errorMessage = shellState.errorMessage,
            themeMode = themeMode,
            onThemeModeChange = onThemeModeChange,
            reminderPreferences = reminderPreferences,
            onReminderPreferencesChange = onReminderPreferencesChange,
            onClearError = viewModel::clearError,
            onDeleteEntry = viewModel::deleteEntry,
            onRestoreEntry = viewModel::restoreEntry,
            onDeleteAllTrashedEntries = viewModel::deleteAllTrashedEntries,
            onDeleteTrashedEntry = viewModel::deleteTrashedEntry,
            onDeleteAccount = viewModel::deleteAccount,
            onSignOut = viewModel::signOut,
            modifier = modifier,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TeacherApp(
    teacher: AuthenticatedTeacher,
    snapshot: TeacherSnapshot,
    mainState: StateFlow<MainUiState>,
    errorMessage: String?,
    themeMode: LedgrThemeMode,
    onThemeModeChange: (LedgrThemeMode) -> Unit,
    reminderPreferences: ReminderPreferences,
    onReminderPreferencesChange: (ReminderPreferences) -> Unit,
    onClearError: () -> Unit,
    onDeleteEntry: (TeacherEntry, TeacherClass) -> Unit,
    onRestoreEntry: (TeacherTrashedEntry) -> Unit,
    onDeleteAllTrashedEntries: () -> Unit,
    onDeleteTrashedEntry: (TeacherTrashedEntry) -> Unit,
    onDeleteAccount: () -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val feedbackViewModel: FeedbackViewModel = hiltViewModel()
    val feedbackState by feedbackViewModel.state.collectAsStateWithLifecycle()
    val syncViewModel: SyncViewModel = hiltViewModel()
    val syncState by syncViewModel.state.collectAsStateWithLifecycle()
    val haptics = rememberLedgrHaptics()
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = backStackEntry?.destination
    val currentRoute = currentDestination?.route
    val isClassEntry = currentRoute == AppRoutes.ClassEntryPattern
    val isClassHistory = currentRoute == AppRoutes.ClassHistoryPattern
    val isRecycleBin = currentRoute == AppRoutes.RecycleBin
    val isReports = currentRoute == AppRoutes.Reports
    val isFeedback = currentRoute == AppRoutes.Feedback
    val isAddClass = currentRoute == AppRoutes.AddClass
    val isManageClasses = currentRoute == AppRoutes.ManageClasses
    val isEntryEditor = currentRoute == AppRoutes.NewEntryPattern ||
        currentRoute == AppRoutes.EditEntryPattern ||
        currentRoute == AppRoutes.DuplicateEntryPattern
    val isDetailRoute = isClassEntry || isClassHistory || isRecycleBin ||
        isReports || isFeedback || isAddClass || isManageClasses || isEntryEditor
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val draftStore = remember(context) {
        EntryDraftStore(context.applicationContext)
    }
    val subjectAssignmentStore = remember(context) {
        SubjectAssignmentPreferenceStore(context.applicationContext)
    }
    val todayKey = todayKey()
    val dashboard = remember(snapshot, todayKey) { snapshot.dashboard(todayKey) }
    val classesById = remember(snapshot.classes) {
        snapshot.classes.associateBy(TeacherClass::id)
    }
    val entriesByClass = remember(snapshot.entries) {
        snapshot.entries.groupBy(TeacherEntry::classId)
    }
    val trashedEntriesByClass = remember(snapshot.trashedEntries) {
        snapshot.trashedEntries.groupBy(TeacherTrashedEntry::classId)
    }
    var showReminderDialog by rememberSaveable(teacher.uid) {
        mutableStateOf(!reminderPreferences.prompted)
    }
    var acknowledgedSubjectVersion by rememberSaveable(teacher.uid) {
        mutableStateOf(subjectAssignmentStore.acknowledgedVersion(teacher.uid))
    }
    val showSubjectAssignmentDialog =
        snapshot.profile.subjectAssignmentVersion > acknowledgedSubjectVersion

    LaunchedEffect(teacher.uid) {
        feedbackViewModel.prime(teacher.uid)
        syncViewModel.prime(teacher.uid)
    }

    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            onClearError()
        }
    }

    LaunchedEffect(feedbackState.errorMessage) {
        feedbackState.errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            feedbackViewModel.consumeError()
        }
    }

    LaunchedEffect(syncState.errorMessage) {
        syncState.errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            syncViewModel.consumeError()
        }
    }

    if (showSubjectAssignmentDialog) {
        AlertDialog(
            onDismissRequest = {},
            title = {
                Text(
                    text = "Your subjects are assigned",
                    style = MaterialTheme.typography.titleLarge,
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        text = "Your administrator updated the subjects available in Ledgr.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = LedgrTheme.colors.textSecondary,
                    )
                    Surface(
                        modifier = Modifier.fillMaxWidth(),
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text(
                            text = snapshot.profile.subjects
                                .takeIf { it.isNotEmpty() }
                                ?.joinToString(separator = "\n") { "• $it" }
                                ?: "No active subjects are currently assigned.",
                            modifier = Modifier.padding(14.dp),
                            style = MaterialTheme.typography.bodyLarge,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    Text(
                        text = "New classes can use only these official subjects. Contact your administrator if anything is missing.",
                        style = MaterialTheme.typography.bodySmall,
                        color = LedgrTheme.colors.textSecondary,
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        haptics.confirm()
                        val version = snapshot.profile.subjectAssignmentVersion
                        subjectAssignmentStore.acknowledge(teacher.uid, version)
                        acknowledgedSubjectVersion = version
                    },
                ) {
                    Text("I understand")
                }
            },
        )
    }

    if (showReminderDialog && !showSubjectAssignmentDialog) {
        ReminderSetupDialog(
            preferences = reminderPreferences,
            firstRun = !reminderPreferences.prompted,
            onDismiss = {
                showReminderDialog = false
                if (!reminderPreferences.prompted) {
                    onReminderPreferencesChange(reminderPreferences.copy(prompted = true))
                }
            },
            onSave = { updated ->
                showReminderDialog = false
                onReminderPreferencesChange(updated)
            },
        )
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = MaterialTheme.colorScheme.background,
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    if (isEntryEditor) {
                        Text(
                            text = when (currentRoute) {
                                AppRoutes.NewEntryPattern -> "Add entry"
                                AppRoutes.DuplicateEntryPattern -> "Duplicate entry"
                                else -> "Edit entry"
                            },
                            style = MaterialTheme.typography.titleLarge,
                        )
                    } else if (isRecycleBin) {
                        Text(
                            text = "Recycle bin",
                            style = MaterialTheme.typography.titleLarge,
                        )
                    } else if (isReports) {
                        Text(
                            text = "Reports & export",
                            style = MaterialTheme.typography.titleLarge,
                        )
                    } else if (isFeedback) {
                        Text(
                            text = "Feedback & support",
                            style = MaterialTheme.typography.titleLarge,
                        )
                    } else if (isAddClass) {
                        Text(
                            text = "Add class",
                            style = MaterialTheme.typography.titleLarge,
                        )
                    } else if (isManageClasses) {
                        Text(
                            text = "Manage classes",
                            style = MaterialTheme.typography.titleLarge,
                        )
                    } else if (isClassEntry) {
                        Text(
                            text = "Add entry",
                            style = MaterialTheme.typography.titleLarge,
                        )
                    } else if (isClassHistory) {
                        Text(
                            text = "Past entries",
                            style = MaterialTheme.typography.titleLarge,
                        )
                    } else {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Surface(
                                modifier = Modifier.size(44.dp),
                                color = LedgrTheme.colors.appBrandMarkSurface,
                                contentColor = LedgrTheme.colors.appBrandMarkContent,
                                shape = RoundedCornerShape(13.dp),
                            ) {
                                Box(contentAlignment = Alignment.Center) {
                                    Text(
                                        text = "L",
                                        style = MaterialTheme.typography.titleLarge.copy(
                                            fontSize = 18.sp,
                                            lineHeight = 20.sp,
                                        ),
                                        fontWeight = FontWeight.ExtraBold,
                                    )
                                }
                            }
                            Text(
                                text = "Ledgr",
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontSize = 23.sp,
                                    lineHeight = 26.sp,
                                    color = appHomeInkColor(),
                                ),
                                fontWeight = FontWeight.ExtraBold,
                            )
                        }
                    }
                },
                navigationIcon = {
                    if (isDetailRoute) {
                        Surface(
                            modifier = Modifier
                                .padding(start = 12.dp)
                                .size(46.dp),
                            color = if (isClassEntry) appTopButtonSurfaceColor() else Color.Transparent,
                            contentColor = if (isClassEntry) appHomeInkColor() else MaterialTheme.colorScheme.onSurface,
                            shape = CircleShape,
                            border = if (isClassEntry) BorderStroke(1.dp, appTopButtonBorderColor()) else null,
                        ) {
                            IconButton(onClick = navController::navigateUp) {
                                Icon(
                                    imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                                    contentDescription = "Back",
                                )
                            }
                        }
                    }
                },
                actions = {
                    if (!isDetailRoute) {
                        Surface(
                            modifier = Modifier
                                .padding(end = 12.dp)
                                .size(42.dp),
                            color = appTopButtonSurfaceColor(),
                            contentColor = appHomeInkColor(),
                            shape = CircleShape,
                            border = BorderStroke(1.dp, appTopButtonBorderColor()),
                        ) {
                            IconButton(
                                onClick = {
                                    scope.launch {
                                        snackbarHostState.showSnackbar(
                                            "No unread updates right now.",
                                        )
                                    }
                                },
                            ) {
                                Icon(
                                    imageVector = Icons.Outlined.NotificationsNone,
                                    contentDescription = "Notifications",
                                    modifier = Modifier.size(22.dp),
                                )
                            }
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = if (!isDetailRoute || isClassEntry) {
                        appHomeCanvasColor()
                    } else {
                        MaterialTheme.colorScheme.surface
                    },
                    titleContentColor = if (!isDetailRoute || isClassEntry) {
                        appHomeInkColor()
                    } else {
                        MaterialTheme.colorScheme.onSurface
                    },
                ),
            )
        },
        bottomBar = {
            if (!isDetailRoute) {
                LedgrBottomBar(
                    currentDestination = currentDestination,
                    onNavigate = { destination ->
                        haptics.selection()
                        navController.navigateToTopLevel(destination)
                    },
                )
            }
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            if (snapshot.isFromCache) {
                LedgrOfflineBanner(
                    modifier = Modifier.padding(start = 16.dp, top = 10.dp, end = 16.dp),
                )
            }
            if (syncState.summary.hasWork) {
                SyncStatusBanner(
                    summary = syncState.summary,
                    onRetry = syncViewModel::retry,
                    modifier = Modifier.padding(start = 16.dp, top = 10.dp, end = 16.dp),
                )
            }
            Box(modifier = Modifier.weight(1f)) {
                NavHost(
                    navController = navController,
                    startDestination = AppDestination.Home.route,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    composable(AppDestination.Home.route) {
                        HomeRoute(
                            teacherUid = teacher.uid,
                            bootstrapSnapshot = snapshot,
                            onClassClick = { teacherClass ->
                                navController.navigateToClassEntry(teacherClass.id)
                            },
                            onClassHistoryClick = { teacherClass ->
                                navController.navigateToClassHistory(teacherClass.id)
                            },
                            onClassSyllabusClick = { _ ->
                                navController.navigateToSyllabus()
                            },
                            classCreateEnabled = BuildConfig.NATIVE_CLASS_CREATE_ENABLED,
                            onAddClassClick = {
                                navController.navigateToAddClass()
                            },
                            modifier = Modifier.fillMaxSize(),
                        )
                    }
                    composable(
                        route = AppRoutes.AddClass,
                        enterTransition = modalEnterTransition,
                        exitTransition = modalExitTransition,
                        popEnterTransition = modalPopEnterTransition,
                        popExitTransition = modalPopExitTransition,
                    ) {
                        val classMutationViewModel: ClassMutationViewModel = hiltViewModel()
                        val classMutationState by classMutationViewModel.state.collectAsStateWithLifecycle()

                        LaunchedEffect(teacher.uid, snapshot.revision) {
                            classMutationViewModel.prime(
                                teacher = teacher,
                                snapshot = snapshot,
                            )
                        }

                        LaunchedEffect(classMutationState.errorMessage) {
                            val message = classMutationState.errorMessage ?: return@LaunchedEffect
                            snackbarHostState.showSnackbar(message)
                            classMutationViewModel.consumeError()
                        }

                        LaunchedEffect(classMutationState.classSaved) {
                            if (classMutationState.classSaved) {
                                classMutationViewModel.consumeClassSaved()
                                navController.navigateHomeAfterMutation()
                                snackbarHostState.showSnackbar(
                                    message = "✓ Class added successfully",
                                    duration = androidx.compose.material3.SnackbarDuration.Short,
                                    withDismissAction = true,
                                )
                            }
                        }

                        NewClassScreen(
                            availableInstitutes = snapshot.availableInstitutes,
                            availableSectionsByInstitute = snapshot.availableSectionsByInstitute,
                            subjectOptions = snapshot.profile.subjects,
                            saving = classMutationState.savingClass,
                            onSaveClass = { draft ->
                                classMutationViewModel.createClass(draft)
                                scope.launch {
                                    snackbarHostState.showSnackbar(
                                        message = "Adding class...",
                                        duration = androidx.compose.material3.SnackbarDuration.Short,
                                    )
                                }
                            },
                        )
                    }
                    composable(AppDestination.Stats.route) {
                        StatsScreen(
                            classes = snapshot.classes,
                            entries = snapshot.entries,
                            onClassClick = { teacherClass ->
                                navController.navigateToClassEntry(teacherClass.id)
                            },
                        )
                    }
                    composable(AppDestination.Syllabus.route) {
                        val context = LocalContext.current
                        val syllabusEntryFlowViewModel: EntryFlowViewModel = hiltViewModel()
                        val syllabusEntryFlowState by syllabusEntryFlowViewModel.state.collectAsStateWithLifecycle()
                        val syllabiViewModel: SyllabiViewModel = hiltViewModel()
                        val syllabiState by syllabiViewModel.state.collectAsStateWithLifecycle()

                        LaunchedEffect(teacher.uid, snapshot.revision) {
                            syllabusEntryFlowViewModel.prime(
                                teacher = teacher,
                                snapshot = snapshot,
                            )
                        }

                        LaunchedEffect(syllabusEntryFlowState.errorMessage) {
                            val message = syllabusEntryFlowState.errorMessage ?: return@LaunchedEffect
                            Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
                            syllabusEntryFlowViewModel.consumeError()
                        }

                        LaunchedEffect(syllabusEntryFlowState.entrySaved) {
                            if (syllabusEntryFlowState.entrySaved) {
                                syllabusEntryFlowViewModel.consumeEntrySaved()
                            }
                        }

                        SyllabusScreen(
                            teacherUid = teacher.uid,
                            classes = snapshot.classes,
                            entries = snapshot.entries,
                            syllabi = syllabiState.publishedSyllabi,
                            loading = syllabiState.loading,
                            errorMessage = syllabiState.errorMessage,
                            onClassClick = { teacherClass ->
                                navController.navigateToClassEntry(teacherClass.id)
                            },
                            onSaveProgress = { teacherClass, syllabus, unitIds ->
                                syllabusEntryFlowViewModel.saveEntry(
                                    TeacherEntryDraft(
                                        mutationId = "native_${UUID.randomUUID()}",
                                        classId = teacherClass.id,
                                        dateKey = todayKey,
                                        title = SyllabusProgressSnapshotTitle,
                                        body = syllabus.name,
                                        tag = "syllabus",
                                        status = TeacherEntryStatus.Completed.storageValue,
                                        timeStart = teacherClass.startTime?.takeIf(String::isNotBlank) ?: "00:00",
                                        timeEnd = "",
                                        syllabusTemplateId = syllabus.templateId,
                                        syllabusVersion = syllabus.version,
                                        syllabusChapterId = "",
                                        syllabusChapterTitle = "",
                                        completedSyllabusTopicIds = unitIds.toList(),
                                        syllabusChapterCompleted = false,
                                    ),
                                )
                            },
                        )
                    }
                    composable(AppDestination.Profile.route) {
                        val deletingAccount by remember(mainState) {
                            mainState
                                .map { it.deletingAccount }
                                .distinctUntilChanged()
                        }.collectAsStateWithLifecycle(initialValue = mainState.value.deletingAccount)
                        ProfileScreen(
                            profile = snapshot.profile,
                            loggedToday = dashboard.loggedClassCountToday,
                            monthEntries = dashboard.entryCountThisMonth,
                            activeClasses = dashboard.classCount,
                            instituteCount = dashboard.instituteCount,
                            trashedCount = snapshot.trashedEntries.size,
                            themeMode = themeMode,
                            onThemeModeChange = onThemeModeChange,
                            onOpenStats = {
                                navController.navigateToTopLevel(AppDestination.Stats)
                            },
                            onOpenManageClasses = {
                                navController.navigateToManageClasses()
                            },
                            onOpenReports = {
                                navController.navigateToReports()
                            },
                            onOpenRecycleBin = {
                                navController.navigateToRecycleBin()
                            },
                            reminderEnabled = reminderPreferences.enabled,
                            reminderTimeLabel = reminderPreferences.timeLabel,
                            onOpenReminderSettings = {
                                showReminderDialog = true
                            },
                            feedbackUnreadCount = feedbackState.conversation.unreadByTeacher,
                            onOpenFeedback = {
                                feedbackViewModel.markFeedbackRead()
                                navController.navigateToFeedback()
                            },
                            onSignOut = onSignOut,
                            deletingAccount = deletingAccount,
                            onDeleteAccount = onDeleteAccount,
                        )
                    }
                    composable(
                        route = AppRoutes.ManageClasses,
                        enterTransition = modalEnterTransition,
                        exitTransition = modalExitTransition,
                        popEnterTransition = modalPopEnterTransition,
                        popExitTransition = modalPopExitTransition,
                    ) {
                        val classMutationViewModel: ClassMutationViewModel = hiltViewModel()
                        val classMutationState by classMutationViewModel.state.collectAsStateWithLifecycle()

                        LaunchedEffect(teacher.uid, snapshot.revision) {
                            classMutationViewModel.prime(
                                teacher = teacher,
                                snapshot = snapshot,
                            )
                        }

                        LaunchedEffect(classMutationState.errorMessage) {
                            val message = classMutationState.errorMessage ?: return@LaunchedEffect
                            snackbarHostState.showSnackbar(message)
                            classMutationViewModel.consumeError()
                        }

                        ManageClassesScreen(
                            classes = snapshot.classes,
                            entries = snapshot.entries,
                            deletingClassId = classMutationState.deletingClassId,
                            deleteEnabled = BuildConfig.NATIVE_CLASS_DELETE_ENABLED,
                            onDeleteClass = { teacherClass ->
                                classMutationViewModel.deleteClass(teacherClass)
                                scope.launch {
                                    snackbarHostState.showSnackbar(
                                        message = "Moving class to recycle bin...",
                                        duration = androidx.compose.material3.SnackbarDuration.Short,
                                    )
                                }
                            },
                        )
                    }
                    composable(
                        route = AppRoutes.RecycleBin,
                        enterTransition = modalEnterTransition,
                        exitTransition = modalExitTransition,
                        popEnterTransition = modalPopEnterTransition,
                        popExitTransition = modalPopExitTransition,
                    ) {
                        val deletingAllTrashedEntries by remember(mainState) {
                            mainState
                                .map { it.deletingAllTrashedEntries }
                                .distinctUntilChanged()
                        }.collectAsStateWithLifecycle(
                            initialValue = mainState.value.deletingAllTrashedEntries,
                        )
                        val deletingTrashedEntryId by remember(mainState) {
                            mainState
                                .map { it.deletingTrashedEntryId }
                                .distinctUntilChanged()
                        }.collectAsStateWithLifecycle(
                            initialValue = mainState.value.deletingTrashedEntryId,
                        )
                        RecycleBinScreen(
                            trashedEntries = snapshot.trashedEntries,
                            onRestoreEntry = onRestoreEntry,
                            deletingAll = deletingAllTrashedEntries,
                            deletingEntryId = deletingTrashedEntryId,
                            deleteAllEnabled = BuildConfig.NATIVE_ENTRY_DELETE_ENABLED,
                            onDeleteAll = onDeleteAllTrashedEntries,
                            onDeleteEntry = onDeleteTrashedEntry,
                        )
                    }
                    composable(
                        route = AppRoutes.Reports,
                        enterTransition = modalEnterTransition,
                        exitTransition = modalExitTransition,
                        popEnterTransition = modalPopEnterTransition,
                        popExitTransition = modalPopExitTransition,
                    ) {
                        val syllabiViewModel: SyllabiViewModel = hiltViewModel()
                        val syllabiState by syllabiViewModel.state.collectAsStateWithLifecycle()

                        ReportsScreen(
                            snapshot = snapshot,
                            todayKey = todayKey,
                            syllabi = syllabiState.publishedSyllabi,
                        )
                    }
                    composable(
                        route = AppRoutes.Feedback,
                        enterTransition = modalEnterTransition,
                        exitTransition = modalExitTransition,
                        popEnterTransition = modalPopEnterTransition,
                        popExitTransition = modalPopExitTransition,
                    ) {
                        LaunchedEffect(Unit) {
                            feedbackViewModel.markFeedbackRead()
                        }
                        FeedbackScreen(
                            conversation = feedbackState.conversation,
                            unavailableMessage = feedbackState.unavailableMessage,
                            sending = feedbackState.sending,
                            sent = feedbackState.sent,
                            onSend = { body ->
                                feedbackViewModel.sendFeedback(
                                    teacher = teacher,
                                    profile = snapshot.profile,
                                    body = body,
                                )
                            },
                            onSentConsumed = feedbackViewModel::consumeSent,
                        )
                    }
                    composable(
                        route = AppRoutes.ClassEntryPattern,
                        enterTransition = pushEnterTransition,
                        exitTransition = pushExitTransition,
                        popEnterTransition = pushPopEnterTransition,
                        popExitTransition = pushPopExitTransition,
                    ) { entry ->
                        val classId = AppRoutes.classId(entry)
                        val teacherClass = classesById[classId]
                        if (teacherClass == null) {
                            FullScreenError(
                                message = "This class is no longer available.",
                                onRetry = { navController.navigateUp() },
                                onSignOut = onSignOut,
                            )
                        } else {
                            val syllabiViewModel: SyllabiViewModel = hiltViewModel()
                            val syllabiState by syllabiViewModel.state.collectAsStateWithLifecycle()

                            ClassEntryPagerRoute(
                                initialClassId = classId,
                                teacher = teacher,
                                snapshot = snapshot,
                                publishedSyllabi = syllabiState.publishedSyllabi,
                                entriesByClass = entriesByClass,
                                trashedEntriesByClass = trashedEntriesByClass,
                                createEnabled = BuildConfig.NATIVE_ENTRY_CREATE_ENABLED,
                                editEnabled = BuildConfig.NATIVE_ENTRY_EDIT_ENABLED,
                                deleteEnabled = BuildConfig.NATIVE_ENTRY_DELETE_ENABLED,
                                draftStore = draftStore,
                                todayKey = todayKey,
                                onNavigateToClass = { targetClassId ->
                                    navController.navigateToClassHistorySingleTop(targetClassId)
                                },
                                onEditEntry = { targetClassId, teacherEntry ->
                                    navController.navigateToEditEntry(targetClassId, teacherEntry.id)
                                },
                                onDuplicateEntry = { targetClassId, teacherEntry ->
                                    navController.navigateToDuplicateEntry(targetClassId, teacherEntry.id)
                                },
                                onDeleteEntry = onDeleteEntry,
                                onRestoreEntry = onRestoreEntry,
                                onSaved = {
                                    navController.navigateHomeAfterMutation()
                                },
                            )
                        }
                    }
                    composable(
                        route = AppRoutes.ClassHistoryPattern,
                        enterTransition = pushEnterTransition,
                        exitTransition = pushExitTransition,
                        popEnterTransition = pushPopEnterTransition,
                        popExitTransition = pushPopExitTransition,
                    ) { entry ->
                        val classId = AppRoutes.classId(entry)
                        val teacherClass = classesById[classId]
                        if (teacherClass == null) {
                            FullScreenError(
                                message = "This class is no longer available.",
                                onRetry = { navController.navigateUp() },
                                onSignOut = onSignOut,
                            )
                        } else {
                            ClassHistoryPagerRoute(
                                initialClassId = classId,
                                snapshot = snapshot,
                                entriesByClass = entriesByClass,
                                trashedEntriesByClass = trashedEntriesByClass,
                                createEnabled = BuildConfig.NATIVE_ENTRY_CREATE_ENABLED,
                                editEnabled = BuildConfig.NATIVE_ENTRY_EDIT_ENABLED,
                                deleteEnabled = BuildConfig.NATIVE_ENTRY_DELETE_ENABLED,
                                onNavigateToClass = { targetClassId ->
                                    navController.replaceClassHistory(targetClassId)
                                },
                                onAddEntry = { targetClassId, dateKey ->
                                    navController.navigateToNewEntry(targetClassId, dateKey)
                                },
                                onEditEntry = { targetClassId, teacherEntry ->
                                    navController.navigateToEditEntry(targetClassId, teacherEntry.id)
                                },
                                onDuplicateEntry = { targetClassId, teacherEntry ->
                                    navController.navigateToDuplicateEntry(targetClassId, teacherEntry.id)
                                },
                                onDeleteEntry = onDeleteEntry,
                                onRestoreEntry = onRestoreEntry,
                            )
                        }
                    }
                    composable(
                        route = AppRoutes.NewEntryPattern,
                        enterTransition = modalEnterTransition,
                        exitTransition = modalExitTransition,
                        popEnterTransition = modalPopEnterTransition,
                        popExitTransition = modalPopExitTransition,
                    ) { entry ->
                        val classId = AppRoutes.classId(entry)
                        val dateKey = AppRoutes.dateKey(entry).ifBlank { todayKey() }
                        val teacherClass = classesById[classId]
                        if (teacherClass == null) {
                            MissingClassScreen(
                                onBack = navController::navigateUp,
                            )
                        } else {
                            EntryEditorRoute(
                                teacher = teacher,
                                snapshot = snapshot,
                                teacherClass = teacherClass,
                                existingEntry = null,
                                initialDateKey = dateKey,
                                existingEntries = entriesByClass[classId].orEmpty(),
                                draftStore = draftStore,
                                onSaved = { navController.navigateUp() },
                            )
                        }
                    }
                    composable(
                        route = AppRoutes.DuplicateEntryPattern,
                        enterTransition = modalEnterTransition,
                        exitTransition = modalExitTransition,
                        popEnterTransition = modalPopEnterTransition,
                        popExitTransition = modalPopExitTransition,
                    ) { entry ->
                        val classId = AppRoutes.classId(entry)
                        val entryId = AppRoutes.entryId(entry)
                        val teacherClass = classesById[classId]
                        val classEntries = entriesByClass[classId].orEmpty()
                        val sourceEntry = classEntries.firstOrNull { it.id == entryId }
                        if (teacherClass == null || sourceEntry == null) {
                            MissingClassScreen(
                                message = "This teaching entry is no longer available.",
                                onBack = navController::navigateUp,
                            )
                        } else {
                            val duplicateDraft = remember(sourceEntry.id) {
                                sourceEntry.toDuplicateDraft(
                                    mutationId = "native_${UUID.randomUUID()}",
                                )
                            }
                            EntryEditorRoute(
                                teacher = teacher,
                                snapshot = snapshot,
                                teacherClass = teacherClass,
                                existingEntry = null,
                                initialDateKey = sourceEntry.dateKey,
                                initialDraft = duplicateDraft,
                                existingEntries = classEntries,
                                draftStoreEntryId = "duplicate-${sourceEntry.id}",
                                draftStore = draftStore,
                                onSaved = { navController.navigateUp() },
                            )
                        }
                    }
                    composable(
                        route = AppRoutes.EditEntryPattern,
                        enterTransition = modalEnterTransition,
                        exitTransition = modalExitTransition,
                        popEnterTransition = modalPopEnterTransition,
                        popExitTransition = modalPopExitTransition,
                    ) { entry ->
                        val classId = AppRoutes.classId(entry)
                        val entryId = AppRoutes.entryId(entry)
                        val teacherClass = classesById[classId]
                        val classEntries = entriesByClass[classId].orEmpty()
                        val existingEntry = classEntries.firstOrNull { it.id == entryId }
                        if (teacherClass == null || existingEntry == null) {
                            MissingClassScreen(
                                message = "This teaching entry is no longer available.",
                                onBack = navController::navigateUp,
                            )
                        } else {
                            EntryEditorRoute(
                                teacher = teacher,
                                snapshot = snapshot,
                                teacherClass = teacherClass,
                                existingEntry = existingEntry,
                                initialDateKey = existingEntry.dateKey,
                                existingEntries = classEntries,
                                draftStore = draftStore,
                                onSaved = { navController.navigateUp() },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LedgrBottomBar(
    currentDestination: androidx.navigation.NavDestination?,
    onNavigate: (AppDestination) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 0.dp,
        shadowElevation = 0.dp,
        border = BorderStroke(
            width = 1.dp,
            color = MaterialTheme.colorScheme.outlineVariant,
        ),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            AppDestination.entries.forEach { destination ->
                val selected = currentDestination
                    ?.hierarchy
                    ?.any { it.route == destination.route } == true
                LedgrBottomBarItem(
                    destination = destination,
                    selected = selected,
                    onClick = {
                        if (!selected) {
                            onNavigate(destination)
                        }
                    },
                )
            }
        }
    }
}

@Composable
private fun RowScope.LedgrBottomBarItem(
    destination: AppDestination,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val interactionSource = remember(destination.route) { MutableInteractionSource() }
    val iconAndLabelColor by animateColorAsState(
        targetValue = if (selected) {
            LedgrTheme.colors.teal
        } else {
            LedgrTheme.colors.textMuted
        },
        animationSpec = tween(durationMillis = 220, easing = FastOutSlowInEasing),
        label = "bottomBarItemColor",
    )
    val indicatorColor by animateColorAsState(
        targetValue = if (selected) {
            LedgrTheme.colors.teal
        } else {
            Color.Transparent
        },
        animationSpec = tween(durationMillis = 220, easing = FastOutSlowInEasing),
        label = "bottomBarIndicatorColor",
    )
    Column(
        modifier = modifier
            .weight(1f)
            .clip(RoundedCornerShape(18.dp))
            .ledgrPressScale(
                interactionSource = interactionSource,
                enabled = !selected,
            )
            .clickable(
                interactionSource = interactionSource,
                indication = null,
                onClick = onClick,
            )
            .padding(horizontal = 4.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Icon(
            imageVector = destination.icon,
            contentDescription = destination.label,
            tint = iconAndLabelColor,
            modifier = Modifier.size(22.dp),
        )
        Text(
            text = destination.label,
            style = MaterialTheme.typography.labelSmall.copy(
                fontSize = 11.sp,
                lineHeight = 14.sp,
                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            ),
            color = iconAndLabelColor,
            maxLines = 1,
            textAlign = TextAlign.Center,
        )
        Box(
            modifier = Modifier
                .width(18.dp)
                .height(4.dp)
                .clip(CircleShape)
                .background(indicatorColor),
        )
    }
}

@Composable
private fun ReminderSetupDialog(
    preferences: ReminderPreferences,
    firstRun: Boolean,
    onDismiss: () -> Unit,
    onSave: (ReminderPreferences) -> Unit,
) {
    val haptics = rememberLedgrHaptics()
    val initialHour12 = (preferences.hour % 12).let { if (it == 0) 12 else it }
    val initialPeriodIndex = if (preferences.hour >= 12) 1 else 0
    val hours = remember { (1..12).map { "%02d".format(Locale.US, it) } }
    val minutes = remember { (0..59).map { "%02d".format(Locale.US, it) } }
    val periods = remember { listOf("AM", "PM") }
    val hourState = rememberLazyListState(initialFirstVisibleItemIndex = initialHour12 - 1)
    val minuteState = rememberLazyListState(initialFirstVisibleItemIndex = preferences.minute)
    val periodState = rememberLazyListState(initialFirstVisibleItemIndex = initialPeriodIndex)

    fun selectedPreferences(): ReminderPreferences {
        val hour12 = hours[hourState.centeredReminderItemIndex(hours.size)].toInt()
        val minute = minutes[minuteState.centeredReminderItemIndex(minutes.size)].toInt()
        val period = periods[periodState.centeredReminderItemIndex(periods.size)]
        val hour24 = if (period == "PM") (hour12 % 12) + 12 else if (hour12 == 12) 0 else hour12
        return preferences.copy(
            prompted = true,
            enabled = true,
            hour = hour24,
            minute = minute,
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = if (firstRun) "Set daily reminder" else "Daily reminder",
                style = MaterialTheme.typography.titleLarge,
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = "Ledgr can remind you once per day, Monday to Saturday.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = LedgrTheme.colors.textSecondary,
                )
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    ReminderDrumWheel(
                        items = hours,
                        state = hourState,
                        label = "HOUR",
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        text = ":",
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.ExtraBold,
                        ),
                        color = MaterialTheme.colorScheme.onSurface,
                    )
                    ReminderDrumWheel(
                        items = minutes,
                        state = minuteState,
                        label = "MIN",
                        modifier = Modifier.weight(1f),
                    )
                    ReminderDrumWheel(
                        items = periods,
                        state = periodState,
                        label = "AM/PM",
                        modifier = Modifier.weight(1f),
                    )
                }
                Text(
                    text = "Reminder time: ${selectedPreferences().timeLabel}",
                    style = MaterialTheme.typography.labelLarge,
                    color = LedgrTheme.colors.textSecondary,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    haptics.confirm()
                    onSave(selectedPreferences())
                },
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            Row {
                if (preferences.enabled) {
                    TextButton(
                        onClick = {
                            haptics.warning()
                            onSave(preferences.copy(prompted = true, enabled = false))
                        },
                    ) {
                        Text("Turn off")
                    }
                }
                TextButton(onClick = {
                    haptics.selection()
                    onDismiss()
                }) {
                    Text(if (firstRun) "Not now" else "Cancel")
                }
            }
        },
    )
}

@Composable
private fun ReminderDrumWheel(
    items: List<String>,
    state: LazyListState,
    label: String,
    modifier: Modifier = Modifier,
) {
    LaunchedEffect(state, items.size) {
        snapshotFlow { state.isScrollInProgress }
            .distinctUntilChanged()
            .collect { scrolling ->
                if (!scrolling) {
                    val selected = state.centeredReminderItemIndex(items.size)
                    if (state.firstVisibleItemIndex != selected || state.firstVisibleItemScrollOffset != 0) {
                        state.animateScrollToItem(selected)
                    }
                }
            }
    }

    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .height(132.dp),
            color = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(18.dp),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                Box(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .fillMaxWidth()
                        .height(42.dp)
                        .padding(horizontal = 7.dp)
                        .background(
                            LedgrTheme.colors.pickerHighlightSurface,
                            RoundedCornerShape(9.dp),
                        ),
                )
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    state = state,
                    contentPadding = PaddingValues(vertical = 45.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    items.indices.forEach { index ->
                        item(key = "$label-$index") {
                            val selectedIndex = state.centeredReminderItemIndex(items.size)
                            val distance = abs(index - selectedIndex)
                            Text(
                                text = items[index],
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(42.dp),
                                textAlign = TextAlign.Center,
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontSize = 24.sp,
                                    lineHeight = 42.sp,
                                    fontWeight = if (distance == 0) {
                                        FontWeight.ExtraBold
                                    } else {
                                        FontWeight.Bold
                                    },
                                ),
                                color = MaterialTheme.colorScheme.onSurface.copy(
                                    alpha = when (distance) {
                                        0 -> 1f
                                        1 -> 0.42f
                                        else -> 0.16f
                                    },
                                ),
                            )
                        }
                    }
                }
            }
        }
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall.copy(
                fontWeight = FontWeight.ExtraBold,
            ),
            color = LedgrTheme.colors.textMuted,
        )
    }
}

private fun LazyListState.centeredReminderItemIndex(itemCount: Int): Int {
    if (itemCount <= 0) return 0
    val layoutInfo = layoutInfo
    val viewportCenter = (layoutInfo.viewportStartOffset + layoutInfo.viewportEndOffset) / 2
    return layoutInfo.visibleItemsInfo
        .minByOrNull { item ->
            abs((item.offset + item.size / 2) - viewportCenter)
        }
        ?.index
        ?.coerceIn(0, itemCount - 1)
        ?: firstVisibleItemIndex.coerceIn(0, itemCount - 1)
}

@Composable
private fun HomeRoute(
    teacherUid: String,
    bootstrapSnapshot: TeacherSnapshot,
    onClassClick: (TeacherClass) -> Unit,
    onClassHistoryClick: (TeacherClass) -> Unit,
    onClassSyllabusClick: (TeacherClass) -> Unit,
    classCreateEnabled: Boolean,
    onAddClassClick: () -> Unit,
    modifier: Modifier = Modifier,
    homeViewModel: HomeViewModel = hiltViewModel(),
) {
    val homeState by homeViewModel.state.collectAsStateWithLifecycle()
    val effectiveTeacherUid = homeState.teacherUid.ifBlank { teacherUid }
    val snapshot = homeState.snapshot ?: bootstrapSnapshot
    val publishedSyllabi = homeState.publishedSyllabi
    val todayKey = todayKey()
    val dashboard = remember(snapshot, todayKey) { snapshot.dashboard(todayKey) }

    HomeScreen(
        dashboard = dashboard,
        classes = snapshot.classes,
        entries = snapshot.entries,
        publishedSyllabi = publishedSyllabi,
        teacherUid = effectiveTeacherUid,
        orderStorageKey = effectiveTeacherUid,
        onClassClick = onClassClick,
        onClassHistoryClick = onClassHistoryClick,
        onClassSyllabusClick = onClassSyllabusClick,
        classCreateEnabled = classCreateEnabled,
        onAddClassClick = onAddClassClick,
        modifier = modifier,
    )
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ClassEntryPagerRoute(
    initialClassId: String,
    teacher: AuthenticatedTeacher,
    snapshot: TeacherSnapshot,
    publishedSyllabi: List<com.classtracker.core.model.PublishedSyllabus>,
    entriesByClass: Map<String, List<TeacherEntry>>,
    trashedEntriesByClass: Map<String, List<TeacherTrashedEntry>>,
    createEnabled: Boolean,
    editEnabled: Boolean,
    deleteEnabled: Boolean,
    draftStore: EntryDraftStore,
    todayKey: String,
    onNavigateToClass: (String) -> Unit,
    onEditEntry: (classId: String, entry: TeacherEntry) -> Unit,
    onDuplicateEntry: (classId: String, entry: TeacherEntry) -> Unit,
    onDeleteEntry: (TeacherEntry, TeacherClass) -> Unit,
    onRestoreEntry: (TeacherTrashedEntry) -> Unit,
    onSaved: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val initialPage = snapshot.classes.indexOfFirst { it.id == initialClassId }.coerceAtLeast(0)
    val pagerState = rememberPagerState(initialPage = initialPage) { snapshot.classes.size }
    val scope = rememberCoroutineScope()
    val haptics = rememberLedgrHaptics()
    val context = LocalContext.current
    val entryFlowViewModel: EntryFlowViewModel = hiltViewModel()
    val entryFlowState by entryFlowViewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(teacher.uid, snapshot.revision) {
        entryFlowViewModel.prime(teacher = teacher, snapshot = snapshot)
    }

    LaunchedEffect(entryFlowState.errorMessage) {
        val message = entryFlowState.errorMessage ?: return@LaunchedEffect
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
        entryFlowViewModel.consumeError()
    }

    LaunchedEffect(initialPage, snapshot.classes.size) {
        if (pagerState.currentPage != initialPage) pagerState.scrollToPage(initialPage)
    }

    HorizontalPager(
        state = pagerState,
        userScrollEnabled = false,
        modifier = modifier.fillMaxSize(),
        key = { page -> snapshot.classes[page].id },
        contentPadding = PaddingValues(0.dp),
        pageSpacing = 0.dp,
        beyondViewportPageCount = 1,
        flingBehavior = PagerDefaults.flingBehavior(
            state = pagerState,
            pagerSnapDistance = PagerSnapDistance.atMost(1),
            snapPositionalThreshold = ClassPagerPositionalThreshold,
            snapAnimationSpec = tween(
                durationMillis = ClassPagerSnapMillis,
                easing = FastOutSlowInEasing,
            ),
        ),
    ) { page ->
        val pageClass = snapshot.classes[page]
        val classEntries = entriesByClass[pageClass.id].orEmpty()
        Box(
            modifier = Modifier.fillMaxSize(),
        ) {
            val classTrashedEntries = trashedEntriesByClass[pageClass.id].orEmpty()
            val classSyllabus = publishedSyllabi
                .filter { it.appliesTo(teacher.uid, pageClass.id) }
                .maxByOrNull(com.classtracker.core.model.PublishedSyllabus::version)
            val draftKeyEntryId: String? = null
            val baseDraft = remember(pageClass.id, todayKey) {
                TeacherEntryDraft(
                    mutationId = "native_${UUID.randomUUID()}",
                    classId = pageClass.id,
                    dateKey = todayKey,
                    status = "",
                    timeStart = pageClass.startTime.orEmpty(),
                    timeEnd = pageClass.endTime.orEmpty(),
                )
            }
            val recovered = remember(teacher.uid, pageClass.id, draftKeyEntryId) {
                draftStore.read(
                    uid = teacher.uid,
                    classId = pageClass.id,
                    entryId = draftKeyEntryId,
                )
            }
            val resolvedDraft = remember(recovered, todayKey, pageClass.id) {
                resolveDraftForEntry(
                    baseDraft = baseDraft,
                    recovered = recovered,
                    todayKey = todayKey,
                    allowStaleRecovery = false,
                )
            }
            var draft by remember(teacher.uid, pageClass.id) {
                mutableStateOf(resolvedDraft.draft)
            }
            var editorVisible by rememberSaveable(teacher.uid, pageClass.id) {
                mutableStateOf(true)
            }
            var recoveredDraftVisible by rememberSaveable(teacher.uid, pageClass.id) {
                mutableStateOf(resolvedDraft.recoveredVisible)
            }
            var saveCompletedVisible by rememberSaveable(teacher.uid, pageClass.id) {
                mutableStateOf(false)
            }
            val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
            val keyboardController = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current

            LaunchedEffect(resolvedDraft.clearStoredDraft, teacher.uid, pageClass.id) {
                if (resolvedDraft.clearStoredDraft) {
                    draftStore.clear(
                        uid = teacher.uid,
                        classId = pageClass.id,
                        entryId = draftKeyEntryId,
                    )
                }
            }

            LaunchedEffect(entryFlowState.entrySaved, pageClass.id, pagerState.currentPage) {
                if (entryFlowState.entrySaved && pagerState.currentPage == page) {
                    draftStore.clear(
                        uid = teacher.uid,
                        classId = pageClass.id,
                        entryId = draftKeyEntryId,
                    )
                    focusManager.clearFocus(force = true)
                    keyboardController?.hide()
                    recoveredDraftVisible = false
                    saveCompletedVisible = true
                    delay(EntrySaveSuccessRevealMillis)
                    draft = baseDraft.copy(mutationId = "native_${UUID.randomUUID()}")
                    entryFlowViewModel.consumeEntrySaved()
                    onSaved()
                }
            }

            ClassEntryScreen(
                teacherClass = pageClass,
                entries = classEntries,
                trashedEntries = classTrashedEntries,
                draft = draft,
                saving = entryFlowState.saving,
                saveCompleted = saveCompletedVisible,
                recoveredDraft = recoveredDraftVisible,
                createEnabled = createEnabled,
                editEnabled = editEnabled,
                deleteEnabled = deleteEnabled,
                editorVisible = editorVisible,
                syllabus = classSyllabus,
                onDraftChanged = { updated ->
                    draft = updated
                    draftStore.write(
                        uid = teacher.uid,
                        draft = updated,
                        entryId = draftKeyEntryId,
                    )
                },
                onSave = entryFlowViewModel::saveEntry,
                onAddAnotherEntry = { editorVisible = true },
                onOpenPastEntries = {
                    onNavigateToClass(pageClass.id)
                },
                onOpenPreviousClass = {
                    if (page == pagerState.currentPage && page > 0 && !pagerState.isScrollInProgress) {
                        scope.launch {
                            val targetPage = page - 1
                            pagerState.animateScrollToPage(targetPage)
                            if (pagerState.currentPage == targetPage) {
                                haptics.selection()
                            }
                        }
                    }
                },
                onOpenNextClass = {
                    if (
                        page == pagerState.currentPage &&
                        page < snapshot.classes.lastIndex &&
                        !pagerState.isScrollInProgress
                    ) {
                        scope.launch {
                            val targetPage = page + 1
                            pagerState.animateScrollToPage(targetPage)
                            if (pagerState.currentPage == targetPage) {
                                haptics.selection()
                            }
                        }
                    }
                },
                canSwipeToPreviousClass = page > 0,
                canSwipeToNextClass = page < snapshot.classes.lastIndex,
                onEditEntry = { entry -> onEditEntry(pageClass.id, entry) },
                onDuplicateEntry = { entry -> onDuplicateEntry(pageClass.id, entry) },
                onDeleteEntry = { entry -> onDeleteEntry(entry, pageClass) },
                onRestoreEntry = onRestoreEntry,
            )
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ClassHistoryPagerRoute(
    initialClassId: String,
    snapshot: TeacherSnapshot,
    entriesByClass: Map<String, List<TeacherEntry>>,
    trashedEntriesByClass: Map<String, List<TeacherTrashedEntry>>,
    createEnabled: Boolean,
    editEnabled: Boolean,
    deleteEnabled: Boolean,
    onNavigateToClass: (String) -> Unit,
    onAddEntry: (classId: String, dateKey: String) -> Unit,
    onEditEntry: (classId: String, entry: TeacherEntry) -> Unit,
    onDuplicateEntry: (classId: String, entry: TeacherEntry) -> Unit,
    onDeleteEntry: (TeacherEntry, TeacherClass) -> Unit,
    onRestoreEntry: (TeacherTrashedEntry) -> Unit,
    modifier: Modifier = Modifier,
) {
    val initialPage = snapshot.classes.indexOfFirst { it.id == initialClassId }.coerceAtLeast(0)
    val pagerState = rememberPagerState(initialPage = initialPage) {
        snapshot.classes.size
    }

    LaunchedEffect(initialPage, snapshot.classes.size) {
        if (pagerState.currentPage != initialPage) {
            pagerState.scrollToPage(initialPage)
        }
    }

    HorizontalPager(
        state = pagerState,
        userScrollEnabled = false,
        modifier = modifier.fillMaxSize(),
        key = { page -> snapshot.classes[page].id },
        contentPadding = PaddingValues(horizontal = 8.dp),
        pageSpacing = 10.dp,
        beyondViewportPageCount = 1,
        flingBehavior = PagerDefaults.flingBehavior(
            state = pagerState,
            pagerSnapDistance = PagerSnapDistance.atMost(1),
            snapPositionalThreshold = ClassPagerPositionalThreshold,
            snapAnimationSpec = tween(
                durationMillis = ClassPagerSnapMillis,
                easing = FastOutSlowInEasing,
            ),
        ),
    ) { page ->
        val pageClass = snapshot.classes[page]
        Box(
            modifier = Modifier.fillMaxSize(),
        ) {
            ClassHistoryScreen(
                teacherClass = pageClass,
                entries = entriesByClass[pageClass.id].orEmpty(),
                trashedEntries = trashedEntriesByClass[pageClass.id].orEmpty(),
                createEnabled = createEnabled,
                editEnabled = editEnabled,
                deleteEnabled = deleteEnabled,
                onAddEntry = { dateKey -> onAddEntry(pageClass.id, dateKey) },
                onEditEntry = { teacherEntry -> onEditEntry(pageClass.id, teacherEntry) },
                onDuplicateEntry = { teacherEntry -> onDuplicateEntry(pageClass.id, teacherEntry) },
                onDeleteEntry = { teacherEntry -> onDeleteEntry(teacherEntry, pageClass) },
                onRestoreEntry = onRestoreEntry,
            )
        }
    }
}

@Composable
private fun SyncStatusBanner(
    summary: TeacherSyncSummary,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val failed = summary.failedCount > 0
    val label = when {
        failed -> "${summary.failedCount} ${if (summary.failedCount == 1) "entry needs" else "entries need"} attention"
        summary.syncingCount > 0 -> "Syncing ${summary.syncingCount} ${if (summary.syncingCount == 1) "entry" else "entries"}"
        else -> "${summary.pendingCount} ${if (summary.pendingCount == 1) "entry is" else "entries are"} saved on this device"
    }
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = if (failed) {
            MaterialTheme.colorScheme.errorContainer
        } else {
            MaterialTheme.colorScheme.secondaryContainer
        },
        contentColor = if (failed) {
            MaterialTheme.colorScheme.onErrorContainer
        } else {
            MaterialTheme.colorScheme.onSecondaryContainer
        },
        shape = RoundedCornerShape(8.dp),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            if (failed) {
                OutlinedButton(onClick = onRetry) {
                    Text("Retry")
                }
            }
        }
    }
}

@Composable
private fun EntryEditorRoute(
    teacher: AuthenticatedTeacher,
    snapshot: TeacherSnapshot,
    teacherClass: com.classtracker.core.model.TeacherClass,
    existingEntry: TeacherEntry?,
    initialDateKey: String,
    initialDraft: TeacherEntryDraft? = null,
    existingEntries: List<TeacherEntry>,
    draftStoreEntryId: String? = null,
    draftStore: EntryDraftStore,
    onSaved: () -> Unit,
) {
    val entryId = existingEntry?.id
    val draftKeyEntryId = draftStoreEntryId ?: entryId
    val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
    val keyboardController = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current
    val context = LocalContext.current
    val entryFlowViewModel: EntryFlowViewModel = hiltViewModel()
    val entryFlowState by entryFlowViewModel.state.collectAsStateWithLifecycle()
    val baseDraft = remember(teacherClass.id, entryId, initialDateKey, initialDraft) {
        initialDraft ?: existingEntry?.toDraft() ?: TeacherEntryDraft(
            mutationId = "native_${UUID.randomUUID()}",
            classId = teacherClass.id,
            dateKey = initialDateKey.ifBlank { todayKey() },
            status = "",
            timeStart = teacherClass.startTime.orEmpty(),
            timeEnd = teacherClass.endTime.orEmpty(),
        )
    }
    val recovered = remember(teacher.uid, teacherClass.id, draftKeyEntryId) {
        draftStore.read(
            uid = teacher.uid,
            classId = teacherClass.id,
            entryId = draftKeyEntryId,
        )
    }
    val resolvedDraft = remember(recovered, teacherClass.id, initialDateKey, initialDraft, existingEntry) {
        resolveDraftForEntry(
            baseDraft = baseDraft,
            recovered = recovered,
            todayKey = initialDateKey.ifBlank { todayKey() },
            allowStaleRecovery = existingEntry != null || initialDraft != null,
        )
    }
    var draft by remember(teacher.uid, teacherClass.id, draftKeyEntryId) {
        mutableStateOf(resolvedDraft.draft)
    }

    LaunchedEffect(teacher.uid, snapshot.revision) {
        entryFlowViewModel.prime(teacher = teacher, snapshot = snapshot)
    }

    LaunchedEffect(entryFlowState.errorMessage) {
        val message = entryFlowState.errorMessage ?: return@LaunchedEffect
        Toast.makeText(context, message, Toast.LENGTH_SHORT).show()
        entryFlowViewModel.consumeError()
    }

    LaunchedEffect(resolvedDraft.clearStoredDraft, teacher.uid, teacherClass.id, draftKeyEntryId) {
        if (resolvedDraft.clearStoredDraft) {
            draftStore.clear(
                uid = teacher.uid,
                classId = teacherClass.id,
                entryId = draftKeyEntryId,
            )
        }
    }

    LaunchedEffect(entryFlowState.entrySaved) {
        if (entryFlowState.entrySaved) {
            draftStore.clear(
                uid = teacher.uid,
                classId = teacherClass.id,
                entryId = draftKeyEntryId,
            )
            focusManager.clearFocus(force = true)
            keyboardController?.hide()
            entryFlowViewModel.consumeEntrySaved()
            onSaved()
        }
    }

    EntryEditorScreen(
        teacherClass = teacherClass,
        draft = draft,
        existingEntries = existingEntries,
        saving = entryFlowState.saving,
        recoveredDraft = recovered != null,
        onDraftChanged = { updated ->
            draft = updated
            draftStore.write(
                uid = teacher.uid,
                draft = updated,
                entryId = draftKeyEntryId,
            )
        },
        onSave = entryFlowViewModel::saveEntry,
    )
}

@Composable
private fun MissingClassScreen(
    message: String = "This class is no longer available.",
    onBack: () -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            LedgrEmptyState(
                title = "Entry unavailable",
                message = message,
            )
            Button(onClick = onBack) {
                Text("Back to class")
            }
        }
    }
}

@Composable
private fun FullScreenLoading(
    modifier: Modifier = Modifier,
) {
    val loadingBackground = LedgrTheme.colors.canvas
    val loadingInk = LedgrTheme.colors.loadingInk
    val infiniteTransition = rememberInfiniteTransition(label = "ledgr-loading")
    val wheelRotation by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 24_000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "moon-wheel",
    )
    val phaseProgress by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 7_000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "moon-phases",
    )
    var appeared by remember { mutableStateOf(false) }
    val opacity by animateFloatAsState(
        targetValue = if (appeared) 1f else 0f,
        animationSpec = tween(durationMillis = 1_200, easing = FastOutSlowInEasing),
        label = "loading-fade",
    )
    val scale by animateFloatAsState(
        targetValue = if (appeared) 1f else 0.96f,
        animationSpec = tween(durationMillis = 1_200, easing = FastOutSlowInEasing),
        label = "loading-scale",
    )
    val view = LocalView.current
    val restoreDarkBars = LedgrTheme.isDark

    LaunchedEffect(Unit) {
        appeared = true
    }
    DisposableEffect(view, restoreDarkBars, loadingBackground) {
        val activity = view.context as? ComponentActivity
        val loadingStyle = if (restoreDarkBars) {
            SystemBarStyle.dark(loadingBackground.toArgb())
        } else {
            SystemBarStyle.light(loadingBackground.toArgb(), loadingBackground.toArgb())
        }
        activity?.enableEdgeToEdge(
            statusBarStyle = loadingStyle,
            navigationBarStyle = loadingStyle,
        )
        onDispose {
            val restoredStyle = if (restoreDarkBars) {
                SystemBarStyle.dark(loadingBackground.toArgb())
            } else {
                SystemBarStyle.light(loadingBackground.toArgb(), loadingBackground.toArgb())
            }
            activity?.enableEdgeToEdge(
                statusBarStyle = restoredStyle,
                navigationBarStyle = restoredStyle,
            )
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(loadingBackground)
            .semantics { contentDescription = "Loading Ledgr" },
        contentAlignment = Alignment.Center,
    ) {
        Box(
            modifier = Modifier
                .size(320.dp)
                .graphicsLayer {
                    alpha = opacity
                    scaleX = scale
                    scaleY = scale
                },
            contentAlignment = Alignment.Center,
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val center = center
                val orbitRadius = size.minDimension * 0.375f
                val moonRadius = size.minDimension / 30f
                rotate(degrees = wheelRotation, pivot = center) {
                    repeat(8) { index ->
                        val angle = Math.toRadians(index * 45.0 - 90.0)
                        val moonCenter = androidx.compose.ui.geometry.Offset(
                            x = center.x + orbitRadius * cos(angle).toFloat(),
                            y = center.y + orbitRadius * sin(angle).toFloat(),
                        )
                        val phase = (phaseProgress + index / 8f) % 1f
                        val pulse = sin(PI.toFloat() * phase).coerceAtLeast(0f)
                        drawCircle(
                            color = loadingInk.copy(alpha = 0.22f * pulse),
                            radius = moonRadius * (1f + 0.6f * pulse),
                            center = moonCenter,
                        )
                        drawCircle(
                            color = loadingInk,
                            radius = moonRadius,
                            center = moonCenter,
                        )
                        val clip = Path().apply {
                            addOval(
                                androidx.compose.ui.geometry.Rect(
                                    center = moonCenter,
                                    radius = moonRadius,
                                ),
                            )
                        }
                        clipPath(clip) {
                            drawCircle(
                                color = loadingBackground,
                                radius = moonRadius,
                                center = moonCenter.copy(
                                    x = moonCenter.x + ((phase * 2f) - 1f) * moonRadius * 2f,
                                ),
                            )
                        }
                        drawCircle(
                            color = loadingInk,
                            radius = moonRadius,
                            center = moonCenter,
                            style = androidx.compose.ui.graphics.drawscope.Stroke(
                                width = size.minDimension / 240f,
                            ),
                        )
                    }
                }
            }
            Text(
                text = "ledgr",
                color = loadingInk,
                fontFamily = FontFamily(Font(R.font.sacramento_regular)),
                fontSize = 43.sp,
                fontWeight = FontWeight.Normal,
            )
        }
    }
}

@Composable
private fun FullScreenError(
    message: String,
    onRetry: () -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .padding(24.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            LedgrEmptyState(
                title = "Workspace unavailable",
                message = message,
            )
            Button(onClick = onRetry) {
                Text("Try again")
            }
            OutlinedButton(
                onClick = onSignOut,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            ) {
                Text("Sign out")
            }
        }
    }
}

private fun todayKey(): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

private fun TeacherEntry.toDraft(): TeacherEntryDraft = TeacherEntryDraft(
    entryId = id,
    mutationId = "",
    classId = classId,
    dateKey = dateKey,
    title = title,
    body = body,
    tag = tag,
    status = status,
    timeStart = timeStart.orEmpty(),
    timeEnd = timeEnd.orEmpty(),
    createdAt = createdAt,
    syllabusTemplateId = syllabusTemplateId,
    syllabusVersion = syllabusVersion,
    syllabusChapterId = syllabusChapterId,
    syllabusChapterTitle = syllabusChapterTitle,
    completedSyllabusTopicIds = completedSyllabusTopicIds,
    syllabusChapterCompleted = syllabusChapterCompleted,
)

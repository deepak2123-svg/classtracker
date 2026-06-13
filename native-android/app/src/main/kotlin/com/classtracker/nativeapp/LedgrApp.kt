package com.classtracker.nativeapp

import android.app.Activity
import android.net.Uri
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.PagerDefaults
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
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrLoadingState
import com.classtracker.core.designsystem.LedgrOfflineBanner
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.designsystem.LedgrThemeMode
import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherClass
import com.classtracker.core.model.TeacherClassDraft
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.core.model.TeacherSyncSummary
import com.classtracker.core.model.TeacherTrashedEntry
import com.classtracker.core.model.toDuplicateDraft
import com.classtracker.feature.auth.AuthScreen
import com.classtracker.feature.classes.ClassEntryScreen
import com.classtracker.feature.classes.ClassHistoryScreen
import com.classtracker.feature.classes.StatsScreen
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
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch

private const val ClassEntryRoute = "class-entry/{classId}"
private const val ClassHistoryRoute = "class/{classId}"
private const val RecycleBinRoute = "recycle-bin"
private const val ReportsRoute = "reports"
private const val FeedbackRoute = "feedback"
private const val ClassPagerSnapMillis = 170
private const val AddClassRoute = "add-class"
private const val ManageClassesRoute = "manage-classes"
private const val NewEntryRoute = "entry/new/{classId}/{dateKey}"
private const val EditEntryRoute = "entry/edit/{classId}/{entryId}"
private const val DuplicateEntryRoute = "entry/duplicate/{classId}/{entryId}"
private val HomeCanvas = Color(0xFFEFEEE8)
private val HomeInk = Color(0xFF10204A)

@Composable
private fun appHomeCanvasColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.background else HomeCanvas

@Composable
private fun appHomeInkColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.onSurface else HomeInk

@Composable
private fun appTopButtonSurfaceColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.surfaceVariant else Color.White

@Composable
private fun appTopButtonBorderColor() =
    if (LedgrTheme.isDark) MaterialTheme.colorScheme.outlineVariant else Color(0xFFD4D0C7)

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
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val activity = context as? Activity
    val scope = rememberCoroutineScope()
    val credentialReader = remember(activity) {
        activity?.let(::GoogleCredentialReader)
    }

    when {
        state.checkingSession -> FullScreenLoading(modifier = modifier)

        state.teacher == null -> AuthScreen(
            loading = state.authenticating,
            errorMessage = state.errorMessage,
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
            onClearError = viewModel::clearError,
            modifier = modifier,
        )

        state.snapshot == null && state.loadingData -> FullScreenLoading(
            label = "Loading teacher workspace",
            modifier = modifier,
        )

        state.snapshot == null -> FullScreenError(
            message = state.errorMessage ?: "Teacher data could not be loaded.",
            onRetry = viewModel::refresh,
            onSignOut = viewModel::signOut,
            modifier = modifier,
        )

        else -> TeacherApp(
            teacher = requireNotNull(state.teacher),
            snapshot = requireNotNull(state.snapshot),
            errorMessage = state.errorMessage,
            savingEntry = state.savingEntry,
            savingClass = state.savingClass,
            deletingClassId = state.deletingClassId,
            deletingAllTrashedEntries = state.deletingAllTrashedEntries,
            deletingTrashedEntryId = state.deletingTrashedEntryId,
            deletingAccount = state.deletingAccount,
            entrySaved = state.entrySaved,
            classSaved = state.classSaved,
            syncSummary = state.syncSummary,
            feedbackConversation = state.feedbackConversation,
            feedbackErrorMessage = state.feedbackErrorMessage,
            sendingFeedback = state.sendingFeedback,
            feedbackSent = state.feedbackSent,
            themeMode = themeMode,
            onThemeModeChange = onThemeModeChange,
            reminderPreferences = reminderPreferences,
            onReminderPreferencesChange = onReminderPreferencesChange,
            onClearError = viewModel::clearError,
            onSaveEntry = viewModel::saveEntry,
            onCreateClass = viewModel::createClass,
            onDeleteClass = viewModel::deleteClass,
            onDeleteEntry = viewModel::deleteEntry,
            onRestoreEntry = viewModel::restoreEntry,
            onDeleteAllTrashedEntries = viewModel::deleteAllTrashedEntries,
            onDeleteTrashedEntry = viewModel::deleteTrashedEntry,
            onDeleteAccount = viewModel::deleteAccount,
            onConsumeEntrySaved = viewModel::consumeEntrySaved,
            onConsumeClassSaved = viewModel::consumeClassSaved,
            onRetrySync = viewModel::retrySync,
            onSendFeedback = viewModel::sendFeedback,
            onMarkFeedbackRead = viewModel::markFeedbackRead,
            onConsumeFeedbackSent = viewModel::consumeFeedbackSent,
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
    errorMessage: String?,
    savingEntry: Boolean,
    savingClass: Boolean,
    deletingClassId: String?,
    deletingAllTrashedEntries: Boolean,
    deletingTrashedEntryId: String?,
    deletingAccount: Boolean,
    entrySaved: Boolean,
    classSaved: Boolean,
    syncSummary: TeacherSyncSummary,
    feedbackConversation: com.classtracker.core.model.TeacherFeedbackConversation,
    feedbackErrorMessage: String?,
    sendingFeedback: Boolean,
    feedbackSent: Boolean,
    themeMode: LedgrThemeMode,
    onThemeModeChange: (LedgrThemeMode) -> Unit,
    reminderPreferences: ReminderPreferences,
    onReminderPreferencesChange: (ReminderPreferences) -> Unit,
    onClearError: () -> Unit,
    onSaveEntry: (TeacherEntryDraft) -> Unit,
    onCreateClass: (TeacherClassDraft) -> Unit,
    onDeleteClass: (TeacherClass) -> Unit,
    onDeleteEntry: (TeacherEntry, TeacherClass) -> Unit,
    onRestoreEntry: (TeacherTrashedEntry) -> Unit,
    onDeleteAllTrashedEntries: () -> Unit,
    onDeleteTrashedEntry: (TeacherTrashedEntry) -> Unit,
    onDeleteAccount: () -> Unit,
    onConsumeEntrySaved: () -> Unit,
    onConsumeClassSaved: () -> Unit,
    onRetrySync: () -> Unit,
    onSendFeedback: (String) -> Unit,
    onMarkFeedbackRead: () -> Unit,
    onConsumeFeedbackSent: () -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = backStackEntry?.destination
    val currentRoute = currentDestination?.route
    val isClassEntry = currentRoute == ClassEntryRoute
    val isClassHistory = currentRoute == ClassHistoryRoute
    val isRecycleBin = currentRoute == RecycleBinRoute
    val isReports = currentRoute == ReportsRoute
    val isFeedback = currentRoute == FeedbackRoute
    val isAddClass = currentRoute == AddClassRoute
    val isManageClasses = currentRoute == ManageClassesRoute
    val isEntryEditor = currentRoute == NewEntryRoute ||
        currentRoute == EditEntryRoute ||
        currentRoute == DuplicateEntryRoute
    val isDetailRoute = isClassEntry || isClassHistory || isRecycleBin ||
        isReports || isFeedback || isAddClass || isManageClasses || isEntryEditor
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val draftStore = remember(context) {
        EntryDraftStore(context.applicationContext)
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

    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            onClearError()
        }
    }

    LaunchedEffect(entrySaved, isClassEntry, isEntryEditor) {
        if (entrySaved && !isClassEntry && !isEntryEditor) {
            snackbarHostState.showSnackbar(
                message = "✓ Entry saved successfully",
                duration = androidx.compose.material3.SnackbarDuration.Short,
                withDismissAction = true,
            )
            onConsumeEntrySaved()
        }
    }

    LaunchedEffect(classSaved) {
        if (classSaved) {
            onConsumeClassSaved()
            navController.navigate(AppDestination.Home.route) {
                popUpTo(navController.graph.startDestinationId) {
                    inclusive = false
                    saveState = false
                }
                launchSingleTop = true
            }
            snackbarHostState.showSnackbar(
                message = "✓ Class added successfully",
                duration = androidx.compose.material3.SnackbarDuration.Short,
                withDismissAction = true,
            )
        }
    }

    if (showReminderDialog) {
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
                                NewEntryRoute -> "Add entry"
                                DuplicateEntryRoute -> "Duplicate entry"
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
                            text = "Class detail",
                            style = MaterialTheme.typography.titleLarge,
                        )
                    } else {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Surface(
                                modifier = Modifier.size(44.dp),
                                color = if (LedgrTheme.isDark) {
                                    MaterialTheme.colorScheme.primaryContainer
                                } else {
                                    HomeInk
                                },
                                contentColor = if (LedgrTheme.isDark) {
                                    MaterialTheme.colorScheme.onPrimaryContainer
                                } else {
                                    Color.White
                                },
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
                Surface(
                    color = MaterialTheme.colorScheme.surface,
                    shadowElevation = 8.dp,
                ) {
                    NavigationBar(
                        containerColor = MaterialTheme.colorScheme.surface,
                        tonalElevation = 0.dp,
                    ) {
                        AppDestination.entries.forEach { destination ->
                            val selected = currentDestination
                                ?.hierarchy
                                ?.any { it.route == destination.route } == true

                            NavigationBarItem(
                                selected = selected,
                                onClick = {
                                    navController.navigate(destination.route) {
                                        popUpTo(navController.graph.startDestinationId) {
                                            saveState = true
                                        }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                icon = {
                                    Icon(
                                        imageVector = destination.icon,
                                        contentDescription = destination.label,
                                    )
                                },
                                label = { Text(destination.label) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = MaterialTheme.colorScheme.primary,
                                    selectedTextColor = MaterialTheme.colorScheme.primary,
                                    indicatorColor = MaterialTheme.colorScheme.primaryContainer,
                                    unselectedIconColor = LedgrTheme.colors.textMuted,
                                    unselectedTextColor = LedgrTheme.colors.textMuted,
                                ),
                            )
                        }
                    }
                }
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
            if (syncSummary.hasWork) {
                SyncStatusBanner(
                    summary = syncSummary,
                    onRetry = onRetrySync,
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
                        HomeScreen(
                            dashboard = dashboard,
                            classes = snapshot.classes,
                            entries = snapshot.entries,
                            onClassClick = { teacherClass ->
                                navController.navigate("class-entry/${Uri.encode(teacherClass.id)}")
                            },
                            classCreateEnabled = BuildConfig.NATIVE_CLASS_CREATE_ENABLED,
                            onAddClassClick = {
                                navController.navigate(AddClassRoute)
                            },
                        )
                    }
                    composable(AddClassRoute) {
                        NewClassScreen(
                            availableInstitutes = snapshot.availableInstitutes,
                            availableSectionsByInstitute = snapshot.availableSectionsByInstitute,
                            subjectOptions = snapshot.profile.subjects,
                            saving = savingClass,
                            onSaveClass = { draft ->
                                onCreateClass(draft)
                                scope.launch {
                                    snackbarHostState.showSnackbar(
                                        message = "Adding class...",
                                        duration = androidx.compose.material3.SnackbarDuration.Short,
                                    )
                                }
                                navController.navigate(AppDestination.Home.route) {
                                    popUpTo(navController.graph.startDestinationId) {
                                        inclusive = false
                                    }
                                    launchSingleTop = true
                                }
                            },
                        )
                    }
                    composable(AppDestination.Stats.route) {
                        StatsScreen(
                            classes = snapshot.classes,
                            entries = snapshot.entries,
                            onClassClick = { teacherClass ->
                                navController.navigate("class-entry/${Uri.encode(teacherClass.id)}")
                            },
                        )
                    }
                    composable(AppDestination.Profile.route) {
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
                                navController.navigate(AppDestination.Stats.route) {
                                    popUpTo(navController.graph.startDestinationId) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            onOpenManageClasses = {
                                navController.navigate(ManageClassesRoute)
                            },
                            onOpenReports = {
                                navController.navigate(ReportsRoute)
                            },
                            onOpenRecycleBin = {
                                navController.navigate(RecycleBinRoute)
                            },
                            reminderEnabled = reminderPreferences.enabled,
                            reminderTimeLabel = reminderPreferences.timeLabel,
                            onOpenReminderSettings = {
                                showReminderDialog = true
                            },
                            feedbackUnreadCount = feedbackConversation.unreadByTeacher,
                            onOpenFeedback = {
                                onMarkFeedbackRead()
                                navController.navigate(FeedbackRoute)
                            },
                            onSignOut = onSignOut,
                            deletingAccount = deletingAccount,
                            onDeleteAccount = onDeleteAccount,
                        )
                    }
                    composable(ManageClassesRoute) {
                        ManageClassesScreen(
                            classes = snapshot.classes,
                            entries = snapshot.entries,
                            deletingClassId = deletingClassId,
                            deleteEnabled = BuildConfig.NATIVE_CLASS_DELETE_ENABLED,
                            onDeleteClass = { teacherClass ->
                                onDeleteClass(teacherClass)
                                navController.navigate(AppDestination.Home.route) {
                                    popUpTo(navController.graph.startDestinationId) {
                                        inclusive = false
                                    }
                                    launchSingleTop = true
                                }
                                scope.launch {
                                    snackbarHostState.showSnackbar(
                                        message = "Moving class to recycle bin...",
                                        duration = androidx.compose.material3.SnackbarDuration.Short,
                                    )
                                }
                            },
                        )
                    }
                    composable(RecycleBinRoute) {
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
                    composable(ReportsRoute) {
                        ReportsScreen(
                            snapshot = snapshot,
                            todayKey = todayKey,
                        )
                    }
                    composable(FeedbackRoute) {
                        LaunchedEffect(Unit) {
                            onMarkFeedbackRead()
                        }
                        FeedbackScreen(
                            conversation = feedbackConversation,
                            unavailableMessage = feedbackErrorMessage,
                            sending = sendingFeedback,
                            sent = feedbackSent,
                            onSend = onSendFeedback,
                            onSentConsumed = onConsumeFeedbackSent,
                        )
                    }
                    composable(ClassEntryRoute) { entry ->
                        val classId = Uri.decode(entry.arguments?.getString("classId").orEmpty())
                        val teacherClass = classesById[classId]
                        if (teacherClass == null) {
                            FullScreenError(
                                message = "This class is no longer available.",
                                onRetry = { navController.navigateUp() },
                                onSignOut = onSignOut,
                            )
                        } else {
                            ClassEntryPagerRoute(
                                initialClassId = classId,
                                teacher = teacher,
                                snapshot = snapshot,
                                entriesByClass = entriesByClass,
                                trashedEntriesByClass = trashedEntriesByClass,
                                createEnabled = BuildConfig.NATIVE_ENTRY_CREATE_ENABLED,
                                editEnabled = BuildConfig.NATIVE_ENTRY_EDIT_ENABLED,
                                deleteEnabled = BuildConfig.NATIVE_ENTRY_DELETE_ENABLED,
                                savingEntry = savingEntry,
                                entrySaved = entrySaved,
                                draftStore = draftStore,
                                todayKey = todayKey,
                                onNavigateToClass = { targetClassId ->
                                    navController.navigate(
                                        "class-entry/${Uri.encode(targetClassId)}",
                                    ) {
                                        popUpTo(ClassEntryRoute) { inclusive = true }
                                        launchSingleTop = true
                                    }
                                },
                                onEditEntry = { targetClassId, teacherEntry ->
                                    navController.navigate(
                                        "entry/edit/${Uri.encode(targetClassId)}/${Uri.encode(teacherEntry.id)}",
                                    )
                                },
                                onDuplicateEntry = { targetClassId, teacherEntry ->
                                    navController.navigate(
                                        "entry/duplicate/${Uri.encode(targetClassId)}/${Uri.encode(teacherEntry.id)}",
                                    )
                                },
                                onDeleteEntry = onDeleteEntry,
                                onRestoreEntry = onRestoreEntry,
                                onSaveEntry = onSaveEntry,
                                onConsumeEntrySaved = onConsumeEntrySaved,
                            )
                        }
                    }
                    composable(ClassHistoryRoute) { entry ->
                        val classId = Uri.decode(entry.arguments?.getString("classId").orEmpty())
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
                                    navController.navigate(
                                        "class/${Uri.encode(targetClassId)}",
                                    ) {
                                        popUpTo(ClassHistoryRoute) {
                                            inclusive = true
                                        }
                                        launchSingleTop = true
                                    }
                                },
                                onAddEntry = { targetClassId, dateKey ->
                                    navController.navigate(
                                        "entry/new/${Uri.encode(targetClassId)}/${Uri.encode(dateKey)}",
                                    )
                                },
                                onEditEntry = { targetClassId, teacherEntry ->
                                    navController.navigate(
                                        "entry/edit/${Uri.encode(targetClassId)}/" +
                                            Uri.encode(teacherEntry.id),
                                    )
                                },
                                onDuplicateEntry = { targetClassId, teacherEntry ->
                                    navController.navigate(
                                        "entry/duplicate/${Uri.encode(targetClassId)}/" +
                                            Uri.encode(teacherEntry.id),
                                    )
                                },
                                onDeleteEntry = onDeleteEntry,
                                onRestoreEntry = onRestoreEntry,
                            )
                        }
                    }
                    composable(NewEntryRoute) { entry ->
                        val classId = Uri.decode(
                            entry.arguments?.getString("classId").orEmpty(),
                        )
                        val dateKey = Uri.decode(
                            entry.arguments?.getString("dateKey").orEmpty(),
                        ).ifBlank { todayKey() }
                        val teacherClass = classesById[classId]
                        if (teacherClass == null) {
                            MissingClassScreen(
                                onBack = navController::navigateUp,
                            )
                        } else {
                            EntryEditorRoute(
                                teacher = teacher,
                                teacherClass = teacherClass,
                                existingEntry = null,
                                initialDateKey = dateKey,
                                existingEntries = entriesByClass[classId].orEmpty(),
                                saving = savingEntry,
                                entrySaved = entrySaved,
                                draftStore = draftStore,
                                onSaveEntry = onSaveEntry,
                                onConsumeEntrySaved = onConsumeEntrySaved,
                                onSaved = { navController.navigateUp() },
                            )
                        }
                    }
                    composable(DuplicateEntryRoute) { entry ->
                        val classId = Uri.decode(
                            entry.arguments?.getString("classId").orEmpty(),
                        )
                        val entryId = Uri.decode(
                            entry.arguments?.getString("entryId").orEmpty(),
                        )
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
                                teacherClass = teacherClass,
                                existingEntry = null,
                                initialDateKey = sourceEntry.dateKey,
                                initialDraft = duplicateDraft,
                                existingEntries = classEntries,
                                draftStoreEntryId = "duplicate-${sourceEntry.id}",
                                saving = savingEntry,
                                entrySaved = entrySaved,
                                draftStore = draftStore,
                                onSaveEntry = onSaveEntry,
                                onConsumeEntrySaved = onConsumeEntrySaved,
                                onSaved = { navController.navigateUp() },
                            )
                        }
                    }
                    composable(EditEntryRoute) { entry ->
                        val classId = Uri.decode(
                            entry.arguments?.getString("classId").orEmpty(),
                        )
                        val entryId = Uri.decode(
                            entry.arguments?.getString("entryId").orEmpty(),
                        )
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
                                teacherClass = teacherClass,
                                existingEntry = existingEntry,
                                initialDateKey = existingEntry.dateKey,
                                existingEntries = classEntries,
                                saving = savingEntry,
                                entrySaved = entrySaved,
                                draftStore = draftStore,
                                onSaveEntry = onSaveEntry,
                                onConsumeEntrySaved = onConsumeEntrySaved,
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
private fun ReminderSetupDialog(
    preferences: ReminderPreferences,
    firstRun: Boolean,
    onDismiss: () -> Unit,
    onSave: (ReminderPreferences) -> Unit,
) {
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
                            onSave(preferences.copy(prompted = true, enabled = false))
                        },
                    ) {
                        Text("Turn off")
                    }
                }
                TextButton(onClick = onDismiss) {
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
            color = if (LedgrTheme.isDark) Color(0xFF151925) else Color.White,
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
                            if (LedgrTheme.isDark) {
                                Color.White.copy(alpha = 0.08f)
                            } else {
                                Color(0xFFF1F1F1)
                            },
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

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ClassEntryPagerRoute(
    initialClassId: String,
    teacher: AuthenticatedTeacher,
    snapshot: TeacherSnapshot,
    entriesByClass: Map<String, List<TeacherEntry>>,
    trashedEntriesByClass: Map<String, List<TeacherTrashedEntry>>,
    createEnabled: Boolean,
    editEnabled: Boolean,
    deleteEnabled: Boolean,
    savingEntry: Boolean,
    entrySaved: Boolean,
    draftStore: EntryDraftStore,
    todayKey: String,
    onNavigateToClass: (String) -> Unit,
    onEditEntry: (classId: String, entry: TeacherEntry) -> Unit,
    onDuplicateEntry: (classId: String, entry: TeacherEntry) -> Unit,
    onDeleteEntry: (TeacherEntry, TeacherClass) -> Unit,
    onRestoreEntry: (TeacherTrashedEntry) -> Unit,
    onSaveEntry: (TeacherEntryDraft) -> Unit,
    onConsumeEntrySaved: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val initialPage = snapshot.classes.indexOfFirst { it.id == initialClassId }.coerceAtLeast(0)
    val pagerState = rememberPagerState(initialPage = initialPage) { snapshot.classes.size }
    val classIds = remember(snapshot.classes) { snapshot.classes.map(TeacherClass::id) }
    val recoveredDraftsByClass = remember(teacher.uid, classIds) {
        classIds.associateWith { classId ->
            draftStore.read(
                uid = teacher.uid,
                classId = classId,
                entryId = null,
            )
        }
    }

    LaunchedEffect(initialPage, snapshot.classes.size) {
        if (pagerState.currentPage != initialPage) pagerState.scrollToPage(initialPage)
    }

    HorizontalPager(
        state = pagerState,
        modifier = modifier.fillMaxSize(),
        key = { page -> snapshot.classes[page].id },
        contentPadding = PaddingValues(0.dp),
        pageSpacing = 0.dp,
        beyondViewportPageCount = 1,
        flingBehavior = PagerDefaults.flingBehavior(
            state = pagerState,
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
            val recovered = recoveredDraftsByClass[pageClass.id]
            var draft by remember(teacher.uid, pageClass.id) {
                mutableStateOf(recovered?.draft ?: baseDraft)
            }
            var editorVisible by rememberSaveable(teacher.uid, pageClass.id) {
                mutableStateOf(true)
            }
            var recoveredDraftVisible by rememberSaveable(teacher.uid, pageClass.id) {
                mutableStateOf(recovered != null)
            }
            val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
            val keyboardController = androidx.compose.ui.platform.LocalSoftwareKeyboardController.current

            LaunchedEffect(entrySaved, pageClass.id, pagerState.currentPage) {
                if (entrySaved && pagerState.currentPage == page) {
                    draftStore.clear(
                        uid = teacher.uid,
                        classId = pageClass.id,
                        entryId = draftKeyEntryId,
                    )
                    draft = baseDraft.copy(mutationId = "native_${UUID.randomUUID()}")
                    focusManager.clearFocus(force = true)
                    keyboardController?.hide()
                    recoveredDraftVisible = false
                    editorVisible = false
                    onConsumeEntrySaved()
                }
            }

            ClassEntryScreen(
                teacherClass = pageClass,
                entries = classEntries,
                trashedEntries = classTrashedEntries,
                draft = draft,
                saving = savingEntry,
                recoveredDraft = recoveredDraftVisible,
                createEnabled = createEnabled,
                editEnabled = editEnabled,
                deleteEnabled = deleteEnabled,
                editorVisible = editorVisible,
                onDraftChanged = { updated ->
                    draft = updated
                    draftStore.write(
                        uid = teacher.uid,
                        draft = updated,
                        entryId = draftKeyEntryId,
                    )
                },
                onSave = onSaveEntry,
                onAddAnotherEntry = { editorVisible = true },
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
        modifier = modifier.fillMaxSize(),
        key = { page -> snapshot.classes[page].id },
        contentPadding = PaddingValues(horizontal = 8.dp),
        pageSpacing = 10.dp,
        beyondViewportPageCount = 1,
        flingBehavior = PagerDefaults.flingBehavior(
            state = pagerState,
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
    teacherClass: com.classtracker.core.model.TeacherClass,
    existingEntry: TeacherEntry?,
    initialDateKey: String,
    initialDraft: TeacherEntryDraft? = null,
    existingEntries: List<TeacherEntry>,
    draftStoreEntryId: String? = null,
    saving: Boolean,
    entrySaved: Boolean,
    draftStore: EntryDraftStore,
    onSaveEntry: (TeacherEntryDraft) -> Unit,
    onConsumeEntrySaved: () -> Unit,
    onSaved: () -> Unit,
) {
    val entryId = existingEntry?.id
    val draftKeyEntryId = draftStoreEntryId ?: entryId
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
    var draft by remember(teacher.uid, teacherClass.id, draftKeyEntryId) {
        mutableStateOf(recovered?.draft ?: baseDraft)
    }

    LaunchedEffect(entrySaved) {
        if (entrySaved) {
            draftStore.clear(
                uid = teacher.uid,
                classId = teacherClass.id,
                entryId = draftKeyEntryId,
            )
            onConsumeEntrySaved()
            onSaved()
        }
    }

    EntryEditorScreen(
        teacherClass = teacherClass,
        draft = draft,
        existingEntries = existingEntries,
        saving = saving,
        recoveredDraft = recovered != null,
        onDraftChanged = { updated ->
            draft = updated
            draftStore.write(
                uid = teacher.uid,
                draft = updated,
                entryId = draftKeyEntryId,
            )
        },
        onSave = onSaveEntry,
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
    label: String = "Starting Ledgr",
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        LedgrLoadingState(label = label)
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
)

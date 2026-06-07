package com.classtracker.nativeapp

import android.app.Activity
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.NotificationsNone
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
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.classtracker.core.designsystem.LedgrBrandMark
import com.classtracker.core.designsystem.LedgrEmptyState
import com.classtracker.core.designsystem.LedgrLoadingState
import com.classtracker.core.designsystem.LedgrOfflineBanner
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.designsystem.LedgrThemeMode
import com.classtracker.core.model.AuthenticatedTeacher
import com.classtracker.core.model.TeacherEntry
import com.classtracker.core.model.TeacherEntryDraft
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.feature.auth.AuthScreen
import com.classtracker.feature.classes.ClassHistoryScreen
import com.classtracker.feature.classes.StatsScreen
import com.classtracker.feature.entries.EntryEditorScreen
import com.classtracker.feature.profile.ProfileScreen
import com.classtracker.feature.today.HomeScreen
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import kotlinx.coroutines.launch

private const val ClassHistoryRoute = "class/{classId}"
private const val NewEntryRoute = "entry/new/{classId}"
private const val EditEntryRoute = "entry/edit/{classId}/{entryId}"

@Composable
fun LedgrApp(
    viewModel: MainViewModel,
    environment: String,
    googleWebClientId: String,
    googleSignInConfigured: Boolean,
    themeMode: LedgrThemeMode,
    onThemeModeChange: (LedgrThemeMode) -> Unit,
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
            entrySaved = state.entrySaved,
            themeMode = themeMode,
            onThemeModeChange = onThemeModeChange,
            onClearError = viewModel::clearError,
            onSaveEntry = viewModel::saveEntry,
            onConsumeEntrySaved = viewModel::consumeEntrySaved,
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
    entrySaved: Boolean,
    themeMode: LedgrThemeMode,
    onThemeModeChange: (LedgrThemeMode) -> Unit,
    onClearError: () -> Unit,
    onSaveEntry: (TeacherEntryDraft) -> Unit,
    onConsumeEntrySaved: () -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = backStackEntry?.destination
    val currentRoute = currentDestination?.route
    val isClassHistory = currentRoute == ClassHistoryRoute
    val isEntryEditor = currentRoute == NewEntryRoute || currentRoute == EditEntryRoute
    val isDetailRoute = isClassHistory || isEntryEditor
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val draftStore = remember(context) {
        EntryDraftStore(context.applicationContext)
    }
    val todayKey = todayKey()
    val dashboard = snapshot.dashboard(todayKey)

    LaunchedEffect(errorMessage) {
        errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            onClearError()
        }
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
                            text = if (currentRoute == NewEntryRoute) {
                                "Add entry"
                            } else {
                                "Edit entry"
                            },
                            style = MaterialTheme.typography.titleLarge,
                        )
                    } else if (isClassHistory) {
                        Text(
                            text = "Class history",
                            style = MaterialTheme.typography.titleLarge,
                        )
                    } else {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            LedgrBrandMark(size = 40)
                            Text(
                                text = "Ledgr",
                                style = MaterialTheme.typography.titleLarge.copy(
                                    fontSize = 22.sp,
                                    lineHeight = 24.sp,
                                ),
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                },
                navigationIcon = {
                    if (isDetailRoute) {
                        IconButton(onClick = navController::navigateUp) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                                contentDescription = "Back",
                            )
                        }
                    }
                },
                actions = {
                    if (!isDetailRoute) {
                        Surface(
                            modifier = Modifier
                                .padding(end = 12.dp)
                                .size(40.dp),
                            color = MaterialTheme.colorScheme.surface,
                            contentColor = LedgrTheme.colors.textMuted,
                            shape = RoundedCornerShape(14.dp),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
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
                                    modifier = Modifier.size(20.dp),
                                )
                            }
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface,
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
                                navController.navigate("class/${Uri.encode(teacherClass.id)}")
                            },
                        )
                    }
                    composable(AppDestination.Stats.route) {
                        StatsScreen(
                            classes = snapshot.classes,
                            entries = snapshot.entries,
                            onClassClick = { teacherClass ->
                                navController.navigate("class/${Uri.encode(teacherClass.id)}")
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
                            onSignOut = onSignOut,
                        )
                    }
                    composable(ClassHistoryRoute) { entry ->
                        val classId = Uri.decode(entry.arguments?.getString("classId").orEmpty())
                        val teacherClass = snapshot.classes.firstOrNull { it.id == classId }
                        if (teacherClass == null) {
                            FullScreenError(
                                message = "This class is no longer available.",
                                onRetry = { navController.navigateUp() },
                                onSignOut = onSignOut,
                            )
                        } else {
                            ClassHistoryScreen(
                                teacherClass = teacherClass,
                                entries = snapshot.entriesForClass(classId),
                                createEnabled = BuildConfig.NATIVE_ENTRY_CREATE_ENABLED,
                                editEnabled = BuildConfig.NATIVE_ENTRY_EDIT_ENABLED,
                                onAddEntry = {
                                    navController.navigate(
                                        "entry/new/${Uri.encode(classId)}",
                                    )
                                },
                                onEditEntry = { teacherEntry ->
                                    navController.navigate(
                                        "entry/edit/${Uri.encode(classId)}/" +
                                            Uri.encode(teacherEntry.id),
                                    )
                                },
                            )
                        }
                    }
                    composable(NewEntryRoute) { entry ->
                        val classId = Uri.decode(
                            entry.arguments?.getString("classId").orEmpty(),
                        )
                        val teacherClass = snapshot.classes.firstOrNull { it.id == classId }
                        if (teacherClass == null) {
                            MissingClassScreen(
                                onBack = navController::navigateUp,
                            )
                        } else {
                            EntryEditorRoute(
                                teacher = teacher,
                                teacherClass = teacherClass,
                                existingEntry = null,
                                existingEntries = snapshot.entriesForClass(classId),
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
                        val teacherClass = snapshot.classes.firstOrNull { it.id == classId }
                        val existingEntry = snapshot.entriesForClass(classId)
                            .firstOrNull { it.id == entryId }
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
                                existingEntries = snapshot.entriesForClass(classId),
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
private fun EntryEditorRoute(
    teacher: AuthenticatedTeacher,
    teacherClass: com.classtracker.core.model.TeacherClass,
    existingEntry: TeacherEntry?,
    existingEntries: List<TeacherEntry>,
    saving: Boolean,
    entrySaved: Boolean,
    draftStore: EntryDraftStore,
    onSaveEntry: (TeacherEntryDraft) -> Unit,
    onConsumeEntrySaved: () -> Unit,
    onSaved: () -> Unit,
) {
    val entryId = existingEntry?.id
    val baseDraft = remember(teacherClass.id, entryId) {
        existingEntry?.toDraft() ?: TeacherEntryDraft(
            mutationId = "native_${UUID.randomUUID()}",
            classId = teacherClass.id,
            dateKey = todayKey(),
            status = "",
            timeStart = teacherClass.startTime.orEmpty(),
            timeEnd = teacherClass.endTime.orEmpty(),
        )
    }
    val recovered = remember(teacher.uid, teacherClass.id, entryId) {
        draftStore.read(
            uid = teacher.uid,
            classId = teacherClass.id,
            entryId = entryId,
        )
    }
    var draft by remember(teacher.uid, teacherClass.id, entryId) {
        mutableStateOf(recovered?.draft ?: baseDraft)
    }

    LaunchedEffect(entrySaved) {
        if (entrySaved) {
            draftStore.clear(
                uid = teacher.uid,
                classId = teacherClass.id,
                entryId = entryId,
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
            draftStore.write(teacher.uid, updated)
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

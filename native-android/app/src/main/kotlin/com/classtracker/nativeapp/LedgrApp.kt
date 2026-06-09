package com.classtracker.nativeapp

import android.app.Activity
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
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
import androidx.compose.runtime.snapshotFlow
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
import com.classtracker.core.model.TeacherClass
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
import com.classtracker.feature.profile.RecycleBinScreen
import com.classtracker.feature.today.HomeScreen
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch

private const val ClassEntryRoute = "class-entry/{classId}"
private const val ClassHistoryRoute = "class/{classId}"
private const val RecycleBinRoute = "recycle-bin"
private const val NewEntryRoute = "entry/new/{classId}/{dateKey}"
private const val EditEntryRoute = "entry/edit/{classId}/{entryId}"
private const val DuplicateEntryRoute = "entry/duplicate/{classId}/{entryId}"

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
            syncSummary = state.syncSummary,
            themeMode = themeMode,
            onThemeModeChange = onThemeModeChange,
            onClearError = viewModel::clearError,
            onSaveEntry = viewModel::saveEntry,
            onDeleteEntry = viewModel::deleteEntry,
            onRestoreEntry = viewModel::restoreEntry,
            onConsumeEntrySaved = viewModel::consumeEntrySaved,
            onRetrySync = viewModel::retrySync,
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
    syncSummary: TeacherSyncSummary,
    themeMode: LedgrThemeMode,
    onThemeModeChange: (LedgrThemeMode) -> Unit,
    onClearError: () -> Unit,
    onSaveEntry: (TeacherEntryDraft) -> Unit,
    onDeleteEntry: (TeacherEntry, TeacherClass) -> Unit,
    onRestoreEntry: (TeacherTrashedEntry) -> Unit,
    onConsumeEntrySaved: () -> Unit,
    onRetrySync: () -> Unit,
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
    val isEntryEditor = currentRoute == NewEntryRoute ||
        currentRoute == EditEntryRoute ||
        currentRoute == DuplicateEntryRoute
    val isDetailRoute = isClassEntry || isClassHistory || isRecycleBin || isEntryEditor
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

    LaunchedEffect(entrySaved) {
        if (entrySaved) {
            snackbarHostState.showSnackbar(
                message = "✓ Entry saved successfully",
                duration = androidx.compose.material3.SnackbarDuration.Short,
                withDismissAction = true,
            )
            onConsumeEntrySaved()
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
                            onOpenRecycleBin = {
                                navController.navigate(RecycleBinRoute)
                            },
                            onSignOut = onSignOut,
                        )
                    }
                    composable(RecycleBinRoute) {
                        RecycleBinScreen(
                            trashedEntries = snapshot.trashedEntries,
                            onRestoreEntry = onRestoreEntry,
                        )
                    }
                    composable(ClassEntryRoute) { entry ->
                        val classId = Uri.decode(entry.arguments?.getString("classId").orEmpty())
                        val teacherClass = snapshot.classes.firstOrNull { it.id == classId }
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
                        val teacherClass = snapshot.classes.firstOrNull { it.id == classId }
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
                                initialDateKey = dateKey,
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
                    composable(DuplicateEntryRoute) { entry ->
                        val classId = Uri.decode(
                            entry.arguments?.getString("classId").orEmpty(),
                        )
                        val entryId = Uri.decode(
                            entry.arguments?.getString("entryId").orEmpty(),
                        )
                        val teacherClass = snapshot.classes.firstOrNull { it.id == classId }
                        val sourceEntry = snapshot.entriesForClass(classId)
                            .firstOrNull { it.id == entryId }
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
                                existingEntries = snapshot.entriesForClass(classId),
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
                                initialDateKey = existingEntry.dateKey,
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

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ClassEntryPagerRoute(
    initialClassId: String,
    teacher: AuthenticatedTeacher,
    snapshot: TeacherSnapshot,
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

    LaunchedEffect(initialPage, snapshot.classes.size) {
        if (pagerState.currentPage != initialPage) pagerState.scrollToPage(initialPage)
    }

    LaunchedEffect(pagerState, snapshot.classes, initialClassId) {
        snapshotFlow { pagerState.settledPage }
            .distinctUntilChanged()
            .collect { page ->
                val targetClassId = snapshot.classes.getOrNull(page)?.id
                if (targetClassId != null && targetClassId != initialClassId) {
                    onNavigateToClass(targetClassId)
                }
            }
    }

    HorizontalPager(
        state = pagerState,
        modifier = modifier.fillMaxSize(),
        key = { page -> snapshot.classes[page].id },
        beyondViewportPageCount = 1,
    ) { page ->
        val pageClass = snapshot.classes[page]
        val classEntries = snapshot.entriesForClass(pageClass.id)
        val classTrashedEntries = snapshot.trashedEntriesForClass(pageClass.id)
        val draftKeyEntryId: String? = null
        val baseDraft = remember(pageClass.id) {
            TeacherEntryDraft(
                mutationId = "native_${UUID.randomUUID()}",
                classId = pageClass.id,
                dateKey = todayKey,
                status = "",
                timeStart = pageClass.startTime.orEmpty(),
                timeEnd = pageClass.endTime.orEmpty(),
            )
        }
        val recovered = remember(teacher.uid, pageClass.id) {
            draftStore.read(
                uid = teacher.uid,
                classId = pageClass.id,
                entryId = draftKeyEntryId,
            )
        }
        var draft by remember(teacher.uid, pageClass.id) {
            mutableStateOf(recovered?.draft ?: baseDraft)
        }

        LaunchedEffect(entrySaved, pageClass.id) {
            if (entrySaved) {
                draftStore.clear(
                    uid = teacher.uid,
                    classId = pageClass.id,
                    entryId = draftKeyEntryId,
                )
                draft = baseDraft.copy(mutationId = "native_${UUID.randomUUID()}")
            }
        }

        ClassEntryScreen(
            teacherClass = pageClass,
            entries = classEntries,
            trashedEntries = classTrashedEntries,
            draft = draft,
            saving = savingEntry,
            recoveredDraft = recovered != null,
            createEnabled = createEnabled,
            editEnabled = editEnabled,
            deleteEnabled = deleteEnabled,
            onDraftChanged = { updated ->
                draft = updated
                draftStore.write(
                    uid = teacher.uid,
                    draft = updated,
                    entryId = draftKeyEntryId,
                )
            },
            onSave = onSaveEntry,
            onEditEntry = { entry -> onEditEntry(pageClass.id, entry) },
            onDuplicateEntry = { entry -> onDuplicateEntry(pageClass.id, entry) },
            onDeleteEntry = { entry -> onDeleteEntry(entry, pageClass) },
            onRestoreEntry = onRestoreEntry,
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ClassHistoryPagerRoute(
    initialClassId: String,
    snapshot: TeacherSnapshot,
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

    LaunchedEffect(pagerState, snapshot.classes, initialClassId) {
        snapshotFlow { pagerState.settledPage }
            .distinctUntilChanged()
            .collect { page ->
                val targetClassId = snapshot.classes.getOrNull(page)?.id
                if (targetClassId != null && targetClassId != initialClassId) {
                    onNavigateToClass(targetClassId)
                }
            }
    }

    HorizontalPager(
        state = pagerState,
        modifier = modifier.fillMaxSize(),
        key = { page -> snapshot.classes[page].id },
        beyondViewportPageCount = 1,
    ) { page ->
        val pageClass = snapshot.classes[page]
        ClassHistoryScreen(
            teacherClass = pageClass,
            entries = snapshot.entriesForClass(pageClass.id),
            trashedEntries = snapshot.trashedEntriesForClass(pageClass.id),
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
                fontWeight = FontWeight.SemiBold,
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

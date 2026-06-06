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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.Badge
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
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
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
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
import com.classtracker.core.model.TeacherSnapshot
import com.classtracker.feature.auth.AuthScreen
import com.classtracker.feature.classes.ClassHistoryScreen
import com.classtracker.feature.classes.ClassesScreen
import com.classtracker.feature.profile.ProfileScreen
import com.classtracker.feature.today.TodayScreen
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlinx.coroutines.launch

private const val ClassHistoryRoute = "class/{classId}"

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
            snapshot = requireNotNull(state.snapshot),
            environment = environment,
            refreshing = state.refreshing,
            errorMessage = state.errorMessage,
            themeMode = themeMode,
            onThemeModeChange = onThemeModeChange,
            onRefresh = viewModel::refresh,
            onClearError = viewModel::clearError,
            onSignOut = viewModel::signOut,
            modifier = modifier,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TeacherApp(
    snapshot: TeacherSnapshot,
    environment: String,
    refreshing: Boolean,
    errorMessage: String?,
    themeMode: LedgrThemeMode,
    onThemeModeChange: (LedgrThemeMode) -> Unit,
    onRefresh: () -> Unit,
    onClearError: () -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentDestination = backStackEntry?.destination
    val currentRoute = currentDestination?.route
    val isClassHistory = currentRoute == ClassHistoryRoute
    val isBeta = environment.equals("beta", ignoreCase = true)
    val snackbarHostState = remember { SnackbarHostState() }
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
                    if (isClassHistory) {
                        Text(
                            text = "Class history",
                            style = MaterialTheme.typography.titleLarge,
                        )
                    } else {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            LedgrBrandMark(size = 34)
                            Column {
                                Text(
                                    text = "Ledgr",
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.ExtraBold,
                                )
                                Text(
                                    text = "Teacher workspace",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = LedgrTheme.colors.textMuted,
                                )
                            }
                        }
                    }
                },
                navigationIcon = {
                    if (isClassHistory) {
                        IconButton(onClick = navController::navigateUp) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                                contentDescription = "Back",
                            )
                        }
                    }
                },
                actions = {
                    if (!isClassHistory) {
                        IconButton(
                            onClick = onRefresh,
                            enabled = !refreshing,
                        ) {
                            if (refreshing) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    strokeWidth = 2.dp,
                                )
                            } else {
                                Icon(
                                    imageVector = Icons.Outlined.Refresh,
                                    contentDescription = "Refresh teacher data",
                                )
                            }
                        }
                    }
                    if (isBeta) {
                        Badge(
                            containerColor = MaterialTheme.colorScheme.primaryContainer,
                            contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.padding(end = 12.dp),
                        ) {
                            Text(
                                text = "BETA",
                                modifier = Modifier.padding(horizontal = 6.dp),
                            )
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
            if (!isClassHistory) {
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
                    startDestination = AppDestination.Today.route,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    composable(AppDestination.Today.route) {
                        TodayScreen(dashboard = dashboard)
                    }
                    composable(AppDestination.Classes.route) {
                        ClassesScreen(
                            classes = snapshot.classes,
                            entryCount = { classId -> snapshot.entriesForClass(classId).size },
                            hasEntryToday = { classId ->
                                snapshot.entries.any {
                                    it.classId == classId && it.dateKey == todayKey
                                }
                            },
                            onClassClick = { teacherClass ->
                                navController.navigate("class/${Uri.encode(teacherClass.id)}")
                            },
                        )
                    }
                    composable(AppDestination.Profile.route) {
                        ProfileScreen(
                            profile = snapshot.profile,
                            environmentLabel = environment.replaceFirstChar { it.uppercase() },
                            revision = snapshot.revision,
                            loggedToday = dashboard.loggedClassCountToday,
                            monthEntries = dashboard.entryCountThisMonth,
                            activeClasses = dashboard.classCount,
                            instituteCount = dashboard.instituteCount,
                            themeMode = themeMode,
                            onThemeModeChange = onThemeModeChange,
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
                            )
                        }
                    }
                }
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

package com.classtracker.nativeapp

import android.app.Activity
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.Icons
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
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
                    Text(
                        text = if (isClassHistory) "Class history" else "Ledgr",
                        fontWeight = FontWeight.Bold,
                    )
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
                                    modifier = Modifier.padding(10.dp),
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
                NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
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
                        )
                    }
                }
            }
        },
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = AppDestination.Today.route,
            modifier = Modifier.padding(innerPadding),
        ) {
            composable(AppDestination.Today.route) {
                TodayScreen(
                    dashboard = snapshot.dashboard(todayKey()),
                )
            }
            composable(AppDestination.Classes.route) {
                ClassesScreen(
                    classes = snapshot.classes,
                    entryCount = { classId -> snapshot.entriesForClass(classId).size },
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

@Composable
private fun FullScreenLoading(
    modifier: Modifier = Modifier,
    label: String = "Starting Ledgr",
) {
    Box(
        modifier = modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            CircularProgressIndicator()
            Text(
                text = label,
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
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
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(
                text = message,
                style = MaterialTheme.typography.bodyLarge,
            )
            Button(onClick = onRetry) {
                Text("Try again")
            }
            Button(onClick = onSignOut) {
                Text("Sign out")
            }
        }
    }
}

private fun todayKey(): String =
    SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

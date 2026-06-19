package com.classtracker.nativeapp

import android.Manifest
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalView
import androidx.core.content.ContextCompat
import android.content.pm.PackageManager
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.designsystem.LedgrThemeMode
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            val themeStore = remember { ThemePreferenceStore(this) }
            val reminderStore = remember { ReminderPreferenceStore(this) }
            var themeMode by remember { mutableStateOf(themeStore.read()) }
            var reminderPreferences by remember { mutableStateOf(reminderStore.read()) }
            var pendingReminderPreferences by remember {
                mutableStateOf<ReminderPreferences?>(null)
            }
            fun persistReminderPreferences(value: ReminderPreferences) {
                reminderPreferences = value
                reminderStore.write(value)
                DailyReminderScheduler.apply(this, value)
            }
            val notificationPermissionLauncher = rememberLauncherForActivityResult(
                ActivityResultContracts.RequestPermission(),
            ) { granted ->
                pendingReminderPreferences?.let { pending ->
                    persistReminderPreferences(
                        if (granted) pending else pending.copy(enabled = false),
                    )
                }
                pendingReminderPreferences = null
            }
            fun saveReminderPreferences(value: ReminderPreferences) {
                val updated = value.copy(prompted = true)
                val needsPermission = updated.enabled &&
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                    ContextCompat.checkSelfPermission(
                        this,
                        Manifest.permission.POST_NOTIFICATIONS,
                    ) != PackageManager.PERMISSION_GRANTED
                if (needsPermission) {
                    pendingReminderPreferences = updated
                    notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                } else {
                    persistReminderPreferences(updated)
                }
            }

            LedgrTheme(themeMode = themeMode) {
                ApplySystemBarContrast(themeMode)
                LedgrApp(
                    viewModel = viewModel,
                    environment = BuildConfig.ENVIRONMENT,
                    googleWebClientId = BuildConfig.GOOGLE_WEB_CLIENT_ID,
                    googleSignInConfigured = BuildConfig.GOOGLE_SIGN_IN_CONFIGURED,
                    themeMode = themeMode,
                    onThemeModeChange = {
                        themeMode = it
                        themeStore.write(it)
                    },
                    reminderPreferences = reminderPreferences,
                    onReminderPreferencesChange = ::saveReminderPreferences,
                )
            }
        }
    }
}

@Composable
private fun ApplySystemBarContrast(themeMode: LedgrThemeMode) {
    val useDarkTheme = when (themeMode) {
        LedgrThemeMode.Light -> false
        LedgrThemeMode.Dark -> true
        LedgrThemeMode.System -> isSystemInDarkTheme()
    }
    val view = LocalView.current

    SideEffect {
        val activity = view.context as? ComponentActivity ?: return@SideEffect
        val background = if (useDarkTheme) DarkSystemBarColor else LightSystemBarColor
        val style = if (useDarkTheme) {
            SystemBarStyle.dark(background)
        } else {
            SystemBarStyle.light(background, background)
        }
        activity.enableEdgeToEdge(
            statusBarStyle = style,
            navigationBarStyle = style,
        )
    }
}

private val DarkSystemBarColor = Color.parseColor("#08111B")
private val LightSystemBarColor = Color.parseColor("#EAF4FF")

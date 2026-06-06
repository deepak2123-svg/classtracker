package com.classtracker.nativeapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.classtracker.core.designsystem.LedgrTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            val themeStore = remember { ThemePreferenceStore(this) }
            var themeMode by remember { mutableStateOf(themeStore.read()) }

            LedgrTheme(themeMode = themeMode) {
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
                )
            }
        }
    }
}

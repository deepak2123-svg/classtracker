package com.classtracker.nativeapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.viewModels
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.classtracker.core.designsystem.LedgrTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            LedgrTheme {
                LedgrApp(
                    viewModel = viewModel,
                    environment = BuildConfig.ENVIRONMENT,
                    googleWebClientId = BuildConfig.GOOGLE_WEB_CLIENT_ID,
                    googleSignInConfigured = BuildConfig.GOOGLE_SIGN_IN_CONFIGURED,
                )
            }
        }
    }
}

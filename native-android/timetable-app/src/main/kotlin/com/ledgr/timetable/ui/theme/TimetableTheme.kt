package com.ledgr.timetable.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val TimetableLightColorScheme = lightColorScheme(
    primary = Color(0xFF2563EB),
    background = Color(0xFFFFFFFF),
    surface = Color(0xFFFFFFFF),
    onPrimary = Color.White,
    onBackground = Color(0xFF0F172A),
    onSurface = Color(0xFF0F172A),
)

@Composable
fun TimetableTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = TimetableLightColorScheme,
        content = content,
    )
}

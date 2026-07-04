package com.ledgr.timetable.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

object TimetableColors {
    val Ink = Color(0xFF0F172A)
    val Muted = Color(0xFF64748B)
    val Panel = Color(0xFFF8FAFC)
    val Blue = Color(0xFF2563EB)
    val Green = Color(0xFF059669)
    val Orange = Color(0xFFB45309)
    val Border = Color(0xFFE2E8F0)
}

@Composable
fun TimetableTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = TimetableColors.Blue,
            secondary = TimetableColors.Green,
            surface = Color.White,
            background = TimetableColors.Panel,
            onPrimary = Color.White,
            onSurface = TimetableColors.Ink,
            onBackground = TimetableColors.Ink,
        ),
        content = content,
    )
}

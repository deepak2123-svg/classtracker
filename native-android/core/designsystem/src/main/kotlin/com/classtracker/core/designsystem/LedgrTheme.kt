package com.classtracker.core.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

val LedgrNavy = Color(0xFF1D3769)
val LedgrBlue = Color(0xFF2F73F2)
val LedgrGreen = Color(0xFF159B55)
val LedgrInk = Color(0xFF111827)
val LedgrMuted = Color(0xFF667085)
val LedgrCanvas = Color(0xFFF5F7FB)
val LedgrOutline = Color(0xFFD7DFEC)

private val LightColors = lightColorScheme(
    primary = LedgrNavy,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDCE8FF),
    onPrimaryContainer = Color(0xFF10295A),
    secondary = LedgrGreen,
    onSecondary = Color.White,
    background = LedgrCanvas,
    onBackground = LedgrInk,
    surface = Color.White,
    onSurface = LedgrInk,
    surfaceVariant = Color(0xFFEDF2F8),
    onSurfaceVariant = LedgrMuted,
    outline = LedgrOutline,
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF9ABCFF),
    onPrimary = Color(0xFF002F69),
    primaryContainer = LedgrNavy,
    onPrimaryContainer = Color(0xFFDCE8FF),
    secondary = Color(0xFF66D391),
    onSecondary = Color(0xFF00391B),
    background = Color(0xFF10151F),
    onBackground = Color(0xFFE6EAF2),
    surface = Color(0xFF171D28),
    onSurface = Color(0xFFE6EAF2),
    surfaceVariant = Color(0xFF232B38),
    onSurfaceVariant = Color(0xFFBAC3D2),
    outline = Color(0xFF3B4658),
)

private val LedgrTypography = Typography(
    displaySmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 32.sp,
        lineHeight = 38.sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 26.sp,
        lineHeight = 32.sp,
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontSize = 22.sp,
        lineHeight = 28.sp,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
        lineHeight = 22.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 24.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp,
        lineHeight = 20.sp,
    ),
)

private val LedgrShapes = Shapes(
    extraSmall = RoundedCornerShape(4.dp),
    small = RoundedCornerShape(6.dp),
    medium = RoundedCornerShape(8.dp),
    large = RoundedCornerShape(8.dp),
    extraLarge = RoundedCornerShape(8.dp),
)

@Composable
fun LedgrTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = LedgrTypography,
        shapes = LedgrShapes,
        content = content,
    )
}

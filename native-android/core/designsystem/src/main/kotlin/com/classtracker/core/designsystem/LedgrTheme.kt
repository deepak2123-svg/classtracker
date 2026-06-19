package com.classtracker.core.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.classtracker.core.designsystem.R

val LedgrForest = Color(0xFF16324F)
val LedgrForestStrong = Color(0xFF0E253B)
val LedgrTeal = Color(0xFF0F6B78)
val LedgrTealBright = Color(0xFF147F8D)
val LedgrBlue = Color(0xFF2563EB)
val LedgrGreen = Color(0xFF159B55)
val LedgrAmber = Color(0xFFD97706)
val LedgrRed = Color(0xFFB42318)
val LedgrInk = Color(0xFF101828)
val LedgrTextSecondary = Color(0xFF344054)
val LedgrMuted = Color(0xFF667085)
val LedgrSubtle = Color(0xFF98A2B3)
val LedgrCanvas = Color(0xFFEAF4FF)
val LedgrSurfaceAlt = Color(0xFFEFF3F7)
val LedgrOutline = Color(0xFFDCE3EA)
val LedgrOutlineStrong = Color(0xFFCAD4DE)

enum class LedgrThemeMode {
    Light,
    Dark,
    System,
}

@Immutable
data class LedgrExtendedColors(
    val forest: Color,
    val forestStrong: Color,
    val teal: Color,
    val blue: Color,
    val green: Color,
    val amber: Color,
    val red: Color,
    val surfaceAlt: Color,
    val surfaceSoft: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val textSubtle: Color,
    val outlineStrong: Color,
    val successSurface: Color,
    val warningSurface: Color,
    val errorSurface: Color,
)

private val LightExtendedColors = LedgrExtendedColors(
    forest = LedgrForest,
    forestStrong = LedgrForestStrong,
    teal = LedgrTeal,
    blue = LedgrBlue,
    green = LedgrGreen,
    amber = LedgrAmber,
    red = LedgrRed,
    surfaceAlt = LedgrSurfaceAlt,
    surfaceSoft = Color(0xFFFAFBFC),
    textSecondary = LedgrTextSecondary,
    textMuted = LedgrMuted,
    textSubtle = LedgrSubtle,
    outlineStrong = LedgrOutlineStrong,
    successSurface = Color(0xFFECFDF3),
    warningSurface = Color(0xFFFFF7ED),
    errorSurface = Color(0xFFFEF3F2),
)

private val DarkExtendedColors = LedgrExtendedColors(
    forest = Color(0xFF07111B),
    forestStrong = Color(0xFF050C13),
    teal = Color(0xFF4DB7C8),
    blue = Color(0xFF60A5FA),
    green = Color(0xFF5DD397),
    amber = Color(0xFFFBBF24),
    red = Color(0xFFF87171),
    surfaceAlt = Color(0xFF162231),
    surfaceSoft = Color(0xFF0D1622),
    textSecondary = Color(0xFFD7E2EE),
    textMuted = Color(0xFF94A3B8),
    textSubtle = Color(0xFF64748B),
    outlineStrong = Color(0xFF334155),
    successSurface = Color(0xFF123528),
    warningSurface = Color(0xFF3A2A11),
    errorSurface = Color(0xFF3C1D20),
)

private val LocalLedgrExtendedColors = staticCompositionLocalOf {
    LightExtendedColors
}

private val LocalLedgrIsDark = staticCompositionLocalOf { false }

object LedgrTheme {
    val colors: LedgrExtendedColors
        @Composable
        get() = LocalLedgrExtendedColors.current

    val isDark: Boolean
        @Composable
        get() = LocalLedgrIsDark.current
}

private val LightColors = lightColorScheme(
    primary = LedgrTeal,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE7F4F6),
    onPrimaryContainer = LedgrForest,
    secondary = LedgrBlue,
    onSecondary = Color.White,
    tertiary = LedgrGreen,
    background = LedgrCanvas,
    onBackground = LedgrInk,
    surface = Color.White,
    onSurface = LedgrInk,
    surfaceVariant = LedgrSurfaceAlt,
    onSurfaceVariant = LedgrMuted,
    outline = LedgrOutline,
    outlineVariant = LedgrOutlineStrong,
    error = LedgrRed,
    errorContainer = Color(0xFFFEF3F2),
    onErrorContainer = Color(0xFF7A271A),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF4DB7C8),
    onPrimary = Color(0xFF052B31),
    primaryContainer = Color(0xFF173C45),
    onPrimaryContainer = Color(0xFFC5F1F7),
    secondary = Color(0xFF60A5FA),
    onSecondary = Color(0xFF082F63),
    tertiary = Color(0xFF5DD397),
    background = Color(0xFF08111B),
    onBackground = Color(0xFFF8FAFC),
    surface = Color(0xFF101926),
    onSurface = Color(0xFFF8FAFC),
    surfaceVariant = Color(0xFF162231),
    onSurfaceVariant = Color(0xFF94A3B8),
    outline = Color(0xFF243244),
    outlineVariant = Color(0xFF334155),
    error = Color(0xFFF87171),
    errorContainer = Color(0xFF3C1D20),
    onErrorContainer = Color(0xFFFFDAD6),
)

val LedgrDisplayFontFamily = FontFamily(
    Font(R.font.poppins_bold, FontWeight.Normal),
    Font(R.font.poppins_bold, FontWeight.Medium),
    Font(R.font.poppins_bold, FontWeight.SemiBold),
    Font(R.font.poppins_bold, FontWeight.Bold),
    Font(R.font.poppins_extrabold, FontWeight.ExtraBold),
)

private val LedgrTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = LedgrDisplayFontFamily,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 48.sp,
        lineHeight = 56.sp,
        letterSpacing = 0.sp,
    ),
    displayMedium = TextStyle(
        fontFamily = LedgrDisplayFontFamily,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 40.sp,
        lineHeight = 48.sp,
        letterSpacing = 0.sp,
    ),
    displaySmall = TextStyle(
        fontFamily = LedgrDisplayFontFamily,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 32.sp,
        lineHeight = 38.sp,
        letterSpacing = 0.sp,
    ),
    headlineLarge = TextStyle(
        fontFamily = LedgrDisplayFontFamily,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 30.sp,
        lineHeight = 36.sp,
        letterSpacing = 0.sp,
    ),
    headlineMedium = TextStyle(
        fontFamily = LedgrDisplayFontFamily,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 27.sp,
        lineHeight = 33.sp,
        letterSpacing = 0.sp,
    ),
    headlineSmall = TextStyle(
        fontFamily = LedgrDisplayFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 23.sp,
        lineHeight = 29.sp,
        letterSpacing = 0.sp,
    ),
    titleLarge = TextStyle(
        fontFamily = LedgrDisplayFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 20.sp,
        lineHeight = 26.sp,
        letterSpacing = 0.sp,
    ),
    titleMedium = TextStyle(
        fontFamily = LedgrDisplayFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 16.sp,
        lineHeight = 22.sp,
        letterSpacing = 0.sp,
    ),
    titleSmall = TextStyle(
        fontFamily = LedgrDisplayFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = LedgrDisplayFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 16.sp,
        lineHeight = 24.sp,
        letterSpacing = 0.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = LedgrDisplayFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.sp,
    ),
    bodySmall = TextStyle(
        fontFamily = LedgrDisplayFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 12.sp,
        lineHeight = 17.sp,
        letterSpacing = 0.sp,
    ),
    labelLarge = TextStyle(
        fontFamily = LedgrDisplayFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 14.sp,
        lineHeight = 20.sp,
        letterSpacing = 0.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = LedgrDisplayFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 12.sp,
        lineHeight = 17.sp,
        letterSpacing = 0.sp,
    ),
    labelSmall = TextStyle(
        fontFamily = LedgrDisplayFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 11.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.sp,
    ),
)

private val LedgrShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(12.dp),
    large = RoundedCornerShape(20.dp),
    extraLarge = RoundedCornerShape(24.dp),
)

@Composable
fun LedgrTheme(
    themeMode: LedgrThemeMode = LedgrThemeMode.Light,
    content: @Composable () -> Unit,
) {
    val useDarkTheme = when (themeMode) {
        LedgrThemeMode.Light -> false
        LedgrThemeMode.Dark -> true
        LedgrThemeMode.System -> isSystemInDarkTheme()
    }

    androidx.compose.runtime.CompositionLocalProvider(
        LocalLedgrExtendedColors provides if (useDarkTheme) {
            DarkExtendedColors
        } else {
            LightExtendedColors
        },
        LocalLedgrIsDark provides useDarkTheme,
    ) {
        MaterialTheme(
            colorScheme = if (useDarkTheme) DarkColors else LightColors,
            typography = LedgrTypography,
            shapes = LedgrShapes,
            content = content,
        )
    }
}

@Composable
fun LedgrTheme(
    darkTheme: Boolean,
    content: @Composable () -> Unit,
) {
    LedgrTheme(
        themeMode = if (darkTheme) LedgrThemeMode.Dark else LedgrThemeMode.Light,
        content = content,
    )
}

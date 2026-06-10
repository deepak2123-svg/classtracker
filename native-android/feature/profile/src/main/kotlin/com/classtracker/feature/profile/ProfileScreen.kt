package com.classtracker.feature.profile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.classtracker.core.designsystem.LedgrForest
import com.classtracker.core.designsystem.LedgrTeal
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.designsystem.LedgrThemeMode
import com.classtracker.core.model.TeacherProfile

@Composable
fun ProfileScreen(
    profile: TeacherProfile,
    loggedToday: Int,
    monthEntries: Int,
    activeClasses: Int,
    instituteCount: Int,
    trashedCount: Int,
    themeMode: LedgrThemeMode,
    onThemeModeChange: (LedgrThemeMode) -> Unit,
    onOpenStats: () -> Unit,
    onOpenReports: () -> Unit,
    onOpenRecycleBin: () -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = 16.dp,
            top = 14.dp,
            end = 16.dp,
            bottom = 28.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            ProfileHero(
                profile = profile,
                loggedToday = loggedToday,
                monthEntries = monthEntries,
                activeClasses = activeClasses,
                instituteCount = instituteCount,
            )
        }
        item {
            Text(
                text = "WORKSPACE",
                style = MaterialTheme.typography.labelSmall,
                color = colors.textSubtle,
                modifier = Modifier.padding(start = 4.dp, top = 2.dp),
            )
        }
        item {
            ProfileActionCard(
                icon = Icons.Outlined.BarChart,
                title = "View Stats",
                subtitle = "See teaching hours and class breakdowns.",
                accent = Color(0xFF1455B3),
                onClick = onOpenStats,
            )
        }
        item {
            ProfileActionCard(
                icon = Icons.Outlined.NotificationsNone,
                title = "Notifications",
                subtitle = "No unread updates right now.",
                accent = Color(0xFFD97706),
            )
        }
        item {
            ProfileActionCard(
                icon = Icons.Outlined.Archive,
                title = "Recycle Bin",
                subtitle = if (trashedCount == 0) {
                    "Nothing in the recycle bin right now."
                } else {
                    "$trashedCount deleted ${if (trashedCount == 1) "entry" else "entries"} — tap to restore."
                },
                accent = if (trashedCount > 0) colors.red else colors.textSecondary,
                onClick = onOpenRecycleBin,
            )
        }
        item {
            ProfileActionCard(
                icon = Icons.Outlined.Download,
                title = "Reports & Export",
                subtitle = "Preview teacher reports and share an export summary.",
                accent = colors.green,
                onClick = onOpenReports,
            )
        }
        item {
            ThemeCard(
                themeMode = themeMode,
                onThemeModeChange = onThemeModeChange,
            )
        }
        item {
            ProfileActionCard(
                icon = Icons.AutoMirrored.Outlined.Logout,
                title = "Sign Out",
                subtitle = "Sign out of your teacher workspace.",
                accent = colors.red,
                danger = true,
                onClick = onSignOut,
            )
        }
    }
}

@Composable
private fun ProfileHero(
    profile: TeacherProfile,
    loggedToday: Int,
    monthEntries: Int,
    activeClasses: Int,
    instituteCount: Int,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(28.dp))
            .background(
                Brush.linearGradient(
                    colors = listOf(LedgrForest, LedgrTeal),
                ),
            )
            .padding(horizontal = 20.dp, vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Row(
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(62.dp)
                    .background(Color.White.copy(alpha = 0.12f), RoundedCornerShape(20.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .background(Color.White.copy(alpha = 0.14f), CircleShape),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        text = initials(profile.name),
                        style = MaterialTheme.typography.titleLarge,
                        color = Color.White,
                    )
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "WORKSPACE",
                    style = MaterialTheme.typography.labelSmall,
                    color = Color.White.copy(alpha = 0.60f),
                )
                Text(
                    text = profile.name.ifBlank { "Teacher" },
                    style = MaterialTheme.typography.headlineMedium.copy(
                        fontSize = 28.sp,
                        lineHeight = 30.sp,
                    ),
                    color = Color.White,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 5.dp),
                )
                Text(
                    text = profile.email.ifBlank { "No email available" },
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.68f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 5.dp),
                )
            }
        }
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                HeroMetric("Logged Today", loggedToday.toString(), Modifier.weight(1f))
                HeroMetric("This Month", monthEntries.toString(), Modifier.weight(1f))
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                HeroMetric("Active Classes", activeClasses.toString(), Modifier.weight(1f))
                HeroMetric("Institutes", instituteCount.toString(), Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun HeroMetric(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .background(Color.White.copy(alpha = 0.08f), RoundedCornerShape(18.dp))
            .padding(horizontal = 12.dp, vertical = 11.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp),
    ) {
        Text(
            text = label.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = Color.White.copy(alpha = 0.52f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge.copy(fontSize = 22.sp),
            color = Color.White,
        )
    }
}

@Composable
private fun ProfileActionCard(
    icon: ImageVector,
    title: String,
    subtitle: String,
    accent: Color,
    modifier: Modifier = Modifier,
    danger: Boolean = false,
    onClick: (() -> Unit)? = null,
) {
    val clickModifier = if (onClick == null) modifier else modifier.clickable(onClick = onClick)
    Surface(
        modifier = clickModifier.fillMaxWidth(),
        color = if (danger) colors.errorSurface else MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(20.dp),
        border = BorderStroke(
            1.dp,
            if (danger) colors.red.copy(alpha = 0.22f) else MaterialTheme.colorScheme.outline,
        ),
        shadowElevation = 1.dp,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 15.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(
                modifier = Modifier.size(48.dp),
                color = accent.copy(alpha = 0.12f),
                contentColor = accent,
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, accent.copy(alpha = 0.16f)),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        modifier = Modifier.size(22.dp),
                    )
                }
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleLarge.copy(fontSize = 18.sp),
                    color = if (danger) colors.red else MaterialTheme.colorScheme.onSurface,
                )
                Text(
                    text = subtitle,
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textMuted,
                )
            }
        }
    }
}

@Composable
private fun ThemeCard(
    themeMode: LedgrThemeMode,
    onThemeModeChange: (LedgrThemeMode) -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(24.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 15.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Surface(
                    modifier = Modifier.size(48.dp),
                    color = colors.teal.copy(alpha = 0.12f),
                    contentColor = colors.teal,
                    shape = RoundedCornerShape(16.dp),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = if (themeMode == LedgrThemeMode.Dark) {
                                Icons.Outlined.DarkMode
                            } else {
                                Icons.Outlined.LightMode
                            },
                            contentDescription = null,
                        )
                    }
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Choose your theme",
                        style = MaterialTheme.typography.titleLarge.copy(fontSize = 18.sp),
                    )
                    Text(
                        text = "Pick a bright daytime layout or a softer dark mode.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.textMuted,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                ThemePreview(
                    label = "Light",
                    icon = Icons.Outlined.LightMode,
                    selected = themeMode == LedgrThemeMode.Light,
                    dark = false,
                    onClick = { onThemeModeChange(LedgrThemeMode.Light) },
                    modifier = Modifier.weight(1f),
                )
                ThemePreview(
                    label = "Dark",
                    icon = Icons.Outlined.DarkMode,
                    selected = themeMode == LedgrThemeMode.Dark,
                    dark = true,
                    onClick = { onThemeModeChange(LedgrThemeMode.Dark) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun ThemePreview(
    label: String,
    icon: ImageVector,
    selected: Boolean,
    dark: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val previewBackground = if (dark) Color(0xFF0A1420) else Color(0xFFF5F7FA)
    val previewSurface = if (dark) Color.White.copy(alpha = 0.08f) else Color.White
    val accent = if (dark) Color(0xFF4DB7C8) else colors.teal
    Surface(
        modifier = modifier.clickable(onClick = onClick),
        color = if (selected) colors.teal.copy(alpha = 0.10f) else colors.surfaceSoft,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(
            1.dp,
            if (selected) colors.teal else MaterialTheme.colorScheme.outline,
        ),
    ) {
        Column(modifier = Modifier.padding(11.dp)) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(84.dp)
                    .background(previewBackground, RoundedCornerShape(14.dp))
                    .padding(8.dp),
                verticalArrangement = Arrangement.SpaceBetween,
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Box(
                        modifier = Modifier
                            .size(24.dp)
                            .background(accent, RoundedCornerShape(8.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = icon,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(14.dp),
                        )
                    }
                    Surface(
                        modifier = Modifier.size(18.dp),
                        shape = CircleShape,
                        color = Color.Transparent,
                        border = BorderStroke(2.dp, accent),
                    ) {
                        if (selected) {
                            Icon(
                                imageVector = Icons.Outlined.Check,
                                contentDescription = null,
                                tint = accent,
                                modifier = Modifier.padding(2.dp),
                            )
                        }
                    }
                }
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(11.dp)
                            .background(previewSurface, CircleShape),
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        repeat(2) {
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .height(24.dp)
                                    .background(previewSurface, RoundedCornerShape(8.dp)),
                            )
                        }
                    }
                }
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = label,
                    style = MaterialTheme.typography.titleMedium,
                )
                if (selected) {
                    Text(
                        text = "ACTIVE",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White,
                        modifier = Modifier
                            .background(colors.teal, CircleShape)
                            .padding(horizontal = 8.dp, vertical = 3.dp),
                    )
                }
            }
        }
    }
}

private fun initials(name: String): String =
    name.trim()
        .split(Regex("\\s+"))
        .filter(String::isNotBlank)
        .take(2)
        .joinToString("") { it.take(1).uppercase() }
        .ifBlank { "T" }

@Preview(showBackground = true, widthDp = 390, heightDp = 844)
@Composable
private fun ProfileScreenPreview() {
    LedgrTheme(darkTheme = false) {
        ProfileScreen(
            profile = TeacherProfile(
                uid = "1",
                name = "Deepak Kumar",
                email = "teacher@example.com",
                photoUrl = null,
                subjects = listOf("GS", "SS"),
                institutes = listOf("GIS Karnal", "KIS SIP"),
            ),
            loggedToday = 2,
            monthEntries = 18,
            activeClasses = 6,
            instituteCount = 3,
            trashedCount = 0,
            themeMode = LedgrThemeMode.Light,
            onThemeModeChange = {},
            onOpenStats = {},
            onOpenReports = {},
            onOpenRecycleBin = {},
            onSignOut = {},
        )
    }
}

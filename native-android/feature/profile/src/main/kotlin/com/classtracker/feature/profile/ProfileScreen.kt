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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.outlined.Apartment
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.LightMode
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.classtracker.core.designsystem.LedgrForest
import com.classtracker.core.designsystem.LedgrSectionHeading
import com.classtracker.core.designsystem.LedgrTealBright
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.designsystem.LedgrThemeMode
import com.classtracker.core.model.TeacherProfile

@Composable
fun ProfileScreen(
    profile: TeacherProfile,
    environmentLabel: String,
    revision: Long,
    loggedToday: Int,
    monthEntries: Int,
    activeClasses: Int,
    instituteCount: Int,
    themeMode: LedgrThemeMode,
    onThemeModeChange: (LedgrThemeMode) -> Unit,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            start = 16.dp,
            top = 14.dp,
            end = 16.dp,
            bottom = 30.dp,
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
            LedgrSectionHeading(
                title = "Workspace",
                supportingText = "Your teacher account",
                modifier = Modifier.padding(top = 4.dp),
            )
        }

        item {
            ProfileDetailCard(
                icon = Icons.Outlined.Apartment,
                title = "Institutes",
                value = profile.institutes.joinToString().ifBlank { "No institute assigned" },
            )
        }

        item {
            ProfileDetailCard(
                icon = Icons.AutoMirrored.Outlined.MenuBook,
                title = "Subjects",
                value = profile.subjects.joinToString().ifBlank { "No subjects assigned" },
            )
        }

        item {
            ThemeChooser(
                themeMode = themeMode,
                onThemeModeChange = onThemeModeChange,
            )
        }

        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = MaterialTheme.colorScheme.surface,
                shape = MaterialTheme.shapes.large,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 13.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column {
                        Text(
                            text = "APP STATUS",
                            style = MaterialTheme.typography.labelSmall,
                            color = colors.textMuted,
                        )
                        Text(
                            text = environmentLabel,
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.padding(top = 3.dp),
                        )
                    }
                    Text(
                        text = "Cloud revision $revision",
                        style = MaterialTheme.typography.labelMedium,
                        color = colors.teal,
                    )
                }
            }
        }

        item {
            OutlinedButton(
                onClick = onSignOut,
                modifier = Modifier.fillMaxWidth(),
                border = BorderStroke(1.dp, colors.red.copy(alpha = 0.42f)),
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Outlined.Logout,
                    contentDescription = null,
                    tint = colors.red,
                    modifier = Modifier.padding(end = 8.dp),
                )
                Text(
                    text = "Sign out",
                    color = colors.red,
                )
            }
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
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = LedgrForest,
        contentColor = Color.White,
        shape = MaterialTheme.shapes.extraLarge,
    ) {
        Column(
            modifier = Modifier.padding(18.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(13.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .background(Color.White.copy(alpha = 0.12f), MaterialTheme.shapes.large),
                    contentAlignment = Alignment.Center,
                ) {
                    Box(
                        modifier = Modifier
                            .size(42.dp)
                            .background(LedgrTealBright, CircleShape),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = initials(profile.name),
                            style = MaterialTheme.typography.titleMedium,
                            color = Color.White,
                        )
                    }
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "WORKSPACE",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color.White.copy(alpha = 0.62f),
                    )
                    Text(
                        text = profile.name.ifBlank { "Teacher" },
                        style = MaterialTheme.typography.headlineSmall,
                        color = Color.White,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 3.dp),
                    )
                    Text(
                        text = profile.email,
                        style = MaterialTheme.typography.bodySmall,
                        color = Color.White.copy(alpha = 0.72f),
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.padding(top = 3.dp),
                    )
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    ProfileHeroMetric("Logged today", loggedToday.toString(), Modifier.weight(1f))
                    ProfileHeroMetric("This month", monthEntries.toString(), Modifier.weight(1f))
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    ProfileHeroMetric("Active classes", activeClasses.toString(), Modifier.weight(1f))
                    ProfileHeroMetric("Institutes", instituteCount.toString(), Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun ProfileHeroMetric(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .background(Color.White.copy(alpha = 0.09f), MaterialTheme.shapes.medium)
            .padding(horizontal = 12.dp, vertical = 11.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Text(
            text = label.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = Color.White.copy(alpha = 0.58f),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Text(
            text = value,
            style = MaterialTheme.typography.titleLarge,
            color = Color.White,
        )
    }
}

@Composable
private fun ProfileDetailCard(
    icon: ImageVector,
    title: String,
    value: String,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = MaterialTheme.shapes.large,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Row(
            modifier = Modifier.padding(15.dp),
            horizontalArrangement = Arrangement.spacedBy(13.dp),
            verticalAlignment = Alignment.Top,
        ) {
            Surface(
                color = MaterialTheme.colorScheme.primaryContainer,
                contentColor = MaterialTheme.colorScheme.primary,
                shape = MaterialTheme.shapes.medium,
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.padding(10.dp),
                )
            }
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    text = value,
                    style = MaterialTheme.typography.bodyMedium,
                    color = colors.textMuted,
                )
            }
        }
    }
}

@Composable
private fun ThemeChooser(
    themeMode: LedgrThemeMode,
    onThemeModeChange: (LedgrThemeMode) -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = MaterialTheme.shapes.large,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Column(
            modifier = Modifier.padding(15.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Column {
                Text(
                    text = "Choose your theme",
                    style = MaterialTheme.typography.titleMedium,
                )
                Text(
                    text = "Match Ledgr to daytime or low-light use.",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.textMuted,
                    modifier = Modifier.padding(top = 3.dp),
                )
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(9.dp),
            ) {
                ThemeOption(
                    label = "Light",
                    icon = Icons.Outlined.LightMode,
                    selected = themeMode == LedgrThemeMode.Light,
                    onClick = { onThemeModeChange(LedgrThemeMode.Light) },
                    modifier = Modifier.weight(1f),
                )
                ThemeOption(
                    label = "Dark",
                    icon = Icons.Outlined.DarkMode,
                    selected = themeMode == LedgrThemeMode.Dark,
                    onClick = { onThemeModeChange(LedgrThemeMode.Dark) },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }
}

@Composable
private fun ThemeOption(
    label: String,
    icon: ImageVector,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val borderColor = if (selected) colors.teal else MaterialTheme.colorScheme.outline
    val background = if (selected) {
        MaterialTheme.colorScheme.primaryContainer
    } else {
        colors.surfaceSoft
    }
    Surface(
        modifier = modifier.clickable(onClick = onClick),
        color = background,
        contentColor = if (selected) colors.teal else colors.textSecondary,
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, borderColor),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                modifier = Modifier.size(20.dp),
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
            )
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

@Preview(showBackground = true, widthDp = 390, heightDp = 820)
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
            environmentLabel = "Beta",
            revision = 142,
            loggedToday = 2,
            monthEntries = 18,
            activeClasses = 6,
            instituteCount = 3,
            themeMode = LedgrThemeMode.Light,
            onThemeModeChange = {},
            onSignOut = {},
        )
    }
}

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
import androidx.compose.material.icons.outlined.Forum
import androidx.compose.material.icons.outlined.NotificationsNone
import androidx.compose.material.icons.outlined.PersonOff
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.foundation.text.KeyboardOptions
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.designsystem.LedgrThemeMode
import com.classtracker.core.designsystem.rememberLedgrHaptics
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
    onOpenManageClasses: () -> Unit,
    onOpenReports: () -> Unit,
    onOpenRecycleBin: () -> Unit,
    reminderEnabled: Boolean,
    reminderTimeLabel: String,
    onOpenReminderSettings: () -> Unit,
    feedbackUnreadCount: Int,
    onOpenFeedback: () -> Unit,
    onSignOut: () -> Unit,
    deletingAccount: Boolean,
    onDeleteAccount: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val haptics = rememberLedgrHaptics()
    var deleteAccountStep by remember { mutableIntStateOf(0) }
    var deleteAccountConfirmation by remember { mutableStateOf("") }

    if (deleteAccountStep == 1) {
        AlertDialog(
            onDismissRequest = { deleteAccountStep = 0 },
            icon = { Icon(Icons.Outlined.PersonOff, contentDescription = null) },
            title = { Text("Delete your teacher account?") },
            text = {
                Text(
                    "Your sign-in account will be deleted and the admin will see that you " +
                        "left the workspace. All classes and entries will remain available " +
                        "to the organisation.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        haptics.warning()
                        deleteAccountConfirmation = ""
                        deleteAccountStep = 2
                    },
                ) {
                    Text("Continue", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { deleteAccountStep = 0 }) {
                    Text("Cancel", fontWeight = FontWeight.Bold)
                }
            },
        )
    }
    if (deleteAccountStep == 2) {
        AlertDialog(
            onDismissRequest = { if (!deletingAccount) deleteAccountStep = 0 },
            icon = { Icon(Icons.Outlined.PersonOff, contentDescription = null) },
            title = { Text("Final confirmation") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Text(
                        "This removes your Ledgr sign-in account. You cannot delete the " +
                            "organisation's teaching records.",
                    )
                    Text(
                        "Type DELETE MY ACCOUNT to confirm.",
                        fontWeight = FontWeight.Bold,
                    )
                    OutlinedTextField(
                        value = deleteAccountConfirmation,
                        onValueChange = { deleteAccountConfirmation = it },
                        enabled = !deletingAccount,
                        singleLine = true,
                        label = { Text("Confirmation") },
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        haptics.warning()
                        onDeleteAccount()
                    },
                    enabled = !deletingAccount &&
                        deleteAccountConfirmation.trim() == "DELETE MY ACCOUNT",
                ) {
                    if (deletingAccount) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            strokeWidth = 2.dp,
                        )
                    } else {
                        Text("Delete account", fontWeight = FontWeight.Bold, color = colors.red)
                    }
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        deleteAccountConfirmation = ""
                        deleteAccountStep = 0
                    },
                    enabled = !deletingAccount,
                ) {
                    Text("Keep account", fontWeight = FontWeight.Bold)
                }
            },
        )
    }

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
                icon = Icons.Outlined.Forum,
                title = "Feedback & Support",
                subtitle = if (feedbackUnreadCount > 0) {
                    "$feedbackUnreadCount new ${if (feedbackUnreadCount == 1) "reply" else "replies"} from admin."
                } else {
                    "Report an issue, share feedback, or read admin replies."
                },
                accent = colors.teal,
                onClick = onOpenFeedback,
            )
        }
        item {
            ProfileActionCard(
                icon = Icons.Outlined.BarChart,
                title = "View Stats",
                subtitle = "See teaching hours and class breakdowns.",
                accent = colors.blue,
                onClick = onOpenStats,
            )
        }
        item {
            ProfileActionCard(
                icon = Icons.Outlined.School,
                title = "Manage Classes",
                subtitle = "Review active classes or move a class to the recycle bin.",
                accent = colors.teal,
                onClick = onOpenManageClasses,
            )
        }
        item {
            ProfileActionCard(
                icon = Icons.Outlined.NotificationsNone,
                title = "Notifications",
                subtitle = if (reminderEnabled) {
                    "Daily reminder at $reminderTimeLabel, Monday to Saturday."
                } else {
                    "Set one daily reminder, Monday to Saturday."
                },
                accent = colors.amber,
                onClick = onOpenReminderSettings,
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
        item {
            ProfileActionCard(
                icon = Icons.Outlined.PersonOff,
                title = "Delete Account",
                subtitle = "Leave the workspace. Your classes and entries will remain with the organisation.",
                accent = colors.red,
                danger = true,
                onClick = { deleteAccountStep = 1 },
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
                    colors = listOf(colors.forest, colors.teal),
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
    val haptics = rememberLedgrHaptics()
    val clickModifier = if (onClick == null) {
        modifier
    } else {
        modifier.clickable {
            if (danger) haptics.warning() else haptics.selection()
            onClick()
        }
    }
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
    val haptics = rememberLedgrHaptics()
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
                            imageVector = when (themeMode) {
                                LedgrThemeMode.Dark -> Icons.Outlined.DarkMode
                                LedgrThemeMode.System -> Icons.Outlined.Settings
                                LedgrThemeMode.Light -> Icons.Outlined.LightMode
                            },
                            contentDescription = null,
                        )
                    }
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "App theme",
                        style = MaterialTheme.typography.titleLarge.copy(fontSize = 18.sp),
                    )
                    Text(
                        text = "Light, dark, or device setting.",
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
                    label = "System",
                    icon = Icons.Outlined.Settings,
                    selected = themeMode == LedgrThemeMode.System,
                    previewMode = LedgrThemeMode.System,
                    onClick = {
                        haptics.selection()
                        onThemeModeChange(LedgrThemeMode.System)
                    },
                    modifier = Modifier.weight(1f),
                )
                ThemePreview(
                    label = "Light",
                    icon = Icons.Outlined.LightMode,
                    selected = themeMode == LedgrThemeMode.Light,
                    previewMode = LedgrThemeMode.Light,
                    onClick = {
                        haptics.selection()
                        onThemeModeChange(LedgrThemeMode.Light)
                    },
                    modifier = Modifier.weight(1f),
                )
                ThemePreview(
                    label = "Dark",
                    icon = Icons.Outlined.DarkMode,
                    selected = themeMode == LedgrThemeMode.Dark,
                    previewMode = LedgrThemeMode.Dark,
                    onClick = {
                        haptics.selection()
                        onThemeModeChange(LedgrThemeMode.Dark)
                    },
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
    previewMode: LedgrThemeMode,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val dark = previewMode == LedgrThemeMode.Dark
    val previewBackground = if (dark) colors.forestStrong else colors.surfaceSoft
    val previewSurface = if (dark) colors.surfaceAlt else MaterialTheme.colorScheme.surface
    val systemLightBackground = colors.surfaceSoft
    val systemDarkBackground = colors.forestStrong
    val systemLightRail = colors.borderSoft
    val systemDarkCard = colors.surfaceAlt
    val accent = colors.teal
    Surface(
        modifier = modifier
            .height(150.dp)
            .clickable(onClick = onClick),
        color = if (selected) colors.teal.copy(alpha = 0.10f) else colors.surfaceSoft,
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(
            if (selected) 2.dp else 1.dp,
            if (selected) colors.teal else MaterialTheme.colorScheme.outline,
        ),
    ) {
        Column(
            modifier = Modifier.padding(10.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(94.dp)
                    .clip(RoundedCornerShape(13.dp)),
            ) {
                if (previewMode == LedgrThemeMode.System) {
                    Row(modifier = Modifier.fillMaxSize()) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxSize()
                                .background(systemLightBackground),
                        )
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .fillMaxSize()
                                .background(systemDarkBackground),
                        )
                    }
                } else {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(previewBackground),
                    )
                }
                Column(
                    modifier = Modifier
                        .fillMaxSize()
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
                            modifier = Modifier.size(20.dp),
                            shape = CircleShape,
                            color = if (selected) accent else Color.Transparent,
                            border = BorderStroke(2.dp, accent),
                        ) {
                            if (selected) {
                                Icon(
                                    imageVector = Icons.Outlined.Check,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.padding(3.dp),
                                )
                            }
                        }
                    }
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(10.dp)
                                .background(
                                    if (previewMode == LedgrThemeMode.System) {
                                        systemLightRail
                                    } else {
                                        previewSurface
                                    },
                                    CircleShape,
                                ),
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            repeat(2) { index ->
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(24.dp)
                                        .background(
                                            if (
                                                previewMode == LedgrThemeMode.System &&
                                                index == 1
                                            ) {
                                                systemDarkCard
                                            } else {
                                                previewSurface
                                            },
                                            RoundedCornerShape(8.dp),
                                        ),
                                )
                            }
                        }
                    }
                }
            }
            Text(
                text = label,
                style = MaterialTheme.typography.titleMedium.copy(
                    fontSize = 14.sp,
                    lineHeight = 18.sp,
                ),
                maxLines = 1,
                modifier = Modifier.padding(start = 2.dp, top = 8.dp),
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
            onOpenManageClasses = {},
            onOpenReports = {},
            onOpenRecycleBin = {},
            reminderEnabled = true,
            reminderTimeLabel = "8:00 PM",
            onOpenReminderSettings = {},
            feedbackUnreadCount = 1,
            onOpenFeedback = {},
            onSignOut = {},
            deletingAccount = false,
            onDeleteAccount = {},
        )
    }
}

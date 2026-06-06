package com.classtracker.core.designsystem

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

@Immutable
data class LedgrSectionTone(
    val accent: Color,
    val surface: Color,
    val border: Color,
    val text: Color,
)

@Composable
fun ledgrSectionTone(seed: String): LedgrSectionTone {
    val dark = MaterialTheme.colorScheme.background.red < 0.15f
    val index = (seed.lowercase().hashCode() and Int.MAX_VALUE) % 6
    return if (dark) {
        listOf(
            LedgrSectionTone(Color(0xFF60A5FA), Color(0xFF172A42), Color(0xFF294466), Color(0xFFE7F0FF)),
            LedgrSectionTone(Color(0xFF5DD397), Color(0xFF173028), Color(0xFF285242), Color(0xFFE7FFF4)),
            LedgrSectionTone(Color(0xFFFBBF24), Color(0xFF342B19), Color(0xFF5A4825), Color(0xFFFFF6D9)),
            LedgrSectionTone(Color(0xFFF472B6), Color(0xFF392237), Color(0xFF5D3858), Color(0xFFFFE8F7)),
            LedgrSectionTone(Color(0xFFA78BFA), Color(0xFF2A2542), Color(0xFF453C69), Color(0xFFF1EDFF)),
            LedgrSectionTone(Color(0xFF4DB7C8), Color(0xFF173039), Color(0xFF28505B), Color(0xFFE4FBFF)),
        )[index]
    } else {
        listOf(
            LedgrSectionTone(Color(0xFF2563EB), Color(0xFFEFF5FF), Color(0xFFC9DBFF), Color(0xFF173B78)),
            LedgrSectionTone(Color(0xFF159B55), Color(0xFFECFDF3), Color(0xFFB7E7CA), Color(0xFF14532D)),
            LedgrSectionTone(Color(0xFFD97706), Color(0xFFFFF7ED), Color(0xFFFED7AA), Color(0xFF7C2D12)),
            LedgrSectionTone(Color(0xFFDB2777), Color(0xFFFDF2F8), Color(0xFFFBCFE8), Color(0xFF831843)),
            LedgrSectionTone(Color(0xFF7C3AED), Color(0xFFF5F3FF), Color(0xFFDDD6FE), Color(0xFF4C1D95)),
            LedgrSectionTone(Color(0xFF0F6B78), Color(0xFFE7F4F6), Color(0xFFB9DDE2), Color(0xFF164E63)),
        )[index]
    }
}

@Composable
fun LedgrBrandMark(
    modifier: Modifier = Modifier,
    size: Int = 38,
) {
    Surface(
        modifier = modifier.size(size.dp),
        color = LedgrBlue,
        contentColor = Color.White,
        shape = MaterialTheme.shapes.medium,
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                text = "L",
                style = MaterialTheme.typography.titleLarge,
            )
        }
    }
}

@Composable
fun LedgrMetricCard(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    accent: Color? = null,
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Text(
                text = label.uppercase(),
                style = MaterialTheme.typography.labelSmall,
                color = LedgrTheme.colors.textMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                color = accent ?: MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
fun LedgrSummaryTile(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    LedgrMetricCard(label = label, value = value, modifier = modifier)
}

@Composable
fun LedgrPill(
    text: String,
    modifier: Modifier = Modifier,
    containerColor: Color = LedgrTheme.colors.surfaceAlt,
    contentColor: Color = LedgrTheme.colors.textSecondary,
    borderColor: Color = MaterialTheme.colorScheme.outline,
    leadingColor: Color? = null,
) {
    Surface(
        modifier = modifier,
        shape = CircleShape,
        color = containerColor,
        contentColor = contentColor,
        border = BorderStroke(1.dp, borderColor),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
            horizontalArrangement = Arrangement.spacedBy(7.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            leadingColor?.let {
                Box(
                    modifier = Modifier
                        .size(7.dp)
                        .clip(CircleShape)
                        .background(it),
                )
            }
            Text(
                text = text,
                style = MaterialTheme.typography.labelSmall,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
fun LedgrStatusDot(
    active: Boolean,
    modifier: Modifier = Modifier,
) {
    val label = if (active) "Logged today" else "Not logged today"
    val color = if (active) LedgrTheme.colors.green else LedgrTheme.colors.amber
    Box(
        modifier = modifier
            .size(18.dp)
            .semantics { contentDescription = label }
            .clip(CircleShape)
            .background(color.copy(alpha = 0.16f))
            .padding(4.dp)
            .clip(CircleShape)
            .background(color),
    )
}

@Composable
fun LedgrClassCard(
    sectionName: String,
    instituteName: String,
    subjectName: String,
    modifier: Modifier = Modifier,
    detail: String? = null,
    entryCount: Int? = null,
    loggedToday: Boolean? = null,
    onClick: (() -> Unit)? = null,
) {
    val tone = ledgrSectionTone(sectionName)
    val clickableModifier = if (onClick == null) {
        modifier
    } else {
        modifier.clickable(onClick = onClick)
    }

    Card(
        modifier = clickableModifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, tone.border),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(tone.surface)
                    .padding(horizontal = 15.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.Top,
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(9.dp),
                ) {
                    Text(
                        text = sectionName,
                        style = MaterialTheme.typography.titleLarge,
                        color = tone.text,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(7.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        LedgrPill(
                            text = instituteName.ifBlank { "No institute" },
                            modifier = Modifier.weight(1f, fill = false),
                            containerColor = MaterialTheme.colorScheme.surface,
                            contentColor = LedgrTheme.colors.textSecondary,
                            borderColor = tone.border,
                            leadingColor = tone.accent,
                        )
                        if (subjectName.isNotBlank()) {
                            LedgrPill(
                                text = subjectName,
                                modifier = Modifier.weight(1f, fill = false),
                                containerColor = MaterialTheme.colorScheme.surface,
                                contentColor = LedgrTheme.colors.textSecondary,
                                borderColor = tone.border,
                            )
                        }
                    }
                }
                loggedToday?.let {
                    LedgrStatusDot(active = it, modifier = Modifier.padding(top = 2.dp))
                }
            }

            if (detail != null || entryCount != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 15.dp, vertical = 11.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    detail?.let {
                        Text(
                            text = it,
                            style = MaterialTheme.typography.bodySmall,
                            color = LedgrTheme.colors.textMuted,
                            modifier = Modifier.weight(1f),
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    entryCount?.let {
                        Text(
                            text = "$it ${if (it == 1) "entry" else "entries"}",
                            style = MaterialTheme.typography.labelMedium,
                            color = LedgrTheme.colors.teal,
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun LedgrEmptyState(
    title: String,
    message: String,
    modifier: Modifier = Modifier,
    icon: ImageVector = Icons.Outlined.CloudOff,
    contentPadding: PaddingValues = PaddingValues(20.dp),
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shape = MaterialTheme.shapes.large,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Row(
            modifier = Modifier.padding(contentPadding),
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Surface(
                color = MaterialTheme.colorScheme.primaryContainer,
                contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                shape = MaterialTheme.shapes.medium,
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    modifier = Modifier.padding(12.dp),
                )
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = message,
                    style = MaterialTheme.typography.bodyMedium,
                    color = LedgrTheme.colors.textMuted,
                )
            }
        }
    }
}

@Composable
fun LedgrSectionHeading(
    title: String,
    supportingText: String? = null,
    modifier: Modifier = Modifier,
    trailing: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.Bottom,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title.uppercase(),
                style = MaterialTheme.typography.labelSmall,
                color = LedgrTheme.colors.textMuted,
            )
            supportingText?.let {
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = it,
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onBackground,
                )
            }
        }
        trailing?.invoke()
    }
}

@Composable
fun LedgrOfflineBanner(
    modifier: Modifier = Modifier,
    message: String = "Showing saved data. Connect to refresh.",
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = LedgrTheme.colors.warningSurface,
        contentColor = LedgrTheme.colors.amber,
        shape = MaterialTheme.shapes.medium,
        border = BorderStroke(1.dp, LedgrTheme.colors.amber.copy(alpha = 0.28f)),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Outlined.CloudOff,
                contentDescription = null,
                modifier = Modifier.size(18.dp),
            )
            Text(
                text = message,
                style = MaterialTheme.typography.labelMedium,
                color = LedgrTheme.colors.textSecondary,
            )
        }
    }
}

@Composable
fun LedgrLoadingState(
    label: String,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Surface(
            modifier = Modifier.size(56.dp),
            color = MaterialTheme.colorScheme.primaryContainer,
            contentColor = MaterialTheme.colorScheme.primary,
            shape = MaterialTheme.shapes.large,
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = Icons.Outlined.Sync,
                    contentDescription = null,
                    modifier = Modifier.size(24.dp),
                )
            }
        }
        CircularProgressIndicator(
            modifier = Modifier.size(28.dp),
            strokeWidth = 3.dp,
        )
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = LedgrTheme.colors.textMuted,
        )
    }
}

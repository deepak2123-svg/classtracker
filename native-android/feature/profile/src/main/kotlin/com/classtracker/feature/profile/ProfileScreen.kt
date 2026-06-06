package com.classtracker.feature.profile

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.classtracker.core.designsystem.LedgrSectionHeading
import com.classtracker.core.designsystem.LedgrTheme
import com.classtracker.core.model.TeacherProfile

@Composable
fun ProfileScreen(
    profile: TeacherProfile,
    environmentLabel: String,
    revision: Long,
    onSignOut: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp, vertical = 22.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        LedgrSectionHeading(
            title = "Profile",
            supportingText = profile.email,
        )

        Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.medium,
            color = MaterialTheme.colorScheme.surface,
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        ) {
            Column {
                Row(
                    modifier = Modifier.padding(18.dp),
                    horizontalArrangement = Arrangement.spacedBy(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Icons.Outlined.AccountCircle,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = profile.name.ifBlank { "Teacher" },
                            style = MaterialTheme.typography.titleMedium,
                        )
                        Text(
                            text = profile.institutes.joinToString().ifBlank { "No institute assigned" },
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outline)
                ProfileValue(
                    label = "Subjects",
                    value = profile.subjects.joinToString().ifBlank { "None" },
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.outline)
                ProfileValue(
                    label = "Environment",
                    value = environmentLabel,
                )
                HorizontalDivider(color = MaterialTheme.colorScheme.outline)
                ProfileValue(
                    label = "Cloud revision",
                    value = revision.toString(),
                )
            }
        }

        OutlinedButton(
            onClick = onSignOut,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Outlined.Logout,
                contentDescription = null,
                modifier = Modifier.padding(end = 8.dp),
            )
            Text("Sign out")
        }
    }
}

@Composable
private fun ProfileValue(
    label: String,
    value: String,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 18.dp, vertical = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(0.38f),
        )
        Text(
            text = value,
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.primary,
            textAlign = TextAlign.End,
            modifier = Modifier
                .weight(0.62f)
                .padding(start = 16.dp),
        )
    }
}

@Preview(showBackground = true, widthDp = 390, heightDp = 760)
@Composable
private fun ProfileScreenPreview() {
    LedgrTheme(darkTheme = false) {
        ProfileScreen(
            profile = TeacherProfile(
                uid = "1",
                name = "Deepak",
                email = "teacher@example.com",
                photoUrl = null,
                subjects = listOf("Physics"),
                institutes = listOf("Genesis"),
            ),
            environmentLabel = "Beta",
            revision = 4,
            onSignOut = {},
        )
    }
}

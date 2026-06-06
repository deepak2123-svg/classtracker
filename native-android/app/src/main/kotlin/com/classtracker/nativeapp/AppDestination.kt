package com.classtracker.nativeapp

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.School
import androidx.compose.ui.graphics.vector.ImageVector

enum class AppDestination(
    val route: String,
    val label: String,
    val icon: ImageVector,
) {
    Today(
        route = "today",
        label = "Today",
        icon = Icons.Outlined.Home,
    ),
    Classes(
        route = "classes",
        label = "Classes",
        icon = Icons.Outlined.School,
    ),
    Profile(
        route = "profile",
        label = "Profile",
        icon = Icons.Outlined.AccountCircle,
    ),
}

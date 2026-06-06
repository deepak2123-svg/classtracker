package com.classtracker.nativeapp

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.Home
import androidx.compose.ui.graphics.vector.ImageVector

enum class AppDestination(
    val route: String,
    val label: String,
    val icon: ImageVector,
) {
    Home(
        route = "home",
        label = "home",
        icon = Icons.Outlined.Home,
    ),
    Stats(
        route = "stats",
        label = "stats",
        icon = Icons.Outlined.BarChart,
    ),
    Profile(
        route = "profile",
        label = "profile",
        icon = Icons.Outlined.AccountCircle,
    ),
}

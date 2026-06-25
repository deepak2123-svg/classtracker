package com.classtracker.nativeapp

import android.net.Uri
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.MenuBook
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
    Syllabus(
        route = "syllabus",
        label = "syllabus",
        icon = Icons.Outlined.MenuBook,
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

object AppRoutes {
    const val ClassEntryPattern = "class-entry/{classId}"
    const val ClassHistoryPattern = "class/{classId}"
    const val RecycleBin = "recycle-bin"
    const val Reports = "reports"
    const val Feedback = "feedback"
    const val AddClass = "add-class"
    const val ManageClasses = "manage-classes"
    const val NewEntryPattern = "entry/new/{classId}/{dateKey}"
    const val EditEntryPattern = "entry/edit/{classId}/{entryId}"
    const val DuplicateEntryPattern = "entry/duplicate/{classId}/{entryId}"

    fun classEntry(classId: String): String = "class-entry/${classId.asRouteArg()}"

    fun classHistory(classId: String): String = "class/${classId.asRouteArg()}"

    fun newEntry(classId: String, dateKey: String): String =
        "entry/new/${classId.asRouteArg()}/${dateKey.asRouteArg()}"

    fun editEntry(classId: String, entryId: String): String =
        "entry/edit/${classId.asRouteArg()}/${entryId.asRouteArg()}"

    fun duplicateEntry(classId: String, entryId: String): String =
        "entry/duplicate/${classId.asRouteArg()}/${entryId.asRouteArg()}"

    fun decodeArgument(value: String?): String = Uri.decode(value.orEmpty()).orEmpty()
}

private fun String.asRouteArg(): String = Uri.encode(this).orEmpty()

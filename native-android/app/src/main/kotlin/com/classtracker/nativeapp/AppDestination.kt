package com.classtracker.nativeapp

import android.net.Uri
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.Home
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavBackStackEntry

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
        icon = Icons.AutoMirrored.Outlined.MenuBook,
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
    private const val ClassIdArg = "classId"
    private const val DateKeyArg = "dateKey"
    private const val EntryIdArg = "entryId"

    const val ClassEntryPattern = "class-entry/{$ClassIdArg}"
    const val ClassHistoryPattern = "class/{$ClassIdArg}"
    const val RecycleBin = "recycle-bin"
    const val Reports = "reports"
    const val Feedback = "feedback"
    const val AddClass = "add-class"
    const val ManageClasses = "manage-classes"
    const val NewEntryPattern = "entry/new/{$ClassIdArg}/{$DateKeyArg}"
    const val EditEntryPattern = "entry/edit/{$ClassIdArg}/{$EntryIdArg}"
    const val DuplicateEntryPattern = "entry/duplicate/{$ClassIdArg}/{$EntryIdArg}"

    fun classEntry(classId: String): String = "class-entry/${classId.asRouteArg()}"

    fun classHistory(classId: String): String = "class/${classId.asRouteArg()}"

    fun newEntry(classId: String, dateKey: String): String =
        "entry/new/${classId.asRouteArg()}/${dateKey.asRouteArg()}"

    fun editEntry(classId: String, entryId: String): String =
        "entry/edit/${classId.asRouteArg()}/${entryId.asRouteArg()}"

    fun duplicateEntry(classId: String, entryId: String): String =
        "entry/duplicate/${classId.asRouteArg()}/${entryId.asRouteArg()}"

    fun classId(entry: NavBackStackEntry): String = entry.decodedArgument(ClassIdArg)

    fun dateKey(entry: NavBackStackEntry): String = entry.decodedArgument(DateKeyArg)

    fun entryId(entry: NavBackStackEntry): String = entry.decodedArgument(EntryIdArg)
}

private fun String.asRouteArg(): String = Uri.encode(this).orEmpty()

private fun NavBackStackEntry.decodedArgument(key: String): String =
    Uri.decode(arguments?.getString(key).orEmpty()).orEmpty()

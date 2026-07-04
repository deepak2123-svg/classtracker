package com.ledgr.timetable

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.viewmodel.compose.viewModel
import com.ledgr.timetable.data.TimetableDatabase
import com.ledgr.timetable.data.TimetableRepository
import com.ledgr.timetable.ui.TimetableApp
import com.ledgr.timetable.ui.TimetableViewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val database = TimetableDatabase.get(this)
        val repository = TimetableRepository(database)

        setContent {
            val viewModel: TimetableViewModel = viewModel(
                factory = TimetableViewModel.Factory(repository),
            )
            TimetableApp(viewModel = viewModel)
        }
    }
}

package com.ledgr.timetable.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ledgr.timetable.ui.components.AppHeader
import com.ledgr.timetable.ui.screens.InstituteRail
import com.ledgr.timetable.ui.screens.MainWorkspace
import com.ledgr.timetable.ui.theme.TimetableColors
import com.ledgr.timetable.ui.theme.TimetableTheme

@Composable
fun TimetableApp(viewModel: TimetableViewModel) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    TimetableTheme {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = TimetableColors.Panel,
        ) {
            Column {
                AppHeader()
                Row(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                ) {
                    InstituteRail(
                        modifier = Modifier.weight(0.82f),
                        institutes = uiState.institutes,
                        selectedInstituteId = uiState.selectedInstitute?.id,
                        onSelectInstitute = viewModel::selectInstitute,
                        onAddInstitute = viewModel::addInstitute,
                    )
                    MainWorkspace(
                        modifier = Modifier.weight(2.1f),
                        uiState = uiState,
                        onSelectTimetable = viewModel::selectTimetable,
                        onCreateTimetable = viewModel::addTimetable,
                        onModeChange = viewModel::selectMode,
                        onPublish = viewModel::publish,
                        onGenerate = viewModel::generate,
                        onAddSection = viewModel::addSection,
                        onAddStaff = viewModel::addStaff,
                        onAddMapping = viewModel::addMapping,
                    )
                }
            }
        }
    }
}

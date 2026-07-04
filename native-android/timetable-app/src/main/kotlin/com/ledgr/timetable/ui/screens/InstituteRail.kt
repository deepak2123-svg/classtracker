package com.ledgr.timetable.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ledgr.timetable.data.InstituteEntity
import com.ledgr.timetable.ui.components.Label
import com.ledgr.timetable.ui.theme.TimetableColors

@Composable
fun InstituteRail(
    modifier: Modifier,
    institutes: List<InstituteEntity>,
    selectedInstituteId: String?,
    onSelectInstitute: (String) -> Unit,
    onAddInstitute: (String) -> Unit,
) {
    var newInstitute by rememberSaveable { mutableStateOf("") }

    Card(
        modifier = modifier.fillMaxSize(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, TimetableColors.Border),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(14.dp),
        ) {
            Label("Institutes")
            Text("Separate local timetable spaces", color = TimetableColors.Muted, fontSize = 13.sp)
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = newInstitute,
                onValueChange = { newInstitute = it },
                label = { Text("New institute") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(8.dp))
            Button(
                onClick = {
                    if (newInstitute.isNotBlank()) {
                        onAddInstitute(newInstitute)
                        newInstitute = ""
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Icon(Icons.Outlined.Home, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.size(8.dp))
                Text("Add institute")
            }
            Spacer(Modifier.height(12.dp))
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(institutes, key = { it.id }) { institute ->
                    InstituteRow(
                        institute = institute,
                        selected = institute.id == selectedInstituteId,
                        onClick = { onSelectInstitute(institute.id) },
                    )
                }
            }
        }
    }
}

@Composable
private fun InstituteRow(
    institute: InstituteEntity,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val colors = if (selected) {
        CardDefaults.cardColors(containerColor = Color(0xFFEFF6FF))
    } else {
        CardDefaults.cardColors(containerColor = Color.White)
    }
    Card(
        onClick = onClick,
        colors = colors,
        border = BorderStroke(1.dp, if (selected) Color(0xFFBFDBFE) else TimetableColors.Border),
        shape = RoundedCornerShape(14.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .background(if (selected) TimetableColors.Blue else Color(0xFFCBD5E1), CircleShape),
            )
            Text(
                text = institute.name,
                fontWeight = FontWeight.Bold,
                color = TimetableColors.Ink,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

package com.ledgr.timetable.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.ledgr.timetable.ui.theme.TimetableColors

@Composable
fun AppHeader() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(TimetableColors.Ink)
            .padding(horizontal = 20.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .background(TimetableColors.Blue, RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text("L", color = Color.White, fontWeight = FontWeight.Black, fontSize = 22.sp)
        }
        Column(Modifier.padding(start = 12.dp)) {
            Text("Ledgr Timetable", color = Color.White, fontWeight = FontWeight.Black, fontSize = 21.sp)
            Text("Offline scheduler beta", color = Color.White.copy(alpha = 0.62f), fontSize = 12.sp)
        }
    }
}

@Composable
fun Label(value: String) {
    Text(
        text = value.uppercase(),
        color = TimetableColors.Muted,
        fontSize = 12.sp,
        fontWeight = FontWeight.Black,
        letterSpacing = 1.2.sp,
    )
}

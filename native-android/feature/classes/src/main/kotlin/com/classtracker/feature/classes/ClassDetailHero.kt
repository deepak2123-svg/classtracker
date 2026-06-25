package com.classtracker.feature.classes

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.classtracker.core.designsystem.LedgrPill
import com.classtracker.core.designsystem.LedgrTheme.colors
import com.classtracker.core.model.TeacherClass
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max

private const val HeroSwipeHorizontalBias = 1.3f
private const val HeroSwipeTouchSlopMultiplier = 1.1f

private enum class HeroGestureAxisLock {
    Horizontal,
    Vertical,
}

@Composable
internal fun ClassDetailHero(
    teacherClass: TeacherClass,
    metrics: ClassDetailMetrics,
    swipeEnabled: Boolean = false,
    canSwipePrevious: Boolean = false,
    canSwipeNext: Boolean = false,
    onSwipePrevious: () -> Unit = {},
    onSwipeNext: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    val minSwipeDistancePx = with(LocalDensity.current) { 64.dp.toPx() }
    val currentOnSwipePrevious by rememberUpdatedState(onSwipePrevious)
    val currentOnSwipeNext by rememberUpdatedState(onSwipeNext)
    val swipeModifier = Modifier.pointerInput(
        swipeEnabled,
        canSwipePrevious,
        canSwipeNext,
        minSwipeDistancePx,
    ) {
        if (swipeEnabled && (canSwipePrevious || canSwipeNext)) {
            awaitEachGesture {
                val down = awaitFirstDown(requireUnconsumed = false)
                val touchSlop = viewConfiguration.touchSlop
                var axisLock: HeroGestureAxisLock? = null
                var totalDeltaX = 0f
                var totalDeltaY = 0f
                var dragHandled = false

                while (true) {
                    val event = awaitPointerEvent()
                    val change = event.changes.firstOrNull { it.id == down.id } ?: break
                    if (!change.pressed) break

                    val delta = change.position - change.previousPosition
                    totalDeltaX += delta.x
                    totalDeltaY += delta.y

                    if (axisLock == null) {
                        val absX = abs(totalDeltaX)
                        val absY = abs(totalDeltaY)
                        if (absX > touchSlop || absY > touchSlop) {
                            axisLock = if (
                                absX >= touchSlop * HeroSwipeTouchSlopMultiplier &&
                                absX > absY * HeroSwipeHorizontalBias
                            ) {
                                HeroGestureAxisLock.Horizontal
                            } else {
                                HeroGestureAxisLock.Vertical
                            }
                        }
                    }

                    when (axisLock) {
                        HeroGestureAxisLock.Horizontal -> {
                            change.consume()
                            dragHandled = true
                        }

                        HeroGestureAxisLock.Vertical -> break
                        null -> Unit
                    }
                }

                if (dragHandled) {
                    val swipeTriggerPx = max(minSwipeDistancePx, size.width * 0.14f)
                    when {
                        totalDeltaX >= swipeTriggerPx && canSwipePrevious -> {
                            currentOnSwipePrevious()
                        }

                        totalDeltaX <= -swipeTriggerPx && canSwipeNext -> {
                            currentOnSwipeNext()
                        }
                    }
                }
            }
        }
    }
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .then(swipeModifier),
        color = colors.heroPanelSurface,
        shape = RoundedCornerShape(22.dp),
        shadowElevation = 0.dp,
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(13.dp),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top,
                ) {
                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        Text(
                            text = teacherClass.sectionName,
                            style = MaterialTheme.typography.headlineMedium.copy(
                                fontSize = 23.sp,
                                lineHeight = 27.sp,
                                fontWeight = FontWeight.ExtraBold,
                            ),
                            color = Color.White,
                        )
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(7.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            LedgrPill(
                                text = teacherClass.instituteName.ifBlank { "No institute" },
                                modifier = Modifier.weight(1f, fill = false),
                                containerColor = Color.White.copy(alpha = 0.14f),
                                contentColor = Color.White,
                                borderColor = Color.Transparent,
                                leadingColor = colors.green,
                            )
                            if (teacherClass.subjectName.isNotBlank()) {
                                LedgrPill(
                                    text = teacherClass.subjectName,
                                    modifier = Modifier.weight(1f, fill = false),
                                    containerColor = Color.White.copy(alpha = 0.14f),
                                    contentColor = Color.White,
                                    borderColor = Color.Transparent,
                                )
                            }
                        }
                    }
                    TodayStatusPill(metrics.todayEntries)
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                HeroStat("Today", metrics.todayEntries.toString(), Modifier.weight(1f))
                HeroStat(currentMonthLabel(), metrics.monthEntries.toString(), Modifier.weight(1f))
                HeroStat("Total", metrics.totalEntries.toString(), Modifier.weight(1f))
                HeroStat("Days", metrics.activeDays.toString(), Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun TodayStatusPill(todayEntries: Int) {
    val logged = todayEntries > 0
    Surface(
        color = if (logged) colors.successSurface else colors.warningSurfaceStrong,
        contentColor = if (logged) colors.successStrong else colors.warningTextStrong,
        shape = RoundedCornerShape(999.dp),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 11.dp, vertical = 5.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(7.dp)
                    .background(color = if (logged) colors.green else colors.amber, shape = CircleShape),
            )
            Text(
                text = if (logged) "Logged today" else "Not logged today",
                style = MaterialTheme.typography.labelMedium,
            )
        }
    }
}

@Composable
private fun HeroStat(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        color = colors.heroPanelBorder,
        shape = RoundedCornerShape(14.dp),
    ) {
        Column(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge.copy(
                    fontSize = 21.sp,
                    lineHeight = 23.sp,
                    fontWeight = FontWeight.ExtraBold,
                ),
                color = Color.White,
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelMedium,
                color = Color.White.copy(alpha = 0.72f),
                maxLines = 1,
            )
        }
    }
}

internal data class ClassDetailMetrics(
    val todayEntries: Int,
    val monthEntries: Int,
    val totalEntries: Int,
    val activeDays: Int,
)

private fun currentMonthLabel(): String =
    SimpleDateFormat("MMM", Locale.US).format(Date())

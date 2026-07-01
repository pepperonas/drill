package io.celox.drillgo.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp

private val DrillGoShapes = Shapes(
    extraSmall = RoundedCornerShape(6.dp),
    small = RoundedCornerShape(10.dp),
    medium = RoundedCornerShape(16.dp),
    large = RoundedCornerShape(22.dp),
    extraLarge = RoundedCornerShape(30.dp),
)

@Composable
fun DrillGoTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DrillGoColors,
        typography = DrillGoType,
        shapes = DrillGoShapes,
        content = content,
    )
}

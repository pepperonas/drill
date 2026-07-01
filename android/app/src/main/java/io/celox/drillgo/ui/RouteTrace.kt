package io.celox.drillgo.ui

import androidx.compose.foundation.Canvas
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.Stroke
import kotlin.math.PI
import kotlin.math.cos

/** Draws a GPS route as an aspect-preserving trace (lat/lng, cos-lat corrected). */
@Composable
fun RouteTrace(
    points: List<Pair<Double, Double>>,
    modifier: Modifier = Modifier,
    stroke: Color = MaterialTheme.colorScheme.primary,
) {
    val startDot = MaterialTheme.colorScheme.onSurfaceVariant
    Canvas(modifier) {
        if (points.size < 2) return@Canvas
        val midLat = (points.minOf { it.first } + points.maxOf { it.first }) / 2 * PI / 180
        val xs = points.map { it.second * cos(midLat) }
        val ys = points.map { it.first }
        val minX = xs.min(); val maxX = xs.max()
        val minY = ys.min(); val maxY = ys.max()
        val span = maxOf(maxX - minX, maxY - minY, 1e-9)
        val s = minOf(size.width, size.height) * (1f - 0.24f)
        val cx = size.width / 2; val cy = size.height / 2
        val mx = (minX + maxX) / 2; val my = (minY + maxY) / 2
        fun proj(i: Int) = Offset(
            cx + ((xs[i] - mx) / span * s).toFloat(),
            cy - ((ys[i] - my) / span * s).toFloat(),
        )
        val path = Path()
        points.indices.forEach { i ->
            val o = proj(i)
            if (i == 0) path.moveTo(o.x, o.y) else path.lineTo(o.x, o.y)
        }
        drawPath(path, color = stroke, style = Stroke(width = 7f, cap = StrokeCap.Round, join = StrokeJoin.Round))
        drawCircle(startDot, radius = 8f, center = proj(0))
        drawCircle(stroke, radius = 8f, center = proj(points.size - 1))
    }
}

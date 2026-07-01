package io.celox.drillgo.location

import kotlinx.coroutines.flow.MutableStateFlow
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * Process-wide recording state, published by LocationTrackingService and observed
 * by the UI. Kept as a singleton so the foreground service and Compose share it.
 */
object Recorder {
    data class State(
        val active: Boolean = false,
        val finished: Boolean = false,     // stopped, awaiting save/discard
        val startTime: Long = 0,
        val endTime: Long = 0,
        val distanceM: Double = 0.0,
        val durationS: Long = 0,
        val movingS: Long = 0,
        val currentSpeedMps: Double = 0.0,
        val maxSpeedMps: Double = 0.0,
        val steps: Int = 0,
        val detectedType: String = "walk",
        val points: List<Pair<Double, Double>> = emptyList(),
    )

    val state = MutableStateFlow(State())

    fun reset() { state.value = State() }
}

object Geo {
    private const val R = 6_371_000.0 // earth radius, m

    fun haversine(a: Pair<Double, Double>, b: Pair<Double, Double>): Double {
        val dLat = Math.toRadians(b.first - a.first)
        val dLng = Math.toRadians(b.second - a.second)
        val lat1 = Math.toRadians(a.first)
        val lat2 = Math.toRadians(b.first)
        val h = sin(dLat / 2) * sin(dLat / 2) + cos(lat1) * cos(lat2) * sin(dLng / 2) * sin(dLng / 2)
        return 2 * R * atan2(sqrt(h), sqrt(1 - h))
    }

    /** Speed-based type guess (m/s): <2.4 walk, <5.5 run, else cycle. */
    fun classify(avgMps: Double): String = when {
        avgMps >= 5.5 -> "cycle"
        avgMps >= 2.4 -> "run"
        else -> "walk"
    }
}

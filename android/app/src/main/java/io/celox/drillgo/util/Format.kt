package io.celox.drillgo.util

import java.util.Locale

object Format {
    private val L = Locale.GERMANY

    fun km(m: Double): String {
        val km = m / 1000.0
        return if (km >= 10) String.format(L, "%.1f km", km) else String.format(L, "%.2f km", km)
    }

    fun duration(totalS: Long): String {
        val s = if (totalS < 0) 0 else totalS
        val h = s / 3600; val m = (s % 3600) / 60; val sec = s % 60
        return if (h > 0) String.format(L, "%d:%02d:%02d", h, m, sec) else String.format(L, "%d:%02d", m, sec)
    }

    /** Cycling → km/h, foot activities → min/km. */
    fun speedOrPace(type: String, distanceM: Double, movingS: Long): String {
        if (distanceM < 1 || movingS < 1) return "–"
        if (type == "cycle") return String.format(L, "%.1f km/h", (distanceM / 1000.0) / (movingS / 3600.0))
        val paceSecPerKm = movingS / (distanceM / 1000.0)
        val m = (paceSecPerKm / 60).toInt(); val s = (paceSecPerKm % 60).toInt()
        return String.format(L, "%d:%02d /km", m, s)
    }

    fun typeIcon(type: String): String = when (type) {
        "run" -> "🏃"; "cycle" -> "🚴"; "hike" -> "🥾"; "walk" -> "🚶"; else -> "🗺️"
    }

    fun typeLabel(type: String): String = when (type) {
        "run" -> "Joggen"; "cycle" -> "Radfahren"; "hike" -> "Wandern"; "walk" -> "Spaziergang"; else -> "Aktivität"
    }
}

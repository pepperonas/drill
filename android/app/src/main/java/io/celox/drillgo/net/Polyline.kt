package io.celox.drillgo.net

import kotlin.math.roundToInt

/** Google-encoded polyline (precision 5) — matches the server/web decoder. */
object Polyline {
    fun encode(points: List<Pair<Double, Double>>, precision: Int = 5): String {
        val factor = Math.pow(10.0, precision.toDouble())
        val sb = StringBuilder()
        var lastLat = 0L
        var lastLng = 0L
        for ((lat, lng) in points) {
            val latE = (lat * factor).roundToInt().toLong()
            val lngE = (lng * factor).roundToInt().toLong()
            encodeDelta(latE - lastLat, sb)
            encodeDelta(lngE - lastLng, sb)
            lastLat = latE
            lastLng = lngE
        }
        return sb.toString()
    }

    private fun encodeDelta(vIn: Long, sb: StringBuilder) {
        var v = if (vIn < 0) (vIn shl 1).inv() else (vIn shl 1)
        while (v >= 0x20) {
            sb.append(((0x20 or (v and 0x1f).toInt()) + 63).toChar())
            v = v shr 5
        }
        sb.append((v.toInt() + 63).toChar())
    }

    fun decode(encoded: String, precision: Int = 5): List<Pair<Double, Double>> {
        if (encoded.isEmpty()) return emptyList()
        val factor = Math.pow(10.0, precision.toDouble())
        val out = ArrayList<Pair<Double, Double>>()
        var index = 0; var lat = 0L; var lng = 0L
        while (index < encoded.length) {
            var shift = 0; var result = 0L; var b: Int
            do { b = encoded[index++].code - 63; result = result or ((b and 0x1f).toLong() shl shift); shift += 5 } while (b >= 0x20)
            lat += if (result and 1L != 0L) (result shr 1).inv() else (result shr 1)
            shift = 0; result = 0
            do { b = encoded[index++].code - 63; result = result or ((b and 0x1f).toLong() shl shift); shift += 5 } while (b >= 0x20)
            lng += if (result and 1L != 0L) (result shr 1).inv() else (result shr 1)
            out.add(lat / factor to lng / factor)
        }
        return out
    }
}

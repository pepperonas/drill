package io.celox.drillgo.net

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ClaimReq(val code: String, @SerialName("device_name") val deviceName: String)

@Serializable
data class ClaimResp(val token: String, val user: ClaimUser? = null)

@Serializable
data class ClaimUser(val name: String? = null, val email: String? = null)

@Serializable
data class ActivityReq(
    val type: String,
    val day: String,
    @SerialName("start_time") val startTime: Long,
    @SerialName("end_time") val endTime: Long,
    @SerialName("distance_m") val distanceM: Double,
    @SerialName("duration_s") val durationS: Long,
    @SerialName("moving_time_s") val movingTimeS: Long,
    @SerialName("avg_speed_mps") val avgSpeedMps: Double,
    @SerialName("max_speed_mps") val maxSpeedMps: Double,
    val steps: Int,
    val polyline: String,
    @SerialName("point_count") val pointCount: Int,
    val title: String? = null,
    val source: String = "android",
    @SerialName("client_uuid") val clientUuid: String,
)

@Serializable
data class ActivityResp(val activity: ActivityRow, val gami: Gami? = null, val duplicate: Boolean = false)

@Serializable
data class ActivityRow(val id: Long)

@Serializable
data class Gami(
    val xp: Int = 0,
    val level: Int = 1,
    val streak: Int = 0,
    val unlocked: List<Unlocked> = emptyList(),
)

@Serializable
data class Unlocked(val code: String, val name: String, val icon: String)

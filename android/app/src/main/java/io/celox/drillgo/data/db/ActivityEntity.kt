package io.celox.drillgo.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

/** A recorded activity, persisted locally and synced to the server. */
@Entity(tableName = "activities")
data class ActivityEntity(
    @PrimaryKey val clientUuid: String,
    val type: String,
    val day: String,          // YYYY-MM-DD (local)
    val startTime: Long,      // unix seconds
    val endTime: Long,
    val distanceM: Double,
    val durationS: Long,
    val movingS: Long,
    val avgSpeedMps: Double,
    val maxSpeedMps: Double,
    val steps: Int,
    val polyline: String,
    val pointCount: Int,
    val title: String?,
    val status: String = "pending",   // pending | uploaded
    val serverId: Long? = null,
    val createdAt: Long,
)

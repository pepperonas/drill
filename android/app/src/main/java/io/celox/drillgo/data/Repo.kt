package io.celox.drillgo.data

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import io.celox.drillgo.data.db.ActivityDao
import io.celox.drillgo.data.db.ActivityEntity
import io.celox.drillgo.location.Recorder
import io.celox.drillgo.net.Api
import io.celox.drillgo.net.ActivityReq
import io.celox.drillgo.net.ClaimReq
import io.celox.drillgo.net.Polyline
import io.celox.drillgo.sync.SyncWorker
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate
import java.util.UUID
import java.util.concurrent.TimeUnit

class Repo(
    private val context: Context,
    private val dao: ActivityDao,
    val prefs: Prefs,
) {
    private val api: Api = Api.create(prefs)

    val activities: Flow<List<ActivityEntity>> = dao.observeAll()

    suspend fun claim(code: String, deviceName: String): Result<Unit> = try {
        val resp = api.claim(ClaimReq(code.trim().uppercase(), deviceName))
        prefs.setSession(resp.token, resp.user?.name)
        Result.success(Unit)
    } catch (e: Exception) {
        Result.failure(e)
    }

    /** Persist a finished recording as pending and kick off a sync. */
    suspend fun saveRecording(state: Recorder.State, type: String, title: String?): ActivityEntity {
        val end = if (state.endTime > 0) state.endTime else System.currentTimeMillis() / 1000
        val avg = if (state.movingS > 0) state.distanceM / state.movingS else 0.0
        val entity = ActivityEntity(
            clientUuid = UUID.randomUUID().toString(),
            type = type,
            day = LocalDate.now().toString(),
            startTime = state.startTime,
            endTime = end,
            distanceM = state.distanceM,
            durationS = state.durationS,
            movingS = state.movingS,
            avgSpeedMps = avg,
            maxSpeedMps = state.maxSpeedMps,
            steps = state.steps,
            polyline = Polyline.encode(state.points),
            pointCount = state.points.size,
            title = title?.ifBlank { null },
            status = "pending",
            serverId = null,
            createdAt = System.currentTimeMillis() / 1000,
        )
        dao.insert(entity)
        enqueueSync(context)
        return entity
    }

    suspend fun syncPending(): Boolean {
        var allOk = true
        for (a in dao.pending()) {
            try {
                val resp = api.uploadActivity(a.toReq())
                dao.markUploaded(a.clientUuid, resp.activity.id)
            } catch (e: Exception) {
                allOk = false
            }
        }
        return allOk
    }

    suspend fun delete(a: ActivityEntity) = dao.delete(a)

    private fun ActivityEntity.toReq() = ActivityReq(
        type = type, day = day, startTime = startTime, endTime = endTime,
        distanceM = distanceM, durationS = durationS, movingTimeS = movingS,
        avgSpeedMps = avgSpeedMps, maxSpeedMps = maxSpeedMps, steps = steps,
        polyline = polyline, pointCount = pointCount, title = title, clientUuid = clientUuid,
    )

    companion object {
        fun enqueueSync(context: Context) {
            val req = OneTimeWorkRequestBuilder<SyncWorker>()
                .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(context)
                .enqueueUniqueWork("sync-activities", ExistingWorkPolicy.APPEND_OR_REPLACE, req)
        }
    }
}

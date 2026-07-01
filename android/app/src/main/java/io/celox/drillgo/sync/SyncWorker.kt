package io.celox.drillgo.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import io.celox.drillgo.App

/** Uploads pending activities; retries with backoff while offline / on error. */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val container = (applicationContext as App).container
        container.prefs.load()                       // ensure the token is cached
        if (container.prefs.cachedToken == null) return Result.success() // not paired yet
        return if (container.repo.syncPending()) Result.success() else Result.retry()
    }
}

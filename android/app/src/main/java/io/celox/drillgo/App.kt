package io.celox.drillgo

import android.app.Application
import android.content.Context
import io.celox.drillgo.data.Prefs
import io.celox.drillgo.data.Repo
import io.celox.drillgo.data.db.AppDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class App : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        // Warm the token cache and retry any pending uploads on launch.
        CoroutineScope(Dispatchers.IO).launch {
            container.prefs.load()
            Repo.enqueueSync(this@App)
        }
    }
}

class AppContainer(context: Context) {
    val prefs = Prefs(context)
    private val db = AppDatabase.get(context)
    val repo = Repo(context, db.activityDao(), prefs)
}

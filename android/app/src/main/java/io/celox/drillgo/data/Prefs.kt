package io.celox.drillgo.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "drillgo")

/**
 * DataStore-backed settings. The device token is also mirrored into a volatile
 * cache so the OkHttp auth interceptor can read it synchronously.
 */
class Prefs(private val context: Context) {
    @Volatile var cachedToken: String? = null
        private set
    @Volatile var cachedUser: String? = null
        private set

    val tokenFlow: Flow<String?> = context.dataStore.data.map { it[TOKEN] }
    val userFlow: Flow<String?> = context.dataStore.data.map { it[USER] }

    suspend fun load() {
        val prefs = context.dataStore.data.first()
        cachedToken = prefs[TOKEN]
        cachedUser = prefs[USER]
    }

    suspend fun setSession(token: String, user: String?) {
        cachedToken = token
        cachedUser = user
        context.dataStore.edit {
            it[TOKEN] = token
            if (user != null) it[USER] = user
        }
    }

    suspend fun clear() {
        cachedToken = null
        cachedUser = null
        context.dataStore.edit { it.clear() }
    }

    companion object {
        private val TOKEN = stringPreferencesKey("device_token")
        private val USER = stringPreferencesKey("user_name")
        const val BASE_URL = "https://drill.celox.io/"
    }
}

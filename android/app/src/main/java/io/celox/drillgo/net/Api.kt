package io.celox.drillgo.net

import io.celox.drillgo.data.Prefs
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST

interface Api {
    @POST("api/pairing/claim")
    suspend fun claim(@Body body: ClaimReq): ClaimResp

    @POST("api/activities")
    suspend fun uploadActivity(@Body body: ActivityReq): ActivityResp

    companion object {
        fun create(prefs: Prefs): Api {
            val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
            val auth = Interceptor { chain ->
                val token = prefs.cachedToken
                val req = if (token != null) {
                    chain.request().newBuilder().header("Authorization", "Bearer $token").build()
                } else chain.request()
                chain.proceed(req)
            }
            val client = OkHttpClient.Builder().addInterceptor(auth).build()
            return Retrofit.Builder()
                .baseUrl(Prefs.BASE_URL)
                .client(client)
                .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
                .build()
                .create(Api::class.java)
        }
    }
}

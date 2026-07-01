package io.celox.drillgo.location

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import io.celox.drillgo.MainActivity
import io.celox.drillgo.R
import io.celox.drillgo.util.Format
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Foreground service that records the GPS track while the app is backgrounded /
 * screen off. Started from a visible Activity, so it needs no background-location
 * permission. Publishes live state to [Recorder]; on stop it leaves a finished
 * state for the summary screen to save.
 */
class LocationTrackingService : Service(), SensorEventListener {

    private lateinit var fused: FusedLocationProviderClient
    private var sensorManager: SensorManager? = null
    private var stepSensor: Sensor? = null
    private var stepBaseline: Float = -1f
    private var steps = 0

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var tickJob: Job? = null

    private val points = mutableListOf<Pair<Double, Double>>()
    private var lastAccepted: Pair<Double, Double>? = null
    private var distance = 0.0
    private var maxSpeed = 0.0
    private var startTime = 0L
    private var movingMs = 0L
    private var lastFixTime = 0L
    private val recentSpeeds = ArrayDeque<Double>()

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            result.locations.forEach(::onFix)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        fused = LocationServices.getFusedLocationProviderClient(this)
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        stepSensor = sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) { stopRecording(); return START_NOT_STICKY }
        startRecording()
        return START_STICKY
    }

    @SuppressLint("MissingPermission")
    private fun startRecording() {
        if (startTime != 0L) return
        startTime = System.currentTimeMillis()
        Recorder.state.value = Recorder.State(active = true, startTime = startTime / 1000)
        ensureChannel()
        ServiceCompat.startForeground(
            this, NOTIF_ID, buildNotification("0,00 km", "0:00"),
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0,
        )
        val req = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 3000L)
            .setMinUpdateIntervalMillis(2000L)
            .setMinUpdateDistanceMeters(0f)
            .build()
        try { fused.requestLocationUpdates(req, callback, Looper.getMainLooper()) } catch (_: SecurityException) {}
        stepSensor?.let { sensorManager?.registerListener(this, it, SensorManager.SENSOR_DELAY_NORMAL) }
        tickJob = scope.launch {
            while (isActive) { delay(1000); publish() }
        }
    }

    private fun onFix(loc: Location) {
        if (loc.accuracy > 30f) return
        val p = loc.latitude to loc.longitude
        val now = System.currentTimeMillis()
        val prev = lastAccepted
        if (prev != null) {
            val d = Geo.haversine(prev, p)
            if (d < 3.0) return
            distance += d
            val dt = ((now - lastFixTime).coerceAtLeast(1)).toDouble() / 1000.0
            val spd = if (loc.hasSpeed()) loc.speed.toDouble() else d / dt
            if (spd > maxSpeed) maxSpeed = spd
            if (spd > 0.5) movingMs += (now - lastFixTime)
            recentSpeeds.addLast(spd)
            if (recentSpeeds.size > 8) recentSpeeds.removeFirst()
        }
        lastAccepted = p
        lastFixTime = now
        points.add(p)
        publish()
    }

    private fun publish() {
        if (startTime == 0L) return
        val durS = (System.currentTimeMillis() - startTime) / 1000
        val avg = if (recentSpeeds.isEmpty()) 0.0 else recentSpeeds.average()
        val s = Recorder.State(
            active = true, startTime = startTime / 1000,
            distanceM = distance, durationS = durS, movingS = movingMs / 1000,
            currentSpeedMps = recentSpeeds.lastOrNull() ?: 0.0, maxSpeedMps = maxSpeed,
            steps = steps, detectedType = Geo.classify(avg), points = points.toList(),
        )
        Recorder.state.value = s
        getSystemService(NotificationManager::class.java)
            ?.notify(NOTIF_ID, buildNotification(Format.km(s.distanceM), Format.duration(s.durationS)))
    }

    override fun onSensorChanged(event: SensorEvent) {
        if (event.sensor.type == Sensor.TYPE_STEP_COUNTER) {
            val total = event.values[0]
            if (stepBaseline < 0) stepBaseline = total
            steps = (total - stepBaseline).toInt().coerceAtLeast(0)
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    private fun stopRecording() {
        tickJob?.cancel()
        try { fused.removeLocationUpdates(callback) } catch (_: Exception) {}
        sensorManager?.unregisterListener(this)
        val end = System.currentTimeMillis()
        val durS = if (startTime == 0L) 0 else (end - startTime) / 1000
        val avg = if (recentSpeeds.isEmpty()) 0.0 else recentSpeeds.average()
        Recorder.state.value = Recorder.state.value.copy(
            active = false, finished = points.size >= 2, endTime = end / 1000,
            durationS = durS, distanceM = distance, movingS = movingMs / 1000,
            maxSpeedMps = maxSpeed, steps = steps, points = points.toList(),
            detectedType = Geo.classify(avg),
        )
        startTime = 0L
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL, getString(R.string.notif_channel), NotificationManager.IMPORTANCE_LOW)
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(ch)
        }
    }

    private fun buildNotification(dist: String, time: String): Notification {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_track)
            .setContentTitle("Aufzeichnung läuft")
            .setContentText("$dist · $time")
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(open)
            .build()
    }

    companion object {
        const val ACTION_STOP = "io.celox.drillgo.STOP"
        private const val NOTIF_ID = 1
        private const val CHANNEL = "recording"

        fun start(context: Context) =
            ContextCompat.startForegroundService(context, Intent(context, LocationTrackingService::class.java))

        fun stop(context: Context) =
            context.startService(Intent(context, LocationTrackingService::class.java).setAction(ACTION_STOP))
    }
}

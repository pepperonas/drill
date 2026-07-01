package io.celox.drillgo.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.celox.drillgo.AppContainer
import io.celox.drillgo.data.db.ActivityEntity
import io.celox.drillgo.location.LocationTrackingService
import io.celox.drillgo.location.Recorder
import io.celox.drillgo.net.Polyline
import io.celox.drillgo.util.Format
import kotlinx.coroutines.launch

@Composable
fun DrillGoApp(container: AppContainer, hasLocationPermission: () -> Boolean, requestPermissions: () -> Unit) {
    val token by container.prefs.tokenFlow.collectAsStateWithLifecycle(initialValue = container.prefs.cachedToken)
    val rec by Recorder.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    Surface(
        Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.safeDrawing),
        color = MaterialTheme.colorScheme.background,
    ) {
        when {
            token == null -> PairingScreen(pair = { code -> container.repo.claim(code, android.os.Build.MODEL ?: "Android") })
            rec.active -> RecordingScreen(rec) { LocationTrackingService.stop(context) }
            rec.finished -> SummaryScreen(
                rec,
                onSave = { type, title -> scope.launch { container.repo.saveRecording(rec, type, title); Recorder.reset() } },
                onDiscard = { Recorder.reset() },
            )
            else -> HomeScreen(
                container,
                onStart = { if (hasLocationPermission()) LocationTrackingService.start(context) else requestPermissions() },
            )
        }
    }
}

/* ---------------------------------------------------------------- Pairing -- */

@Composable
private fun PairingScreen(pair: suspend (String) -> Result<Unit>) {
    var code by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text("drill · go", style = MaterialTheme.typography.displayMedium, color = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(12.dp))
        Text(
            "Öffne drill.celox.io → Einstellungen → „Gerät koppeln“ und gib den Code hier ein.",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(24.dp))
        OutlinedTextField(
            value = code,
            onValueChange = { code = it.uppercase().filter(Char::isLetterOrDigit).take(6); error = null },
            label = { Text("Kopplungscode") },
            singleLine = true,
            textStyle = MaterialTheme.typography.headlineSmall.copy(letterSpacing = 6.sp, textAlign = TextAlign.Center),
            modifier = Modifier.fillMaxWidth(),
        )
        error?.let {
            Spacer(Modifier.height(8.dp))
            Text(it, color = MaterialTheme.colorScheme.error)
        }
        Spacer(Modifier.height(20.dp))
        Button(
            onClick = {
                busy = true; error = null
                scope.launch {
                    val r = pair(code)
                    busy = false
                    if (r.isFailure) error = "Code ungültig oder abgelaufen."
                }
            },
            enabled = code.length >= 6 && !busy,
            modifier = Modifier.fillMaxWidth().height(56.dp),
            shape = CircleShape,
        ) { Text(if (busy) "Koppeln…" else "Koppeln", fontWeight = FontWeight.W800) }
    }
}

/* ------------------------------------------------------------------- Home -- */

@Composable
private fun HomeScreen(container: AppContainer, onStart: () -> Unit) {
    val activities by container.repo.activities.collectAsStateWithLifecycle(initialValue = emptyList())
    val scope = rememberCoroutineScope()

    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("drill · go", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary, modifier = Modifier.weight(1f))
                TextButton(onClick = { scope.launch { container.prefs.clear() } }) { Text("Entkoppeln") }
            }
        }
        item {
            Box(Modifier.fillMaxWidth().padding(vertical = 24.dp), contentAlignment = Alignment.Center) {
                Surface(
                    shape = CircleShape,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(200.dp).clickable(onClick = onStart),
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text("START", fontSize = 40.sp, color = MaterialTheme.colorScheme.onPrimary, fontWeight = FontWeight.W800)
                    }
                }
            }
        }
        if (activities.isNotEmpty()) {
            item { Text("Zuletzt", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            items(activities, key = { it.clientUuid }) { a -> ActivityRow(a) }
        } else {
            item {
                Text(
                    "Tippe START und geh los — deine Route, Strecke und dein Tempo werden im Hintergrund aufgezeichnet.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

@Composable
private fun ActivityRow(a: ActivityEntity) {
    Card(
        shape = RoundedCornerShape(22.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(72.dp).background(MaterialTheme.colorScheme.surfaceContainerHighest, RoundedCornerShape(16.dp))) {
                RouteTrace(Polyline.decode(a.polyline), Modifier.fillMaxSize().padding(6.dp))
            }
            Spacer(Modifier.size(14.dp))
            Column(Modifier.weight(1f)) {
                Text("${Format.typeIcon(a.type)} ${a.title ?: Format.typeLabel(a.type)}", style = MaterialTheme.typography.titleMedium)
                Text(
                    "${Format.km(a.distanceM)} · ${Format.duration(a.durationS)} · ${Format.speedOrPace(a.type, a.distanceM, a.movingS)}",
                    style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    if (a.status == "uploaded") "✓ synchronisiert" else "⏳ wird hochgeladen…",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (a.status == "uploaded") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/* -------------------------------------------------------------- Recording -- */

@Composable
private fun RecordingScreen(s: Recorder.State, onStop: () -> Unit) {
    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("${Format.typeIcon(s.detectedType)}  ${Format.typeLabel(s.detectedType)}", style = MaterialTheme.typography.headlineSmall)
        Card(
            shape = RoundedCornerShape(22.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer),
            modifier = Modifier.fillMaxWidth().aspectRatio(1.3f),
        ) {
            if (s.points.size >= 2) RouteTrace(s.points, Modifier.fillMaxSize().padding(18.dp))
            else Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("GPS wird gesucht…", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatTile(Format.km(s.distanceM), "Strecke", Modifier.weight(1f))
            StatTile(Format.duration(s.durationS), "Zeit", Modifier.weight(1f))
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            StatTile(Format.speedOrPace(s.detectedType, s.distanceM, s.movingS), if (s.detectedType == "cycle") "Tempo" else "Pace", Modifier.weight(1f))
            StatTile(if (s.steps > 0) s.steps.toString() else "–", "Schritte", Modifier.weight(1f))
        }
        Spacer(Modifier.weight(1f))
        Button(
            onClick = onStop,
            modifier = Modifier.fillMaxWidth().height(64.dp),
            shape = CircleShape,
            colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.errorContainer,
                contentColor = MaterialTheme.colorScheme.onErrorContainer,
            ),
        ) { Text("STOPP", fontWeight = FontWeight.W800, fontSize = 18.sp) }
    }
}

/* ---------------------------------------------------------------- Summary -- */

private val TYPES = listOf("walk", "run", "cycle", "hike")

@Composable
private fun SummaryScreen(s: Recorder.State, onSave: (String, String?) -> Unit, onDiscard: () -> Unit) {
    var type by remember { mutableStateOf(s.detectedType) }
    var title by remember { mutableStateOf("") }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Text("Geschafft! 🎉", style = MaterialTheme.typography.headlineMedium) }
        item {
            Card(shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainer), modifier = Modifier.fillMaxWidth().aspectRatio(1.4f)) {
                RouteTrace(s.points, Modifier.fillMaxSize().padding(18.dp))
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatTile(Format.km(s.distanceM), "Strecke", Modifier.weight(1f))
                StatTile(Format.duration(s.durationS), "Zeit", Modifier.weight(1f))
                StatTile(Format.speedOrPace(type, s.distanceM, s.movingS), if (type == "cycle") "Tempo" else "Pace", Modifier.weight(1f))
            }
        }
        item { Text("Was war es?", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TYPES.forEach { t ->
                    FilterChip(
                        selected = type == t,
                        onClick = { type = t },
                        label = { Text("${Format.typeIcon(t)} ${Format.typeLabel(t)}", maxLines = 1) },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
        item {
            OutlinedTextField(
                value = title, onValueChange = { title = it },
                label = { Text("Titel (optional)") }, singleLine = true,
                keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = ImeAction.Done),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            Button(onClick = { onSave(type, title) }, modifier = Modifier.fillMaxWidth().height(56.dp), shape = CircleShape) {
                Text("Speichern", fontWeight = FontWeight.W800)
            }
        }
        item { TextButton(onClick = onDiscard, modifier = Modifier.fillMaxWidth()) { Text("Verwerfen", color = MaterialTheme.colorScheme.error) } }
    }
}

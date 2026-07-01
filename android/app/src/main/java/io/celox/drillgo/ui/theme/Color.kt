package io.celox.drillgo.ui.theme

import androidx.compose.material3.darkColorScheme
import androidx.compose.ui.graphics.Color

// Ported from drill's tokens.css — the default "Electric Lime" dark theme.
val Lime = Color(0xFFC6FF00)
val OnLime = Color(0xFF1C2400)
val LimeContainer = Color(0xFF4A5C00)
val OnLimeContainer = Color(0xFFE8FFB0)

val Bg = Color(0xFF14160F)
val OnBg = Color(0xFFE6E9DD)
val SurfaceVariant = Color(0xFF44483C)
val OnSurfaceVariant = Color(0xFFC5C8B8)
val Outline = Color(0xFF8F9285)
val OutlineVariant = Color(0xFF44483C)

val DrillGoColors = darkColorScheme(
    primary = Lime,
    onPrimary = OnLime,
    primaryContainer = LimeContainer,
    onPrimaryContainer = OnLimeContainer,
    secondary = Color(0xFF8FD6FF),
    onSecondary = Color(0xFF003549),
    secondaryContainer = Color(0xFF0E4D68),
    onSecondaryContainer = Color(0xFFC7ECFF),
    tertiary = Color(0xFFFFB59C),
    onTertiary = Color(0xFF5A1C0A),
    tertiaryContainer = Color(0xFF7A3320),
    onTertiaryContainer = Color(0xFFFFDBCF),
    error = Color(0xFFFFB4AB),
    onError = Color(0xFF690005),
    errorContainer = Color(0xFF93000A),
    onErrorContainer = Color(0xFFFFDAD6),
    background = Bg,
    onBackground = OnBg,
    surface = Bg,
    onSurface = OnBg,
    surfaceVariant = SurfaceVariant,
    onSurfaceVariant = OnSurfaceVariant,
    outline = Outline,
    outlineVariant = OutlineVariant,
    surfaceContainerLowest = Color(0xFF0E1009),
    surfaceContainerLow = Color(0xFF1C1F16),
    surfaceContainer = Color(0xFF20241A),
    surfaceContainerHigh = Color(0xFF2B2E24),
    surfaceContainerHighest = Color(0xFF363A2E),
    inverseSurface = Color(0xFFE6E9DD),
    inverseOnSurface = Color(0xFF2D3027),
)

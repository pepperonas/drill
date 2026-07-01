package io.celox.drillgo.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Weight/size scale mirrors drill's .display/.headline/.title/.label/.body.
// Android's default (Roboto) is visually close to the web's Roboto Flex.
private val Sans = FontFamily.SansSerif

val DrillGoType = Typography(
    displayLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.W800, fontSize = 44.sp, letterSpacing = (-0.5).sp),
    displayMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.W800, fontSize = 34.sp, letterSpacing = (-0.5).sp),
    headlineMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.W700, fontSize = 26.sp),
    headlineSmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.W700, fontSize = 22.sp),
    titleLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.W700, fontSize = 18.sp),
    titleMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.W700, fontSize = 16.sp),
    labelLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.W700, fontSize = 14.sp, letterSpacing = 0.4.sp),
    labelSmall = TextStyle(fontFamily = Sans, fontWeight = FontWeight.W600, fontSize = 12.sp, letterSpacing = 0.5.sp),
    bodyLarge = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Normal, fontSize = 16.sp),
    bodyMedium = TextStyle(fontFamily = Sans, fontWeight = FontWeight.Normal, fontSize = 14.sp),
)

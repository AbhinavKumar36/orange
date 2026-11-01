package com.moodyorange.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = OrangePrimary,
    onPrimary = CardBackground,
    primaryContainer = OrangeLight,
    onPrimaryContainer = OrangeDark,
    secondary = OrangeSecondary,
    onSecondary = CardBackground,
    background = CreamBackground,
    onBackground = TextPrimary,
    surface = CardBackground,
    onSurface = TextPrimary,
    surfaceVariant = SurfaceVariant,
    onSurfaceVariant = TextSecondary,
    outline = BorderMuted
)

@Composable
fun MoodyOrangeTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        content = content
    )
}

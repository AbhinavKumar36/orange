package com.moodyorange.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat
import com.moodyorange.app.data.theme.ThemeMode

data class MangalaColors(
    val canvas: Color,
    val surface: Color,
    val surfaceElevated: Color,
    val surfaceHover: Color,
    val border: Color,
    val borderSubtle: Color,
    val divider: Color,
    val primary: Color,
    val primaryHover: Color,
    val primaryContainer: Color,
    val onPrimary: Color,
    val gold: Color,
    val goldLight: Color,
    val sage: Color,
    val textPrimary: Color,
    val textSecondary: Color,
    val textMuted: Color,
    val textSubtle: Color,
    val vegGreen: Color,
    val vegBg: Color,
    val nonVegRed: Color,
    val nonVegBg: Color,
    val inStockGreen: Color,
    val inStockBg: Color,
    val outOfStockRed: Color,
    val outOfStockBg: Color,
    val isDark: Boolean
)

val LightMangalaColors = MangalaColors(
    canvas = WarmIvoryCanvas,
    surface = WhiteSurface,
    surfaceElevated = SurfaceElevatedLight,
    surfaceHover = SurfaceHoverLight,
    border = CardBorderLight,
    borderSubtle = DividerLight,
    divider = DividerLight,
    primary = ForestGreen,
    primaryHover = ForestGreenHover,
    primaryContainer = SoftSageSubtle,
    onPrimary = WhiteSurface,
    gold = MutedGold,
    goldLight = MutedGoldLight,
    sage = SoftSage,
    textPrimary = CharcoalTextPrimary,
    textSecondary = CharcoalTextSecondary,
    textMuted = CharcoalTextMuted,
    textSubtle = CharcoalTextSubtle,
    vegGreen = FssaiVegGreen,
    vegBg = FssaiVegBgLight,
    nonVegRed = FssaiNonVegRed,
    nonVegBg = FssaiNonVegBgLight,
    inStockGreen = InStockGreen,
    inStockBg = InStockBg,
    outOfStockRed = OutOfStockRed,
    outOfStockBg = OutOfStockBg,
    isDark = false
)

val DarkMangalaColors = MangalaColors(
    canvas = DeepCharcoalCanvas,
    surface = DeepForestSurface,
    surfaceElevated = SurfaceElevatedDark,
    surfaceHover = SurfaceHoverDark,
    border = CardBorderDark,
    borderSubtle = CardBorderGoldDark,
    divider = DividerDark,
    primary = ForestGreen,
    primaryHover = ForestGreenHover,
    primaryContainer = Color(0xFF542D1C),
    onPrimary = WhiteSurface,
    gold = MutedGold,
    goldLight = MutedGoldLight,
    sage = SoftSage,
    textPrimary = WarmIvoryTextPrimary,
    textSecondary = SoftSageTextSecondary,
    textMuted = MutedTextDark,
    textSubtle = CharcoalTextSubtle,
    vegGreen = FssaiVegGreen,
    vegBg = FssaiVegBgDark,
    nonVegRed = FssaiNonVegRed,
    nonVegBg = FssaiNonVegBgDark,
    inStockGreen = InStockGreen,
    inStockBg = InStockBgDark,
    outOfStockRed = OutOfStockRed,
    outOfStockBg = OutOfStockBgDark,
    isDark = true
)

val LocalMangalaColors = staticCompositionLocalOf { LightMangalaColors }

object MangalaTheme {
    val colors: MangalaColors
        @Composable
        get() = LocalMangalaColors.current

    val typography: Typography
        @Composable
        get() = MaterialTheme.typography
}

private val LightMaterialColorScheme: ColorScheme = lightColorScheme(
    primary = ForestGreen,
    onPrimary = WhiteSurface,
    primaryContainer = SoftSageSubtle,
    onPrimaryContainer = ForestGreenDark,
    secondary = MutedGold,
    onSecondary = WhiteSurface,
    background = WarmIvoryCanvas,
    onBackground = CharcoalTextPrimary,
    surface = WhiteSurface,
    onSurface = CharcoalTextPrimary,
    surfaceVariant = SurfaceElevatedLight,
    onSurfaceVariant = CharcoalTextSecondary,
    outline = CardBorderLight
)

private val DarkMaterialColorScheme: ColorScheme = darkColorScheme(
    primary = ForestGreen,
    onPrimary = WhiteSurface,
    primaryContainer = Color(0xFF542D1C),
    onPrimaryContainer = WhiteSurface,
    secondary = MutedGold,
    onSecondary = DeepCharcoalCanvas,
    background = DeepCharcoalCanvas,
    onBackground = WarmIvoryTextPrimary,
    surface = DeepForestSurface,
    onSurface = WarmIvoryTextPrimary,
    surfaceVariant = SurfaceElevatedDark,
    onSurfaceVariant = SoftSageTextSecondary,
    outline = CardBorderDark
)

@Composable
fun MoodyOrangeTheme(
    themeMode: ThemeMode = ThemeMode.SYSTEM,
    darkTheme: Boolean = when (themeMode) {
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
    },
    content: @Composable () -> Unit
) {
    val mangalaColors = if (darkTheme) DarkMangalaColors else LightMangalaColors
    val materialColorScheme = if (darkTheme) DarkMaterialColorScheme else LightMaterialColorScheme

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as? Activity)?.window ?: return@SideEffect
            window.statusBarColor = mangalaColors.canvas.toArgb()
            window.navigationBarColor = mangalaColors.canvas.toArgb()
            val controller = WindowCompat.getInsetsController(window, view)
            controller.isAppearanceLightStatusBars = !darkTheme
            controller.isAppearanceLightNavigationBars = !darkTheme
        }
    }

    CompositionLocalProvider(LocalMangalaColors provides mangalaColors) {
        MaterialTheme(
            colorScheme = materialColorScheme,
            typography = MoodyTypography,
            content = content
        )
    }
}

// Semantic alias for Mangala Enterprises theme
@Composable
fun MangalaEnterprisesTheme(
    themeMode: ThemeMode = ThemeMode.SYSTEM,
    content: @Composable () -> Unit
) = MoodyOrangeTheme(themeMode = themeMode, content = content)

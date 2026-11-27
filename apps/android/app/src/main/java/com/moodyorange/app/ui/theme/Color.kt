package com.moodyorange.app.ui.theme

import androidx.compose.ui.graphics.Color

// ==============================================================================
// MANGALA ENTERPRISES — CONTEMPORARY PREMIUM RETAIL DESIGN SYSTEM
// Palette:
// Forest Green:   #143E2B (Primary brand authority)
// Warm Ivory:     #FAF7F2 (Primary light canvas)
// Mangala Orange: #D8561C (Restrained accent & interactive highlight)
// Deep Obsidian:  #111A15 (Dark canvas & atmospheric contrast)
// Charcoal Green: #17241E (Dark elevated surface)
// White:          #FFFFFF
// ==============================================================================

// Primary Brand Anchors (Forest Green)
val ForestGreen = Color(0xFF143E2B)
val ForestGreenHover = Color(0xFF1E573D)
val ForestGreenDark = Color(0xFF0D2B1E)
val ForestGreenGlow = Color(0x38143E2B)
val ForestGreenSubtle = Color(0xFFEDF4F0)
val ForestGreenDarkModePrimary = Color(0xFF3CA374)

// Restrained Accent (Mangala Orange)
val MangalaOrange = Color(0xFFD8561C)
val MangalaOrangeHover = Color(0xFFBE4612)
val MangalaOrangeSubtle = Color(0xFFFDF1EB)
val MangalaOrangeGlow = Color(0x38D8561C)

// Compatibility aliases
val MoodyAmber = MangalaOrange
val MoodyAmberHover = MangalaOrangeHover
val MoodyAmberDark = Color(0xFF9A380E)
val MoodyAmberGlow = MangalaOrangeGlow
val MoodyAmberSubtle = MangalaOrangeSubtle

val MutedGold = Color(0xFFC99738)
val MutedGoldHover = Color(0xFFB5842A)
val MutedGoldLight = Color(0xFFF7EEDC)
val MutedGoldGlow = Color(0x33C99738)

val SoftSage = Color(0xFFEDF4F0)
val SoftSageSubtle = Color(0xFFEDF4F0)

// Light Mode Surfaces (Warm Ivory & Pure White)
val WarmIvoryCanvas = Color(0xFFFAF7F2)
val WhiteSurface = Color(0xFFFFFFFF)
val SurfaceElevatedLight = Color(0xFFF5EFE6)
val SurfaceHoverLight = Color(0xFFEFE8DD)
val CardBorderLight = Color(0xFFE5DCD0)
val DividerLight = Color(0xFFEAE1D5)

// Dark Mode Surfaces (Deep Charcoal / Obsidian-Forest)
val AbyssCanvas = Color(0xFF111A15)
val AbyssSurface = Color(0xFF17241E)
val AbyssSurfaceElevated = Color(0xFF22322A)
val AbyssSurfaceHover = Color(0xFF2B3F35)
val AbyssCardBorder = Color(0xFF2E4338)
val AbyssCardBorderGold = Color(0x33C99738)
val AbyssDivider = Color(0xFF23342B)

val DeepCharcoalCanvas = AbyssCanvas
val DeepForestSurface = AbyssSurface
val SurfaceElevatedDark = AbyssSurfaceElevated
val SurfaceHoverDark = AbyssSurfaceHover
val CardBorderDark = AbyssCardBorder
val CardBorderGoldDark = AbyssCardBorderGold
val DividerDark = AbyssDivider

// Typography Hierarchies
val CharcoalTextPrimary = Color(0xFF14231A)
val CharcoalTextSecondary = Color(0xFF334439)
val CharcoalTextMuted = Color(0xFF617367)
val CharcoalTextSubtle = Color(0xFF8A9C91)

val WarmIvoryTextPrimary = Color(0xFFFAF7F2)
val SoftSageTextSecondary = Color(0xFFDDE6E0)
val MutedTextDark = Color(0xFF9CB0A3)

// FSSAI Food Classification & Stock Status Accents
val FssaiVegGreen = Color(0xFF15803D)
val FssaiVegBgLight = Color(0xFFECFDF5)
val FssaiVegBgDark = Color(0x2615803D)

val FssaiNonVegRed = Color(0xFFB91C1C)
val FssaiNonVegBgLight = Color(0xFFFEF2F2)
val FssaiNonVegBgDark = Color(0x26B91C1C)

val InStockGreen = Color(0xFF15803D)
val InStockBg = Color(0xFFECFDF5)
val InStockBgDark = Color(0x2615803D)

val OutOfStockRed = Color(0xFFB91C1C)
val OutOfStockBg = Color(0xFFFEF2F2)
val OutOfStockBgDark = Color(0x26B91C1C)

// Legacy Compatibility Mappings
val OrangePrimary = MangalaOrange
val OrangeSecondary = MutedGold
val OrangeLight = MangalaOrangeSubtle
val OrangeDark = MoodyAmberDark
val OrangeGlow = MangalaOrangeGlow
val AmberGold = MutedGold
val GourmetGold = MutedGold
val GoldGlow = MutedGoldGlow

val CreamBackground = WarmIvoryCanvas
val CreamSurface = SurfaceElevatedLight
val CreamSurfaceVariant = SurfaceHoverLight
val CreamBorder = CardBorderLight
val CardBackground = WhiteSurface

val DarkBackground = DeepCharcoalCanvas
val DarkSurface = DeepForestSurface
val DarkSurfaceVariant = SurfaceElevatedDark
val DarkBorder = CardBorderDark
val DarkBorderSubtle = CardBorderGoldDark
val DarkTextPrimary = WarmIvoryTextPrimary
val DarkTextSecondary = SoftSageTextSecondary
val DarkTextMuted = MutedTextDark

val TextPrimary = CharcoalTextPrimary
val TextSecondary = CharcoalTextSecondary
val TextMuted = CharcoalTextMuted
val BorderMuted = CardBorderLight

val VegGreen = FssaiVegGreen
val VegGreenBg = FssaiVegBgLight

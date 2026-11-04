package com.moodyorange.app.ui.theme

import androidx.compose.ui.graphics.Color

// ==============================================================================
// MANGALA ENTERPRISES — OPTION B: ELEGANT MINIMAL COLOR PALETTE
// Palette:
// Forest Green: #123D30
// Warm Ivory:   #F6F1E7
// Muted Gold:   #D7A34A
// Charcoal:     #252923
// Soft Sage:    #DCE5DB
// White:        #FFFFFF
// ==============================================================================

// Primary Brand Anchors
val ForestGreen = Color(0xFF123D30)
val ForestGreenHover = Color(0xFF0B2920)
val ForestGreenDark = Color(0xFF071F17)
val ForestGreenGlow = Color(0x38123D30)

val MutedGold = Color(0xFFD7A34A)
val MutedGoldHover = Color(0xFFC6933B)
val MutedGoldLight = Color(0xFFF7EBD3)
val MutedGoldGlow = Color(0x40D7A34A)

val SoftSage = Color(0xFFDCE5DB)
val SoftSageSubtle = Color(0xFFEAF0E9)

// Light Mode Surfaces (Warm Ivory & Pure White)
val WarmIvoryCanvas = Color(0xFFF6F1E7)
val WhiteSurface = Color(0xFFFFFFFF)
val SurfaceElevatedLight = Color(0xFFFAF6EF)
val SurfaceHoverLight = Color(0xFFEFE9DD)
val CardBorderLight = Color(0xFFE2DBD0)
val DividerLight = Color(0xFFE5DFD4)

// Dark Mode Surfaces (Deep Forest Charcoal & Obsidian)
val DeepCharcoalCanvas = Color(0xFF0A1612)
val DeepForestSurface = Color(0xFF11221B)
val SurfaceElevatedDark = Color(0xFF182E25)
val SurfaceHoverDark = Color(0xFF1F3A2F)
val CardBorderDark = Color(0xFF1F3A2F)
val CardBorderGoldDark = Color(0x33D7A34A)
val DividerDark = Color(0xFF1E332B)

// Typography Hierarchies
// Light Mode:
val CharcoalTextPrimary = Color(0xFF252923)
val CharcoalTextSecondary = Color(0xFF3F453B)
val CharcoalTextMuted = Color(0xFF6B7266)
val CharcoalTextSubtle = Color(0xFF8F968B)

// Dark Mode:
val WarmIvoryTextPrimary = Color(0xFFF6F1E7)
val SoftSageTextSecondary = Color(0xFFDCE5DB)
val MutedTextDark = Color(0xFF8F968B)

// FSSAI Food Classification & Stock Status Accents (Indian Statutory Standards)
val FssaiVegGreen = Color(0xFF168A45)
val FssaiVegBgLight = Color(0xFFE8F5EC)
val FssaiVegBgDark = Color(0x26168A45)

val FssaiNonVegRed = Color(0xFFD32F2F)
val FssaiNonVegBgLight = Color(0xFFFFEBEE)
val FssaiNonVegBgDark = Color(0x26D32F2F)

val InStockGreen = Color(0xFF168A45)
val InStockBg = Color(0xFFE8F5EC)
val InStockBgDark = Color(0x26168A45)

val OutOfStockRed = Color(0xFFD32F2F)
val OutOfStockBg = Color(0xFFFFEBEE)
val OutOfStockBgDark = Color(0x26D32F2F)

// ==============================================================================
// Legacy Compatibility Mappings (Mapped directly to Option B Elegant Minimal)
// ==============================================================================
val OrangePrimary = ForestGreen
val OrangeSecondary = MutedGold
val OrangeLight = SoftSageSubtle
val OrangeDark = ForestGreenDark
val OrangeGlow = ForestGreenGlow
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

package com.moodyorange.app.ui.theme

import androidx.compose.ui.graphics.Color

// ==============================================================================
// MOODY ORANGE — MOODY AMBER & WARM ROAST CACAO DESIGN SYSTEM
// Replaces stark flat black with warm roasted cacao & espresso tones
// Palette:
// Moody Amber:    #C85C1A
// Warm Cream:     #FDF8F2
// Muted Gold:     #D7A34A
// Warm Espresso:  #2C1810
// Soft Peach:     #FDE8D6
// Roasted Cacao:  #361D12 (Replaces pitch black)
// White:          #FFFFFF
// ==============================================================================

// Primary Brand Anchors (Moody Amber)
val MoodyAmber = Color(0xFFC85C1A)
val MoodyAmberHover = Color(0xFFA84810)
val MoodyAmberDark = Color(0xFF8A3A0C)
val MoodyAmberGlow = Color(0x38C85C1A)
val MoodyAmberSubtle = Color(0xFFFDE8D6)

// Compatibility aliases for existing references
val ForestGreen = MoodyAmber
val ForestGreenHover = MoodyAmberHover
val ForestGreenDark = MoodyAmberDark
val ForestGreenGlow = MoodyAmberGlow

val MutedGold = Color(0xFFD7A34A)
val MutedGoldHover = Color(0xFFC6933B)
val MutedGoldLight = Color(0xFFF7EBD3)
val MutedGoldGlow = Color(0x40D7A34A)

val SoftSage = Color(0xFFFDE8D6) // Soft peach warm subtle
val SoftSageSubtle = Color(0xFFFDF5EE)

// Light Mode Surfaces (Warm Cream & Pure White)
val WarmIvoryCanvas = Color(0xFFFDF8F2)
val WhiteSurface = Color(0xFFFFFFFF)
val SurfaceElevatedLight = Color(0xFFFDF5EE)
val SurfaceHoverLight = Color(0xFFF7EDE0)
val CardBorderLight = Color(0xFFEAD9C8)
val DividerLight = Color(0xFFEDD9C4)

// ==============================================================================
// WARM CACAO ATMOSPHERE PALETTE (Replaces Stark Black / Abyss)
// Sumptuous warm dark roasted chocolate & espresso tones
// ==============================================================================
val AbyssCanvas = Color(0xFF361D12)          // Warm Roast Cacao canvas (#361D12) - NO BLACK
val AbyssSurface = Color(0xFF452416)         // Rich Espresso surface (#452416)
val AbyssSurfaceElevated = Color(0xFF542D1C) // Elevated Cacao card (#542D1C)
val AbyssSurfaceHover = Color(0xFF633722)    // Warm interactive hover (#633722)
val AbyssCardBorder = Color(0xFF6B3923)      // Warm Cacao border (#6B3923)
val AbyssCardBorderGold = Color(0x40D7A34A)  // Gold accent border
val AbyssDivider = Color(0xFF4A2718)         // Warm separator line (#4A2718)

// Dark Mode Surfaces Mapped to Warm Cacao Color System
val DeepCharcoalCanvas = AbyssCanvas
val DeepForestSurface = AbyssSurface
val SurfaceElevatedDark = AbyssSurfaceElevated
val SurfaceHoverDark = AbyssSurfaceHover
val CardBorderDark = AbyssCardBorder
val CardBorderGoldDark = AbyssCardBorderGold
val DividerDark = AbyssDivider

// Typography Hierarchies
// Light Mode:
val CharcoalTextPrimary = Color(0xFF2C1810)   // Warm dark espresso
val CharcoalTextSecondary = Color(0xFF4A2E1E) // Rich coffee
val CharcoalTextMuted = Color(0xFF7A5C4A)     // Soft cacao
val CharcoalTextSubtle = Color(0xFFA07A65)    // Muted biscuit

// Dark Mode:
val WarmIvoryTextPrimary = Color(0xFFFFF9F2)  // Warm cream
val SoftSageTextSecondary = Color(0xFFE5D5C5) // Soft almond
val MutedTextDark = Color(0xFFB8A294)         // Warm beige

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

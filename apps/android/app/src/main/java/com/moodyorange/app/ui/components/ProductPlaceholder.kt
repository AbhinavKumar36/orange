package com.moodyorange.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import com.moodyorange.app.ui.theme.DarkBackground
import com.moodyorange.app.ui.theme.GourmetGold
import com.moodyorange.app.ui.theme.OrangeDark
import com.moodyorange.app.ui.theme.OrangePrimary
import com.moodyorange.app.ui.theme.OrangeSecondary

/**
 * High-resolution editorial vector artwork engine for products when imageUrl is null.
 * Renders atmospheric background gradients and stylized illustrations for:
 * - Artisanal Cakes
 * - Cold-Pressed Juices
 * - Gourmet Chocolates & Pralines
 */
@Composable
fun ProductPlaceholder(
    categorySlug: String,
    modifier: Modifier = Modifier
) {
    val isCake = categorySlug.contains("cake")
    val isJuice = categorySlug.contains("juice")

    Box(
        modifier = modifier
            .background(DarkBackground),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val cx = size.width / 2f
            val cy = size.height / 2f

            when {
                isCake -> drawEditorialCake(cx, cy)
                isJuice -> drawEditorialJuice(cx, cy)
                else -> drawEditorialChocolate(cx, cy)
            }
        }
    }
}

private fun DrawScope.drawEditorialCake(cx: Float, cy: Float) {
    // 1. Warm ambient spotlight behind cake
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(
                Color(0x44FF7A00),
                Color(0x11FF5500),
                Color.Transparent
            ),
            center = Offset(cx, cy),
            radius = size.minDimension * 0.55f
        ),
        radius = size.minDimension * 0.55f,
        center = Offset(cx, cy)
    )

    val cakeW = size.minDimension * 0.58f
    val cakeH = cakeW * 0.48f

    // 2. Base Pedestal / Slate Plate
    drawRoundRect(
        color = Color(0x33FFFFFF),
        topLeft = Offset(cx - cakeW * 0.55f, cy + cakeH * 0.35f),
        size = Size(cakeW * 1.1f, 6f),
        cornerRadius = CornerRadius(3f, 3f)
    )

    // 3. Bottom Ganache Tier
    drawRoundRect(
        brush = Brush.horizontalGradient(
            colors = listOf(
                Color(0xFF261811),
                Color(0xFF4A2F22),
                Color(0xFF2E1C14)
            ),
            startX = cx - cakeW * 0.45f,
            endX = cx + cakeW * 0.45f
        ),
        topLeft = Offset(cx - cakeW * 0.45f, cy - cakeH * 0.1f),
        size = Size(cakeW * 0.9f, cakeH * 0.45f),
        cornerRadius = CornerRadius(10f, 10f)
    )

    // 4. Top Glazed Citrus Sponge Tier
    drawRoundRect(
        brush = Brush.horizontalGradient(
            colors = listOf(
                OrangeDark,
                OrangePrimary,
                OrangeSecondary
            ),
            startX = cx - cakeW * 0.32f,
            endX = cx + cakeW * 0.32f
        ),
        topLeft = Offset(cx - cakeW * 0.32f, cy - cakeH * 0.45f),
        size = Size(cakeW * 0.64f, cakeH * 0.35f),
        cornerRadius = CornerRadius(8f, 8f)
    )

    // 5. Candied Valencia Citrus Wheel on Top
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(
                Color(0xFFFFE066),
                OrangeSecondary,
                OrangeDark
            ),
            center = Offset(cx, cy - cakeH * 0.52f),
            radius = 16f
        ),
        radius = 14f,
        center = Offset(cx, cy - cakeH * 0.52f)
    )
    drawCircle(
        color = Color.White.copy(alpha = 0.8f),
        radius = 14f,
        center = Offset(cx, cy - cakeH * 0.52f),
        style = Stroke(width = 1.2f)
    )

    // Gold Leaf Flakes
    drawCircle(color = GourmetGold, radius = 3.5f, center = Offset(cx - 16f, cy - cakeH * 0.2f))
    drawCircle(color = GourmetGold, radius = 2.5f, center = Offset(cx + 18f, cy - cakeH * 0.15f))
}

private fun DrawScope.drawEditorialJuice(cx: Float, cy: Float) {
    // 1. Amber ambient spotlight
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(
                Color(0x44FFA000),
                Color(0x15FF7A00),
                Color.Transparent
            ),
            center = Offset(cx, cy),
            radius = size.minDimension * 0.55f
        ),
        radius = size.minDimension * 0.55f,
        center = Offset(cx, cy)
    )

    val bottleW = size.minDimension * 0.32f
    val bottleH = size.minDimension * 0.62f
    val topY = cy - bottleH * 0.5f

    // 2. Liquid Fill with warm gradient
    drawRoundRect(
        brush = Brush.verticalGradient(
            colors = listOf(
                Color(0xFFFFB300),
                OrangePrimary,
                OrangeDark
            ),
            startY = topY + bottleH * 0.28f,
            endY = topY + bottleH * 0.95f
        ),
        topLeft = Offset(cx - bottleW * 0.44f, topY + bottleH * 0.28f),
        size = Size(bottleW * 0.88f, bottleH * 0.67f),
        cornerRadius = CornerRadius(12f, 12f)
    )

    // 3. Glass Decanter Silhouette with reflection
    drawRoundRect(
        brush = Brush.horizontalGradient(
            colors = listOf(
                Color(0x44FFFFFF),
                Color(0x11FFFFFF),
                Color(0x55FFA000),
                Color(0x33FFFFFF)
            )
        ),
        topLeft = Offset(cx - bottleW * 0.5f, topY + bottleH * 0.15f),
        size = Size(bottleW, bottleH * 0.82f),
        cornerRadius = CornerRadius(14f, 14f),
        style = Stroke(width = 2f)
    )

    // 4. Wooden Cork Stopper
    drawRoundRect(
        brush = Brush.horizontalGradient(
            colors = listOf(
                Color(0xFF5C3B1E),
                Color(0xFF82542B),
                Color(0xFF4A3018)
            )
        ),
        topLeft = Offset(cx - bottleW * 0.24f, topY),
        size = Size(bottleW * 0.48f, bottleH * 0.15f),
        cornerRadius = CornerRadius(4f, 4f)
    )

    // 5. Floating Citrus slice inside
    drawCircle(
        color = Color(0xFFFFD166),
        radius = 8f,
        center = Offset(cx, cy + bottleH * 0.1f)
    )
}

private fun DrawScope.drawEditorialChocolate(cx: Float, cy: Float) {
    // 1. Subtle warm ambient glow
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(
                Color(0x33D4AF37),
                Color(0x11FF5500),
                Color.Transparent
            ),
            center = Offset(cx, cy),
            radius = size.minDimension * 0.55f
        ),
        radius = size.minDimension * 0.55f,
        center = Offset(cx, cy)
    )

    val boxSize = size.minDimension * 0.52f
    val boxY = cy - boxSize * 0.5f

    // 2. Luxury Hexagonal Gift Box
    drawRoundRect(
        brush = Brush.radialGradient(
            colors = listOf(
                Color(0xFF332018),
                Color(0xFF1E110B),
                Color(0xFF120804)
            ),
            center = Offset(cx, cy),
            radius = boxSize * 0.7f
        ),
        topLeft = Offset(cx - boxSize * 0.5f, boxY),
        size = Size(boxSize, boxSize),
        cornerRadius = CornerRadius(16f, 16f)
    )

    // Hairline Gold Border on Gift Box
    drawRoundRect(
        color = Color(0x33D4AF37),
        topLeft = Offset(cx - boxSize * 0.5f, boxY),
        size = Size(boxSize, boxSize),
        cornerRadius = CornerRadius(16f, 16f),
        style = Stroke(width = 1.2f)
    )

    // 3. Gold Silk Ribbon across box
    drawLine(
        brush = Brush.linearGradient(
            colors = listOf(
                GourmetGold,
                Color(0xFFFFF0A6),
                GourmetGold
            )
        ),
        start = Offset(cx, boxY),
        end = Offset(cx, boxY + boxSize),
        strokeWidth = 10f
    )
    drawLine(
        brush = Brush.linearGradient(
            colors = listOf(
                GourmetGold,
                Color(0xFFFFF0A6),
                GourmetGold
            )
        ),
        start = Offset(cx - boxSize * 0.5f, cy),
        end = Offset(cx + boxSize * 0.5f, cy),
        strokeWidth = 10f
    )

    // 4. Gold Seal Crest in Center
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(
                Color(0xFFFFF5BE),
                GourmetGold,
                Color(0xFF9E7C1A)
            ),
            center = Offset(cx, cy),
            radius = 16f
        ),
        radius = 14f,
        center = Offset(cx, cy)
    )

    drawCircle(
        color = Color(0xFF1E110B),
        radius = 6f,
        center = Offset(cx, cy)
    )
}

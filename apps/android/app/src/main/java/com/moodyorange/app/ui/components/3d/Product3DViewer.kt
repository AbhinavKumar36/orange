package com.moodyorange.app.ui.components.`3d`

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.ui.theme.DarkBackground
import com.moodyorange.app.ui.theme.DarkBorder
import com.moodyorange.app.ui.theme.GourmetGold
import com.moodyorange.app.ui.theme.OrangeLight
import com.moodyorange.app.ui.theme.OrangePrimary
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

enum class LightingPreset(val label: String, val keyColor: Color, val ambientColor: Color) {
    STUDIO_WARM("Warm Studio", Color(0xFFFFD199), Color(0x33FF9E00)),
    SUNSET_AMBER("Sunset Amber", Color(0xFFFF7A00), Color(0x44FF5500)),
    MIDNIGHT_NOIR("Midnight Noir", Color(0xFFD4AF37), Color(0x22FFFFFF))
}

/**
 * Mobile-optimized 360° 3D Interactive Product Inspector.
 * Renders procedural 3D confections (cakes, juices, chocolates) with touch drag-to-rotate,
 * studio lighting presets, and automatic continuous rotation.
 */
@Composable
fun Product3DViewer(
    categorySlug: String,
    modifier: Modifier = Modifier,
    initialLighting: LightingPreset = LightingPreset.STUDIO_WARM
) {
    var rotationY by remember { mutableFloatStateOf(30f) }
    var rotationX by remember { mutableFloatStateOf(10f) }
    var autoRotate by remember { mutableStateOf(true) }
    var lightingPreset by remember { mutableStateOf(initialLighting) }

    val infiniteTransition = rememberInfiniteTransition(label = "product3DAutoSpin")
    val autoSpinAngle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(16000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "spinAngle"
    )

    val currentRotY = if (autoRotate) (rotationY + autoSpinAngle) % 360f else rotationY

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(20.dp))
            .background(DarkBackground)
            .border(1.dp, DarkBorder, RoundedCornerShape(20.dp))
    ) {
        // 3D Canvas with drag gesture detection
        Canvas(
            modifier = Modifier
                .fillMaxSize()
                .pointerInput(autoRotate) {
                    detectDragGestures(
                        onDragStart = { autoRotate = false },
                        onDrag = { change, dragAmount ->
                            change.consume()
                            rotationY += dragAmount.x * 0.6f
                            rotationX = (rotationX - dragAmount.y * 0.4f).coerceIn(-40f, 40f)
                        }
                    )
                }
        ) {
            val cx = size.width / 2f
            val cy = size.height / 2f
            val radY = currentRotY * (PI / 180f).toFloat()
            val radX = rotationX * (PI / 180f).toFloat()

            // 1. Shaded circular turntable base
            drawTurntableBase(cx, cy, lightingPreset)

            // 2. Render 3D Model depending on product category
            when {
                categorySlug.contains("cake") -> {
                    draw3DCakeModel(cx, cy, radY, radX, lightingPreset)
                }
                categorySlug.contains("juice") -> {
                    draw3DJuiceDecanter(cx, cy, radY, radX, lightingPreset)
                }
                else -> {
                    draw3DChocolateBox(cx, cy, radY, radX, lightingPreset)
                }
            }
        }

        // Top Control Bar: Lighting presets & 360° indicator
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0x33FFFFFF))
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text(
                    text = "360° TACTILE INSPECTOR",
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    letterSpacing = 0.8.sp
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                LightingPreset.entries.forEach { preset ->
                    val isSelected = lightingPreset == preset
                    Box(
                        modifier = Modifier
                            .size(24.dp)
                            .clip(CircleShape)
                            .background(preset.keyColor)
                            .border(
                                width = if (isSelected) 2.dp else 0.dp,
                                color = if (isSelected) Color.White else Color.Transparent,
                                shape = CircleShape
                            )
                            .clickable { lightingPreset = preset }
                    )
                }
            }
        }

        // Bottom Controls: Auto-rotate toggle & Reset
        Row(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(if (autoRotate) OrangePrimary else Color(0x33FFFFFF))
                    .clickable { autoRotate = !autoRotate }
                    .padding(horizontal = 10.dp, vertical = 5.dp)
            ) {
                Text(
                    text = if (autoRotate) "Auto-Spin ON" else "Spin Paused",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color(0x33FFFFFF))
                    .clickable {
                        rotationY = 30f
                        rotationX = 10f
                    }
                    .padding(horizontal = 10.dp, vertical = 5.dp)
            ) {
                Text(
                    text = "Reset ↺",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )
            }
        }
    }
}

private fun DrawScope.drawTurntableBase(cx: Float, cy: Float, lighting: LightingPreset) {
    val baseR = size.minDimension * 0.44f

    // Soft floor ambient shadow
    drawOval(
        brush = Brush.radialGradient(
            colors = listOf(
                Color(0x88000000),
                lighting.ambientColor,
                Color.Transparent
            ),
            center = Offset(cx, cy + baseR * 0.5f),
            radius = baseR * 1.2f
        ),
        topLeft = Offset(cx - baseR, cy + baseR * 0.25f),
        size = Size(baseR * 2, baseR * 0.55f)
    )

    // Glass turntable rim
    drawOval(
        brush = Brush.linearGradient(
            colors = listOf(
                Color(0x33FFFFFF),
                Color(0x11FFFFFF),
                Color(0x44D4AF37)
            ),
            start = Offset(cx - baseR, cy + baseR * 0.35f),
            end = Offset(cx + baseR, cy + baseR * 0.55f)
        ),
        topLeft = Offset(cx - baseR * 0.85f, cy + baseR * 0.35f),
        size = Size(baseR * 1.7f, baseR * 0.35f),
        style = Stroke(width = 1.2f)
    )
}

private fun DrawScope.draw3DCakeModel(
    cx: Float,
    cy: Float,
    rotY: Float,
    rotX: Float,
    lighting: LightingPreset
) {
    val tierW = size.minDimension * 0.48f
    val tierH = tierW * 0.45f
    val yOffset = cy - tierH * 0.3f

    // Bottom Ganache tier body
    drawRoundRect(
        brush = Brush.horizontalGradient(
            colors = listOf(
                Color(0xFF261811),
                Color(0xFF4A2F22),
                Color(0xFF382319),
                Color(0xFF1F130E)
            ),
            startX = cx - tierW * 0.5f,
            endX = cx + tierW * 0.5f
        ),
        topLeft = Offset(cx - tierW * 0.5f, yOffset),
        size = Size(tierW, tierH),
        cornerRadius = CornerRadius(16f, 16f)
    )

    // Glazed Chocolate Top Tier Disc (tilted by 3D perspective)
    val discTilt = (0.28f + sin(rotX) * 0.15f).coerceIn(0.18f, 0.45f)
    drawOval(
        brush = Brush.radialGradient(
            colors = listOf(
                lighting.keyColor.copy(alpha = 0.5f),
                Color(0xFF5A3828),
                Color(0xFF2A1A12)
            ),
            center = Offset(cx - tierW * 0.15f, yOffset),
            radius = tierW * 0.45f
        ),
        topLeft = Offset(cx - tierW * 0.5f, yOffset - tierH * discTilt * 0.5f),
        size = Size(tierW, tierH * discTilt)
    )

    // Gold Leaf Flakes & Candied Orange Slice on Top
    val sliceRot = rotY * 0.8f
    val sliceX = cx + cos(sliceRot) * (tierW * 0.18f)
    val sliceY = yOffset - tierH * discTilt * 0.2f

    // Gold leaf flecks
    drawCircle(
        color = GourmetGold,
        radius = 4f,
        center = Offset(cx + sin(rotY) * 20f, yOffset - 4f)
    )
    drawCircle(
        color = GourmetGold,
        radius = 3f,
        center = Offset(cx - cos(rotY) * 24f, yOffset - 2f)
    )

    // Candied Orange Slice
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(
                Color(0xFFFFB300),
                Color(0xFFFF5500),
                Color(0xFFD43D00)
            ),
            center = Offset(sliceX, sliceY),
            radius = 18f
        ),
        radius = 16f,
        center = Offset(sliceX, sliceY)
    )
    drawCircle(
        color = Color.White.copy(alpha = 0.6f),
        radius = 16f,
        center = Offset(sliceX, sliceY),
        style = Stroke(width = 1.5f)
    )
}

private fun DrawScope.draw3DJuiceDecanter(
    cx: Float,
    cy: Float,
    rotY: Float,
    rotX: Float,
    lighting: LightingPreset
) {
    val w = size.minDimension * 0.32f
    val h = size.minDimension * 0.58f
    val topY = cy - h * 0.5f

    // Inner Valencia Liquid fill
    drawRoundRect(
        brush = Brush.verticalGradient(
            colors = listOf(
                Color(0xFFFF8C00),
                Color(0xFFFF5500),
                Color(0xFFD43D00)
            ),
            startY = topY + h * 0.25f,
            endY = topY + h * 0.95f
        ),
        topLeft = Offset(cx - w * 0.44f, topY + h * 0.25f),
        size = Size(w * 0.88f, h * 0.70f),
        cornerRadius = CornerRadius(14f, 14f)
    )

    // Outer Glass Decanter Wall with Specular Highlights
    drawRoundRect(
        brush = Brush.horizontalGradient(
            colors = listOf(
                Color(0x55FFFFFF),
                Color(0x11FFFFFF),
                lighting.keyColor.copy(alpha = 0.35f),
                Color(0x33FFFFFF)
            ),
            startX = cx - w * 0.5f,
            endX = cx + w * 0.5f
        ),
        topLeft = Offset(cx - w * 0.5f, topY + h * 0.15f),
        size = Size(w, h * 0.82f),
        cornerRadius = CornerRadius(16f, 16f),
        style = Stroke(width = 2.5f)
    )

    // Specular glossy reflection streak along bottle side
    drawLine(
        brush = Brush.verticalGradient(
            colors = listOf(
                Color.Transparent,
                Color.White.copy(alpha = 0.75f),
                Color.Transparent
            ),
            startY = topY + h * 0.22f,
            endY = topY + h * 0.85f
        ),
        start = Offset(cx - w * 0.35f, topY + h * 0.22f),
        end = Offset(cx - w * 0.35f, topY + h * 0.85f),
        strokeWidth = 2.5f
    )

    // Wooden Cap
    drawRoundRect(
        brush = Brush.horizontalGradient(
            colors = listOf(
                Color(0xFF4A3319),
                Color(0xFF6B4B27),
                Color(0xFF382512)
            )
        ),
        topLeft = Offset(cx - w * 0.25f, topY),
        size = Size(w * 0.5f, h * 0.14f),
        cornerRadius = CornerRadius(6f, 6f)
    )
}

private fun DrawScope.draw3DChocolateBox(
    cx: Float,
    cy: Float,
    rotY: Float,
    rotX: Float,
    lighting: LightingPreset
) {
    val boxSize = size.minDimension * 0.48f
    val boxY = cy - boxSize * 0.35f

    // Hexagonal faceted luxury gift box
    val path = Path().apply {
        val points = 6
        for (i in 0 until points) {
            val angle = rotY + (i * 2 * PI.toFloat() / points)
            val px = cx + cos(angle) * (boxSize * 0.48f)
            val py = boxY + boxSize * 0.45f + sin(angle) * (boxSize * 0.24f)
            if (i == 0) moveTo(px, py) else lineTo(px, py)
        }
        close()
    }

    drawPath(
        path = path,
        brush = Brush.radialGradient(
            colors = listOf(
                Color(0xFF2E1C14),
                Color(0xFF1B0E09),
                Color(0xFF0F0704)
            ),
            center = Offset(cx, boxY + boxSize * 0.4f),
            radius = boxSize * 0.55f
        )
    )

    // Gold ribbon wrapping
    drawLine(
        brush = Brush.linearGradient(
            colors = listOf(
                GourmetGold,
                Color(0xFFFFF1A8),
                GourmetGold
            )
        ),
        start = Offset(cx - boxSize * 0.45f, boxY + boxSize * 0.45f),
        end = Offset(cx + boxSize * 0.45f, boxY + boxSize * 0.45f),
        strokeWidth = 12f
    )

    // Embossed Gold Seal Emblem in center
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(
                Color(0xFFFFF3B8),
                GourmetGold,
                Color(0xFF9E7C1A)
            ),
            center = Offset(cx, boxY + boxSize * 0.45f),
            radius = 18f
        ),
        radius = 18f,
        center = Offset(cx, boxY + boxSize * 0.45f)
    )

    drawCircle(
        color = Color(0xFF2E1C14),
        radius = 8f,
        center = Offset(cx, boxY + boxSize * 0.45f)
    )
}

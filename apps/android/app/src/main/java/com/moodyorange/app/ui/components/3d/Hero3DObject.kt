package com.moodyorange.app.ui.components.`3d`

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * 3D Interactive Valencia Orange Centerpiece for the Mobile Hero.
 * Built with native Jetpack Compose Canvas 3D projection, dynamic specular shading,
 * touch drag rotation with inertia damping, orbiting nectar droplets, and floating levitation.
 */
@Composable
fun Hero3DObject(
    modifier: Modifier = Modifier,
    size: Dp = 240.dp
) {
    var rotationX by remember { mutableFloatStateOf(15f) }
    var rotationY by remember { mutableFloatStateOf(-25f) }

    val infiniteTransition = rememberInfiniteTransition(label = "hero3DIdle")

    // Idle gentle floating / levitation
    val floatOffset by infiniteTransition.animateFloat(
        initialValue = -8f,
        targetValue = 8f,
        animationSpec = infiniteRepeatable(
            animation = tween(2600, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "floatingLevitation"
    )

    // Gentle idle spin
    val idleSpin by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(22000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "idleSpin"
    )

    // Orbiting nectar droplets phase
    val orbitPhase by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = (2 * PI).toFloat(),
        animationSpec = infiniteRepeatable(
            animation = tween(7000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "orbitNectar"
    )

    Box(
        modifier = modifier
            .size(size)
            .pointerInput(Unit) {
                detectDragGestures { change, dragAmount ->
                    change.consume()
                    // Drag sensitivity
                    rotationY += dragAmount.x * 0.45f
                    rotationX = (rotationX - dragAmount.y * 0.45f).coerceIn(-65f, 65f)
                }
            },
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val cx = this.size.width / 2f
            val cy = this.size.height / 2f + floatOffset
            val radius = this.size.minDimension * 0.32f

            val effectiveRotY = (rotationY + idleSpin * 0.15f) * (PI / 180f).toFloat()
            val effectiveRotX = rotationX * (PI / 180f).toFloat()

            // 1. Draw Background Orbiting Droplets (Z < 0)
            drawOrbitDroplets(cx, cy, radius, orbitPhase, inBackground = true)

            // 2. Draw Soft Ambient Back Glow
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        Color(0x55FF5500),
                        Color(0x22FF7A00),
                        Color.Transparent
                    ),
                    center = Offset(cx, cy),
                    radius = radius * 1.7f
                ),
                radius = radius * 1.7f,
                center = Offset(cx, cy)
            )

            // 3. Draw Stylized Tilted Celestial Halo Rings
            drawTiltedRings(cx, cy, radius, effectiveRotX, effectiveRotY)

            // 4. Draw Main 3D Orange Sphere with Surface Dimples & Specular Lighting
            draw3DSphere(cx, cy, radius, effectiveRotX, effectiveRotY)

            // 5. Draw 3D Botanical Emerald Leaf and Stem
            draw3DStemAndLeaf(cx, cy, radius, effectiveRotX, effectiveRotY)

            // 6. Draw Foreground Orbiting Droplets (Z >= 0)
            drawOrbitDroplets(cx, cy, radius, orbitPhase, inBackground = false)
        }
    }
}

private fun DrawScope.draw3DSphere(
    cx: Float,
    cy: Float,
    radius: Float,
    rotX: Float,
    rotY: Float
) {
    // Primary shaded spherical body with radial gradient shifted to upper-left key light
    val lightAngle = -0.7f
    val lightDistance = radius * 0.45f
    val lightSourceX = cx + cos(lightAngle) * lightDistance
    val lightSourceY = cy + sin(lightAngle) * lightDistance

    // Base Sphere with deep 3D illumination
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(
                Color(0xFFFFB366), // Key light warm highlight
                Color(0xFFFF5500), // Vibrant signature Moody Orange
                Color(0xFFE04400), // Deep citrus shadow
                Color(0xFF6B1D00)  // Ambient occlusion rim
            ),
            center = Offset(lightSourceX, lightSourceY),
            radius = radius * 1.15f
        ),
        radius = radius,
        center = Offset(cx, cy)
    )

    // Specular glossy reflection point
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(
                Color(0xEEFFFFFF),
                Color(0x66FFF1E6),
                Color.Transparent
            ),
            center = Offset(cx - radius * 0.32f, cy - radius * 0.35f),
            radius = radius * 0.38f
        ),
        radius = radius * 0.38f,
        center = Offset(cx - radius * 0.32f, cy - radius * 0.35f)
    )

    // Secondary warm amber bounce light on opposite bottom-right edge
    drawCircle(
        brush = Brush.radialGradient(
            colors = listOf(
                Color(0x44FF9E00),
                Color.Transparent
            ),
            center = Offset(cx + radius * 0.55f, cy + radius * 0.55f),
            radius = radius * 0.5f
        ),
        radius = radius * 0.5f,
        center = Offset(cx + radius * 0.55f, cy + radius * 0.55f)
    )

    // Projected 3D Surface Meridian Curves to give depth when rotating
    val steps = 8
    for (i in 0 until steps) {
        val angle = rotY + (i * PI.toFloat() / steps)
        val normalZ = cos(angle)
        if (normalZ > 0.05f) {
            val normalX = sin(angle)
            val arcWidth = radius * normalZ
            val alpha = (0.12f * normalZ).coerceIn(0.02f, 0.16f)

            drawOval(
                color = Color.White.copy(alpha = alpha),
                topLeft = Offset(cx + normalX * (radius * 0.6f) - arcWidth * 0.5f, cy - radius * 0.85f),
                size = androidx.compose.ui.geometry.Size(arcWidth, radius * 1.7f),
                style = Stroke(width = 1.2f)
            )
        }
    }
}

private fun DrawScope.draw3DStemAndLeaf(
    cx: Float,
    cy: Float,
    radius: Float,
    rotX: Float,
    rotY: Float
) {
    // Transform top stem anchor with 3D rotation
    val stemBaseY = cy - radius * 0.94f
    val stemTopX = cx + sin(rotY) * 12f
    val stemTopY = stemBaseY - 18f

    // Brown wooden stem
    val stemPath = Path().apply {
        moveTo(cx - 3f, stemBaseY)
        quadraticTo(cx - 1f, stemBaseY - 10f, stemTopX, stemTopY)
        lineTo(stemTopX + 4f, stemTopY)
        quadraticTo(cx + 4f, stemBaseY - 10f, cx + 3f, stemBaseY)
        close()
    }
    drawPath(
        path = stemPath,
        color = Color(0xFF5A3825)
    )

    // Emerald glossy leaf with 3D angle
    val leafAngle = rotY * 0.5f + 0.4f
    val leafSpreadX = cos(leafAngle) * 36f
    val leafSpreadY = sin(leafAngle) * 10f - 14f

    val leafPath = Path().apply {
        moveTo(stemTopX + 2f, stemTopY + 2f)
        cubicTo(
            stemTopX + leafSpreadX * 0.5f, stemTopY - 16f,
            stemTopX + leafSpreadX * 0.8f, stemTopY + leafSpreadY - 8f,
            stemTopX + leafSpreadX, stemTopY + leafSpreadY
        )
        cubicTo(
            stemTopX + leafSpreadX * 0.7f, stemTopY + leafSpreadY + 12f,
            stemTopX + leafSpreadX * 0.3f, stemTopY + 8f,
            stemTopX + 2f, stemTopY + 2f
        )
        close()
    }

    drawPath(
        path = leafPath,
        brush = Brush.linearGradient(
            colors = listOf(
                Color(0xFF2E7D32),
                Color(0xFF4CAF50),
                Color(0xFF1B5E20)
            ),
            start = Offset(stemTopX, stemTopY),
            end = Offset(stemTopX + leafSpreadX, stemTopY + leafSpreadY)
        )
    )

    // Leaf vein highlight
    drawLine(
        color = Color(0x77FFFFFF),
        start = Offset(stemTopX + 2f, stemTopY + 2f),
        end = Offset(stemTopX + leafSpreadX * 0.85f, stemTopY + leafSpreadY * 0.85f),
        strokeWidth = 1.2f
    )
}

private fun DrawScope.drawTiltedRings(
    cx: Float,
    cy: Float,
    radius: Float,
    rotX: Float,
    rotY: Float
) {
    val ringRadiusX = radius * 1.55f
    val ringRadiusY = radius * 0.48f

    rotate(degrees = -18f + rotX * 10f, pivot = Offset(cx, cy)) {
        // Outer thin gold orbit line
        drawOval(
            brush = Brush.sweepGradient(
                colors = listOf(
                    Color(0x00D4AF37),
                    Color(0x88D4AF37),
                    Color(0xFFFFF0A6),
                    Color(0x88FF7A00),
                    Color(0x00D4AF37)
                ),
                center = Offset(cx, cy)
            ),
            topLeft = Offset(cx - ringRadiusX, cy - ringRadiusY),
            size = androidx.compose.ui.geometry.Size(ringRadiusX * 2, ringRadiusY * 2),
            style = Stroke(width = 1.4f)
        )

        // Inner subtle crystal ring
        drawOval(
            color = Color(0x22FFFFFF),
            topLeft = Offset(cx - ringRadiusX * 0.82f, cy - ringRadiusY * 0.82f),
            size = androidx.compose.ui.geometry.Size(ringRadiusX * 1.64f, ringRadiusY * 1.64f),
            style = Stroke(width = 1f)
        )
    }
}

private fun DrawScope.drawOrbitDroplets(
    cx: Float,
    cy: Float,
    radius: Float,
    phase: Float,
    inBackground: Boolean
) {
    val droplets = listOf(
        Triple(radius * 1.45f, 0.38f, 0f),
        Triple(radius * 1.32f, 0.42f, 2.1f),
        Triple(radius * 1.58f, 0.35f, 4.2f)
    )

    droplets.forEachIndexed { idx, (orbitR, tilt, offsetPhase) ->
        val currentAngle = phase + offsetPhase
        val z = sin(currentAngle) // z > 0: foreground, z < 0: background

        if ((z < 0 && inBackground) || (z >= 0 && !inBackground)) {
            val x = cx + cos(currentAngle) * orbitR
            val y = cy + sin(currentAngle) * (orbitR * tilt) - 10f

            // Scale and opacity according to depth
            val depthScale = 0.65f + (z + 1f) * 0.25f // 0.65f to 1.15f
            val dropRadius = 6.5f * depthScale
            val alpha = (0.4f + (z + 1f) * 0.3f).coerceIn(0.2f, 1f)

            // Nectar droplet glow
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        Color(0xFFFFF7D6).copy(alpha = alpha),
                        Color(0xFFFF9E00).copy(alpha = alpha * 0.85f),
                        Color(0xFFFF5500).copy(alpha = alpha * 0.4f),
                        Color.Transparent
                    ),
                    center = Offset(x - dropRadius * 0.3f, y - dropRadius * 0.3f),
                    radius = dropRadius * 1.8f
                ),
                radius = dropRadius * 1.8f,
                center = Offset(x, y)
            )

            // Core droplet body
            drawCircle(
                color = Color(0xFFFFB300).copy(alpha = alpha),
                radius = dropRadius,
                center = Offset(x, y)
            )

            // Specular pin highlight
            drawCircle(
                color = Color.White.copy(alpha = alpha),
                radius = dropRadius * 0.35f,
                center = Offset(x - dropRadius * 0.3f, y - dropRadius * 0.35f)
            )
        }
    }
}

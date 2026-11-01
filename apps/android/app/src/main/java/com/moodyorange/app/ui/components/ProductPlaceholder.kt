package com.moodyorange.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.ui.theme.OrangeLight
import com.moodyorange.app.ui.theme.OrangePrimary
import com.moodyorange.app.ui.theme.OrangeSecondary

/**
 * Elegant vector-based illustration placeholder for products when imageUrl is null.
 * Provides custom graphics based on category (cake, juice, praline/chocolate).
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
            .background(OrangeLight),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.size(72.dp)) {
            val w = size.width
            val h = size.height

            when {
                isCake -> {
                    // Cake base plate
                    drawRoundRect(
                        color = OrangeSecondary.copy(alpha = 0.35f),
                        topLeft = Offset(w * 0.15f, h * 0.72f),
                        size = Size(w * 0.7f, h * 0.12f),
                        cornerRadius = CornerRadius(6.dp.toPx())
                    )
                    // Cake body bottom tier
                    drawRoundRect(
                        color = OrangePrimary,
                        topLeft = Offset(w * 0.22f, h * 0.44f),
                        size = Size(w * 0.56f, h * 0.30f),
                        cornerRadius = CornerRadius(8.dp.toPx())
                    )
                    // Cake body top tier
                    drawRoundRect(
                        color = OrangeSecondary,
                        topLeft = Offset(w * 0.30f, h * 0.26f),
                        size = Size(w * 0.40f, h * 0.22f),
                        cornerRadius = CornerRadius(6.dp.toPx())
                    )
                    // Candle or topping dot
                    drawCircle(
                        color = Color(0xFFDC2F02),
                        radius = 4.dp.toPx(),
                        center = Offset(w * 0.5f, h * 0.20f)
                    )
                }
                isJuice -> {
                    // Juice bottle / tumbler body
                    drawRoundRect(
                        color = OrangePrimary,
                        topLeft = Offset(w * 0.30f, h * 0.25f),
                        size = Size(w * 0.40f, h * 0.60f),
                        cornerRadius = CornerRadius(10.dp.toPx())
                    )
                    // Cap / top
                    drawRoundRect(
                        color = OrangeSecondary,
                        topLeft = Offset(w * 0.38f, h * 0.15f),
                        size = Size(w * 0.24f, h * 0.12f),
                        cornerRadius = CornerRadius(4.dp.toPx())
                    )
                    // Citrus slice or decorative circle
                    drawCircle(
                        color = Color(0xFFFFD166),
                        radius = 8.dp.toPx(),
                        center = Offset(w * 0.5f, h * 0.52f)
                    )
                }
                else -> {
                    // Gourmet Chocolate / Confectionery box shape
                    drawRoundRect(
                        color = OrangePrimary,
                        topLeft = Offset(w * 0.22f, h * 0.25f),
                        size = Size(w * 0.56f, h * 0.56f),
                        cornerRadius = CornerRadius(12.dp.toPx())
                    )
                    // Chocolate ribbon accent
                    drawRoundRect(
                        color = OrangeSecondary,
                        topLeft = Offset(w * 0.44f, h * 0.25f),
                        size = Size(w * 0.12f, h * 0.56f),
                        cornerRadius = CornerRadius(4.dp.toPx())
                    )
                    drawCircle(
                        color = Color(0xFFFFE8D6),
                        radius = 6.dp.toPx(),
                        center = Offset(w * 0.5f, h * 0.53f)
                    )
                }
            }
        }
    }
}


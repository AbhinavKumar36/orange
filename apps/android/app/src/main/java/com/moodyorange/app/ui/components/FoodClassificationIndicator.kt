package com.moodyorange.app.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.ui.theme.FssaiNonVegRed
import com.moodyorange.app.ui.theme.FssaiVegGreen
import com.moodyorange.app.ui.theme.MangalaTheme
import com.moodyorange.app.ui.theme.WhiteSurface

/**
 * Standard Indian FSSAI Food Classification Symbol.
 * - Vegetarian: Green square border with a filled green circle inside.
 * - Non-Vegetarian: Red square border with a filled red triangle inside.
 * - Null / Unclassified: Renders nothing (never assumes vegetarian or food classification).
 */
@Composable
fun FoodClassificationIndicator(
    isVeg: Boolean?,
    modifier: Modifier = Modifier,
    size: Dp = 18.dp,
    showLabel: Boolean = false,
    labelColor: Color = MangalaTheme.colors.textSecondary
) {
    if (isVeg == null) {
        // Do not infer or assume food classification for unclassified or non-food products
        return
    }

    val symbolColor = if (isVeg) FssaiVegGreen else FssaiNonVegRed
    val description = if (isVeg) "Vegetarian" else "Non-Vegetarian"
    val innerSize = (size.value * 0.44f).dp

    Row(
        modifier = modifier.semantics {
            contentDescription = description
        },
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(size)
                .clip(RoundedCornerShape(3.dp))
                .border(width = 1.5.dp, color = symbolColor, shape = RoundedCornerShape(3.dp))
                .background(WhiteSurface),
            contentAlignment = Alignment.Center
        ) {
            if (isVeg) {
                // Circular green dot
                Box(
                    modifier = Modifier
                        .size(innerSize)
                        .clip(CircleShape)
                        .background(symbolColor)
                )
            } else {
                // Triangle red dot (FSSAI standard)
                Canvas(modifier = Modifier.size(innerSize)) {
                    val path = Path().apply {
                        moveTo(this@Canvas.size.width / 2f, 0f)
                        lineTo(this@Canvas.size.width, this@Canvas.size.height)
                        lineTo(0f, this@Canvas.size.height)
                        close()
                    }
                    drawPath(path = path, color = symbolColor)
                }
            }
        }

        if (showLabel) {
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = description,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = labelColor
            )
        }
    }
}

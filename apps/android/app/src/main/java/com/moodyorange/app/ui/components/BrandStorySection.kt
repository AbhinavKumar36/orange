package com.moodyorange.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.ui.theme.DarkBackground
import com.moodyorange.app.ui.theme.DarkBorder
import com.moodyorange.app.ui.theme.DarkTextPrimary
import com.moodyorange.app.ui.theme.DarkTextSecondary
import com.moodyorange.app.ui.theme.EditorialSerif
import com.moodyorange.app.ui.theme.GourmetGold
import com.moodyorange.app.ui.theme.OrangePrimary

@Composable
fun BrandStorySection(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
            .clip(RoundedCornerShape(22.dp))
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF1F1813),
                        Color(0xFF120E0B)
                    )
                )
            )
            .border(1.dp, DarkBorder, RoundedCornerShape(22.dp))
            .padding(22.dp)
    ) {
        Column {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(6.dp)
                        .clip(CircleShape)
                        .background(OrangePrimary)
                )
                Text(
                    text = "OUR CULINARY PROMISE",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = OrangePrimary,
                    letterSpacing = 1.sp
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = "The Art of Bitter & Sweet",
                fontFamily = EditorialSerif,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = DarkTextPrimary
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Moody Orange was born from a singular obsession: the harmonic tension between single-origin Peruvian cacao and sun-ripened Valencia citrus. Every gateau, cold elixir, and praline is handcrafted in small morning batches with zero compromises.",
                fontSize = 13.sp,
                lineHeight = 20.sp,
                color = DarkTextSecondary
            )

            Spacer(modifier = Modifier.height(18.dp))

            // Metrics row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                MetricItem(number = "100%", label = "Eggless & Pure")
                MetricItem(number = "15m", label = "Counter Pickup")
                MetricItem(number = "0", label = "Artificial Essences")
            }
        }
    }
}

@Composable
private fun MetricItem(number: String, label: String) {
    Column {
        Text(
            text = number,
            fontFamily = EditorialSerif,
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold,
            color = GourmetGold
        )
        Text(
            text = label,
            fontSize = 11.sp,
            color = DarkTextSecondary
        )
    }
}

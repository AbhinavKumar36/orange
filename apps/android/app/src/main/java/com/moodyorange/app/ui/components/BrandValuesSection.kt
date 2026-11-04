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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.ui.theme.EditorialSerif
import com.moodyorange.app.ui.theme.MangalaTheme

@Composable
fun BrandValuesSection(modifier: Modifier = Modifier) {
    val colors = MangalaTheme.colors

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
    ) {
        Text(
            text = "STORE STANDARDS & CAPABILITIES",
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            color = colors.primary,
            letterSpacing = 1.sp
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = "The Mangala Enterprises Standard",
            fontFamily = EditorialSerif,
            fontSize = 19.sp,
            fontWeight = FontWeight.Bold,
            color = colors.textPrimary
        )

        Spacer(modifier = Modifier.height(14.dp))

        // 2x2 grid of value cards
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                ValueCard(
                    icon = "🛍️",
                    title = "Counter Pickup",
                    description = "Fresh kitchen collection with immediate or scheduled pickup windows.",
                    modifier = Modifier.weight(1f)
                )
                ValueCard(
                    icon = "🌿",
                    title = "FSSAI Declarations",
                    description = "Recognized Indian green & red dietary symbols on every item.",
                    modifier = Modifier.weight(1f)
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                ValueCard(
                    icon = "⚡",
                    title = "Live Kitchen Sync",
                    description = "Real-time stock availability with zero phantom reservations.",
                    modifier = Modifier.weight(1f)
                )
                ValueCard(
                    icon = "🔒",
                    title = "Secure Mobile OTP",
                    description = "Password-free customer access and verified order tracking.",
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun ValueCard(
    icon: String,
    title: String,
    description: String,
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(colors.surface)
            .border(0.5.dp, colors.border, RoundedCornerShape(12.dp))
            .padding(14.dp)
    ) {
        Column {
            Box(
                modifier = Modifier
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(colors.surfaceElevated),
                contentAlignment = Alignment.Center
            ) {
                Text(text = icon, fontSize = 16.sp)
            }

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = title,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
                color = colors.textPrimary
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = description,
                fontSize = 11.5.sp,
                lineHeight = 16.sp,
                color = colors.textSecondary
            )
        }
    }
}

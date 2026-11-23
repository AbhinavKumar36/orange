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
import com.moodyorange.app.ui.theme.ForestGreen
import com.moodyorange.app.ui.theme.MangalaTheme
import com.moodyorange.app.ui.theme.MutedGold

@Composable
fun BrandStorySection(modifier: Modifier = Modifier) {
    val colors = MangalaTheme.colors
    val isDark = colors.isDark

    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .clip(RoundedCornerShape(16.dp))
            .background(colors.surface)
            .border(0.5.dp, colors.border, RoundedCornerShape(16.dp))
            .padding(20.dp)
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
                        .background(ForestGreen)
                )
                Text(
                    text = "RETAIL PERSPECTIVE",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.primary,
                    letterSpacing = 1.sp
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = "Thoughtfully Curated for Every Daily Craving",
                fontFamily = EditorialSerif,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = colors.textPrimary,
                lineHeight = 26.sp
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Mangala Enterprises is a contemporary food and beverage retail destination. We curate a diverse portfolio spanning savoury snacks, chilled beverages, celebratory bakes, ice creams, and gourmet confectionery. Organized for seamless counter collection with clear FSSAI dietary labels.",
                fontSize = 12.5.sp,
                lineHeight = 19.sp,
                color = colors.textSecondary
            )

            Spacer(modifier = Modifier.height(18.dp))

            // Metrics row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                MetricItem(number = "Multi", label = "Categories")
                MetricItem(number = "100%", label = "Live Stock")
                MetricItem(number = "Prompt", label = "Counter Ready")
            }
        }
    }
}

@Composable
private fun MetricItem(number: String, label: String) {
    val colors = MangalaTheme.colors
    Column {
        Text(
            text = number,
            fontFamily = EditorialSerif,
            fontSize = 19.sp,
            fontWeight = FontWeight.Bold,
            color = colors.gold
        )
        Text(
            text = label,
            fontSize = 10.5.sp,
            color = colors.textMuted
        )
    }
}

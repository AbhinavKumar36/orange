package com.moodyorange.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.ui.components.`3d`.Product3DViewer
import com.moodyorange.app.ui.theme.EditorialSerif
import com.moodyorange.app.ui.theme.ForestGreen
import com.moodyorange.app.ui.theme.MangalaTheme
import com.moodyorange.app.ui.theme.MutedGold
import com.moodyorange.app.ui.theme.WhiteSurface

@Composable
fun ProductShowcaseSection(
    onExploreShop: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors
    var selectedModelCategory by remember { mutableStateOf("cake") }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "3D TACTILE STUDIO",
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.primary,
                    letterSpacing = 1.sp
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "Interactive Product View",
                    fontFamily = EditorialSerif,
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.textPrimary
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Model Switcher Tabs
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            ModelTab(
                label = "Boutique Cake",
                isSelected = selectedModelCategory == "cake",
                onClick = { selectedModelCategory = "cake" },
                modifier = Modifier.weight(1f)
            )
            ModelTab(
                label = "Cold Nectar",
                isSelected = selectedModelCategory == "juice",
                onClick = { selectedModelCategory = "juice" },
                modifier = Modifier.weight(1f)
            )
            ModelTab(
                label = "Fine Truffles",
                isSelected = selectedModelCategory == "chocolates",
                onClick = { selectedModelCategory = "chocolates" },
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // 3D Viewer Container
        Product3DViewer(
            categorySlug = selectedModelCategory,
            modifier = Modifier
                .fillMaxWidth()
                .height(220.dp)
        )

        Spacer(modifier = Modifier.height(10.dp))

        // Chef notes under 3D viewer with dietary indicator
        val tastingNote = when (selectedModelCategory) {
            "cake" -> "Layered 70% dark Belgian ganache with cold-pressed natural fruit extract glaze."
            "juice" -> "Pure sun-ripened cold-pressed fruit extract with natural floral notes."
            else -> "Single-origin cacao truffles dusted in roasted nibs and cocoa butter."
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp)
        ) {
            Text(
                text = "Chef's Tasting Note: $tastingNote",
                fontSize = 11.5.sp,
                color = colors.textSecondary,
                lineHeight = 16.sp,
                modifier = Modifier.weight(1f)
            )

            FoodClassificationIndicator(
                isVeg = true,
                size = 16.dp,
                modifier = Modifier.padding(start = 8.dp)
            )
        }
    }
}

@Composable
private fun ModelTab(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors
    val isDark = colors.isDark

    val bg = if (isSelected) {
        if (isDark) MutedGold else ForestGreen
    } else {
        colors.surfaceElevated
    }

    val textColor = if (isSelected) {
        if (isDark) colors.canvas else WhiteSurface
    } else {
        colors.textSecondary
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(bg)
            .border(
                0.5.dp,
                if (isSelected) (if (isDark) MutedGold else ForestGreen) else colors.border,
                RoundedCornerShape(8.dp)
            )
            .clickable(onClick = onClick)
            .padding(vertical = 7.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = 11.5.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            color = textColor
        )
    }
}

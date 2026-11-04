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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.ui.components.`3d`.Product3DViewer
import com.moodyorange.app.ui.theme.DarkBackground
import com.moodyorange.app.ui.theme.DarkBorder
import com.moodyorange.app.ui.theme.DarkTextPrimary
import com.moodyorange.app.ui.theme.DarkTextSecondary
import com.moodyorange.app.ui.theme.EditorialSerif
import com.moodyorange.app.ui.theme.OrangePrimary

@Composable
fun ProductShowcaseSection(
    onExploreShop: () -> Unit,
    modifier: Modifier = Modifier
) {
    var selectedModelCategory by remember { mutableStateOf("cake") }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "3D TACTILE STUDIO",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = OrangePrimary,
                    letterSpacing = 1.sp
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "Interactive Inspection",
                    fontFamily = EditorialSerif,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = DarkTextPrimary
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
                label = "Ganache Cake",
                isSelected = selectedModelCategory == "cake",
                onClick = { selectedModelCategory = "cake" },
                modifier = Modifier.weight(1f)
            )
            ModelTab(
                label = "Citrus Elixir",
                isSelected = selectedModelCategory == "juice",
                onClick = { selectedModelCategory = "juice" },
                modifier = Modifier.weight(1f)
            )
            ModelTab(
                label = "Praline Box",
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
                .height(240.dp)
        )

        Spacer(modifier = Modifier.height(10.dp))

        // Chef notes under 3D viewer
        val tastingNote = when (selectedModelCategory) {
            "cake" -> "Layered 70% dark ganache infused with slow-reduced Valencia zest and gold flakes."
            "juice" -> "Pure cold-pressed Valencia citrus with hints of bergamot and wild amber."
            else -> "Single-origin Peruvian cacao truffles dusted in roasted orange nibs."
        }

        Text(
            text = "Chef's Tasting Note: $tastingNote",
            fontSize = 12.sp,
            color = DarkTextSecondary,
            lineHeight = 17.sp,
            modifier = Modifier.padding(horizontal = 4.dp)
        )
    }
}

@Composable
private fun ModelTab(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (isSelected) OrangePrimary else Color(0x1AFFFFFF))
            .border(
                1.dp,
                if (isSelected) OrangePrimary else DarkBorder,
                RoundedCornerShape(10.dp)
            )
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            color = if (isSelected) Color.White else DarkTextSecondary
        )
    }
}

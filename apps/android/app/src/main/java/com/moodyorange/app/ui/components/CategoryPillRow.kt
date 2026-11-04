package com.moodyorange.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.data.model.Category
import com.moodyorange.app.ui.theme.ForestGreen
import com.moodyorange.app.ui.theme.MangalaTheme
import com.moodyorange.app.ui.theme.MutedGold
import com.moodyorange.app.ui.theme.WhiteSurface

@Composable
fun CategoryPillRow(
    categories: List<Category>,
    selectedCategorySlug: String?,
    onCategorySelected: (Category?) -> Unit,
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()

    Row(
        modifier = modifier
            .fillMaxWidth()
            .horizontalScroll(scrollState)
            .padding(horizontal = 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // "All Products" pill
        val isAllSelected = selectedCategorySlug == null
        CategoryPill(
            label = "All Items",
            isSelected = isAllSelected,
            onClick = { onCategorySelected(null) }
        )

        // Dynamic category pills
        categories.forEach { category ->
            val isSelected = selectedCategorySlug == category.slug
            CategoryPill(
                label = category.name,
                isSelected = isSelected,
                onClick = { onCategorySelected(category) }
            )
        }
    }
}

@Composable
fun CategoryPill(
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

    val borderColor = if (isSelected) {
        if (isDark) MutedGold else ForestGreen
    } else {
        colors.border
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(bg)
            .border(0.5.dp, borderColor, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 7.dp)
    ) {
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            color = textColor
        )
    }
}

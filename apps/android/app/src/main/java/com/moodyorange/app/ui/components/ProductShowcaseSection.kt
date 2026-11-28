package com.moodyorange.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.data.model.Product
import com.moodyorange.app.ui.theme.EditorialSerif
import com.moodyorange.app.ui.theme.MangalaTheme
import com.moodyorange.app.ui.theme.WhiteSurface
import com.moodyorange.app.util.CurrencyFormatter

@Composable
fun ProductShowcaseSection(
    products: List<Product> = emptyList(),
    onProductClick: (Product) -> Unit = {},
    onExploreShop: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors
    val featured = remember(products) {
        val seen = mutableSetOf<String>()
        val picked = mutableListOf<Product>()
        for (p in products) {
            if (p.isInStock && seen.add(p.categorySlug)) {
                picked.add(p)
            }
            if (picked.size >= 3) break
        }
        if (picked.size < 3) {
            for (p in products) {
                if (picked.none { it.id == p.id }) picked.add(p)
                if (picked.size >= 3) break
            }
        }
        picked
    }

    if (featured.isEmpty()) return

    var selectedIndex by remember { mutableIntStateOf(0) }
    val safeIndex = selectedIndex.coerceIn(0, featured.lastIndex)
    val currentItem = featured[safeIndex]

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
    ) {
        Text(
            text = "RETAIL HIGHLIGHTS",
            fontSize = 10.5.sp,
            fontWeight = FontWeight.Bold,
            color = colors.primary,
            letterSpacing = 1.sp
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = "Featured Selections",
            fontFamily = EditorialSerif,
            fontSize = 19.sp,
            fontWeight = FontWeight.Bold,
            color = colors.textPrimary
        )

        Spacer(modifier = Modifier.height(12.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            featured.forEachIndexed { idx, prod ->
                ShowcaseTab(
                    label = prod.categoryName,
                    isSelected = safeIndex == idx,
                    onClick = { selectedIndex = idx },
                    modifier = Modifier.weight(1f)
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(colors.surface)
                .border(1.dp, colors.border, RoundedCornerShape(16.dp))
                .clickable { onProductClick(currentItem) }
                .padding(16.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(190.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(colors.surfaceElevated)
            ) {
                ProductImage(
                    imageUrl = currentItem.imageUrl,
                    categorySlug = currentItem.categorySlug,
                    contentDescription = currentItem.name,
                    modifier = Modifier.fillMaxSize()
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = currentItem.categoryName.uppercase(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.primary,
                    letterSpacing = 0.8.sp
                )
                Text(
                    text = CurrencyFormatter.formatPaiseToInr(currentItem.basePrice, showDecimals = false),
                    fontSize = 16.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = colors.textPrimary
                )
            }

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = currentItem.name,
                fontFamily = EditorialSerif,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = colors.textPrimary
            )

            if (!currentItem.description.isNullOrBlank()) {
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = currentItem.description,
                    fontSize = 12.5.sp,
                    lineHeight = 18.sp,
                    color = colors.textSecondary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            Button(
                onClick = onExploreShop,
                colors = ButtonDefaults.buttonColors(
                    containerColor = colors.primary,
                    contentColor = WhiteSurface
                ),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "Explore Full Catalogue",
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.5.sp
                )
            }
        }
    }
}

@Composable
private fun ShowcaseTab(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (isSelected) colors.primary else colors.surfaceElevated)
            .border(1.dp, if (isSelected) colors.primary else colors.border, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = 11.5.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            color = if (isSelected) WhiteSurface else colors.textSecondary,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.data.model.Product
import com.moodyorange.app.ui.theme.EditorialSerif
import com.moodyorange.app.ui.theme.MangalaTheme
import com.moodyorange.app.ui.theme.WhiteSurface

@Composable
fun ProductCard(
    product: Product,
    onClick: () -> Unit,
    onQuickAdd: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors
    val isDark = colors.isDark

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .border(0.5.dp, colors.border, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = colors.surface),
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column {
            // Product image area with badges overlay
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(140.dp)
                    .background(colors.surfaceElevated)
            ) {
                ProductImage(
                    imageUrl = product.imageUrl,
                    categorySlug = product.categorySlug,
                    contentDescription = product.name,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(140.dp)
                )

                // Top badges row: FSSAI Dietary Indicator & Stock status
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Vegetarian / Non-Vegetarian symbol
                    FoodClassificationIndicator(
                        isVeg = product.isVeg,
                        size = 18.dp
                    )

                    // Stock status chip
                    if (product.isInStock) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(5.dp))
                                .background(colors.inStockBg)
                                .padding(horizontal = 6.dp, vertical = 2.5.dp)
                        ) {
                            Text(
                                text = "In Stock",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = colors.inStockGreen
                            )
                        }
                    } else {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(5.dp))
                                .background(colors.outOfStockBg)
                                .padding(horizontal = 6.dp, vertical = 2.5.dp)
                        ) {
                            Text(
                                text = "Unavailable",
                                fontSize = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = colors.outOfStockRed
                            )
                        }
                    }
                }
            }

            // Info Section
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(12.dp)
            ) {
                // Category & Prep Time row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = product.categoryName.uppercase(),
                        fontSize = 9.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.primary,
                        letterSpacing = 0.8.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )

                    Text(
                        text = "⏱️ ${product.prepTimeMinutes}m",
                        fontSize = 10.sp,
                        color = colors.textMuted
                    )
                }

                Spacer(modifier = Modifier.height(3.dp))

                // Product Name
                Text(
                    text = product.name,
                    fontSize = 14.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = colors.textPrimary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                if (!product.description.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(3.dp))
                    Text(
                        text = product.description,
                        fontSize = 11.5.sp,
                        color = colors.textSecondary,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Price & Quick Add Button Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = product.formattedPrice,
                        fontFamily = EditorialSerif,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.primary
                    )

                    if (onQuickAdd != null && product.isInStock) {
                        Box(
                            modifier = Modifier
                                .size(30.dp)
                                .clip(RoundedCornerShape(8.dp))
                                .background(colors.primary)
                                .clickable { onQuickAdd() }
                                .semantics {
                                    contentDescription = "Add ${product.name} to cart"
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "+",
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isDark) colors.canvas else WhiteSurface
                            )
                        }
                    } else {
                        Text(
                            text = "Details →",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                            color = colors.primary
                        )
                    }
                }
            }
        }
    }
}

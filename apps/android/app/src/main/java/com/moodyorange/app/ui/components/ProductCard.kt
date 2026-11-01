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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.data.model.Product
import com.moodyorange.app.ui.theme.BorderMuted
import com.moodyorange.app.ui.theme.CardBackground
import com.moodyorange.app.ui.theme.InStockBg
import com.moodyorange.app.ui.theme.InStockGreen
import com.moodyorange.app.ui.theme.OrangeLight
import com.moodyorange.app.ui.theme.OrangePrimary
import com.moodyorange.app.ui.theme.OutOfStockBg
import com.moodyorange.app.ui.theme.OutOfStockRed
import com.moodyorange.app.ui.theme.SurfaceVariant
import com.moodyorange.app.ui.theme.TextPrimary
import com.moodyorange.app.ui.theme.TextSecondary
import com.moodyorange.app.ui.theme.VegGreen

@Composable
fun ProductCard(
    product: Product,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .border(1.dp, BorderMuted, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = CardBackground),
        shape = RoundedCornerShape(16.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column {
            // Product image area with placeholder
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(140.dp)
            ) {
                ProductPlaceholder(
                    categorySlug = product.categorySlug,
                    modifier = Modifier.fillMaxWidth().height(140.dp)
                )

                // Top badges: Veg indicator & Availability
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    // Veg indicator
                    if (product.isVeg) {
                        Box(
                            modifier = Modifier
                                .size(18.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .border(1.5.dp, VegGreen, RoundedCornerShape(3.dp))
                                .background(CardBackground),
                            contentAlignment = Alignment.Center
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(8.dp)
                                    .clip(CircleShape)
                                    .background(VegGreen)
                            )
                        }
                    } else {
                        Spacer(modifier = Modifier.width(1.dp))
                    }

                    // Stock availability badge
                    if (product.isInStock) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(InStockBg)
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "In Stock",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = InStockGreen
                            )
                        }
                    } else {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(OutOfStockBg)
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "Unavailable",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = OutOfStockRed
                            )
                        }
                    }
                }
            }

            // Info Section
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp)
            ) {
                Text(
                    text = product.categoryName.uppercase(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = OrangePrimary,
                    letterSpacing = 0.8.sp
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = product.name,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                if (!product.description.isNullOrBlank()) {
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = product.description,
                        fontSize = 12.sp,
                        color = TextSecondary,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = product.formattedPrice,
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )

                    Text(
                        text = "View Details →",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = OrangePrimary
                    )
                }
            }
        }
    }
}

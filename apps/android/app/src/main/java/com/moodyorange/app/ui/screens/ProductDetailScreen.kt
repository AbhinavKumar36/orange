package com.moodyorange.app.ui.screens

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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.data.model.Product
import com.moodyorange.app.ui.components.ProductPlaceholder
import com.moodyorange.app.ui.theme.BorderMuted
import com.moodyorange.app.ui.theme.CardBackground
import com.moodyorange.app.ui.theme.CreamBackground
import com.moodyorange.app.ui.theme.InStockBg
import com.moodyorange.app.ui.theme.InStockGreen
import com.moodyorange.app.ui.theme.OrangeLight
import com.moodyorange.app.ui.theme.OrangePrimary
import com.moodyorange.app.ui.theme.OutOfStockBg
import com.moodyorange.app.ui.theme.OutOfStockRed
import com.moodyorange.app.ui.theme.SurfaceVariant
import com.moodyorange.app.ui.theme.TextMuted
import com.moodyorange.app.ui.theme.TextPrimary
import com.moodyorange.app.ui.theme.TextSecondary
import com.moodyorange.app.ui.theme.VegGreen

@Composable
fun ProductDetailScreen(
    product: Product,
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val scrollState = rememberScrollState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(CreamBackground)
    ) {
        // 1. Top Bar with Back Button
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(CardBackground)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(OrangeLight)
                    .clickable(onClick = onBackClick),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "←",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = OrangePrimary
                )
            }

            Spacer(modifier = Modifier.width(14.dp))

            Column {
                Text(
                    text = product.name,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary,
                    maxLines = 1
                )
                Text(
                    text = product.categoryName,
                    fontSize = 12.sp,
                    color = TextSecondary
                )
            }
        }

        // 2. Scrollable Product Details Content
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(20.dp)
        ) {
            // Hero Illustration Area
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(220.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .border(1.dp, BorderMuted, RoundedCornerShape(20.dp))
            ) {
                ProductPlaceholder(
                    categorySlug = product.categorySlug,
                    modifier = Modifier.fillMaxSize()
                )
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Badges row: Veg indicator & Category & Availability
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
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
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Vegetarian",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = VegGreen
                        )
                        Spacer(modifier = Modifier.width(12.dp))
                    }

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(OrangeLight)
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = product.categoryName,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = OrangePrimary
                        )
                    }
                }

                // In Stock vs Out of stock
                if (product.isInStock) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(InStockBg)
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "In Stock",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = InStockGreen
                        )
                    }
                } else {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(OutOfStockBg)
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "Currently Unavailable",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = OutOfStockRed
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Product Title
            Text(
                text = product.name,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )

            Spacer(modifier = Modifier.height(6.dp))

            // Authoritative Formatted Price in INR
            Text(
                text = product.formattedPrice,
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = OrangePrimary
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Description Section
            if (!product.description.isNullOrBlank()) {
                Text(
                    text = "About this confection",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = product.description,
                    fontSize = 14.sp,
                    color = TextSecondary,
                    lineHeight = 22.sp
                )
                Spacer(modifier = Modifier.height(18.dp))
            }

            // Specs Card: Preparation time and Allergens
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(CardBackground)
                    .border(1.dp, BorderMuted, RoundedCornerShape(14.dp))
                    .padding(16.dp)
            ) {
                // Prep time
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = "⏱️", fontSize = 16.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = "Preparation Time",
                            fontSize = 12.sp,
                            color = TextMuted
                        )
                        Text(
                            text = "${product.prepTimeMinutes} minutes fresh craft",
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = TextPrimary
                        )
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Allergens
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = "🌾", fontSize = 16.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = "Allergen Information",
                            fontSize = 12.sp,
                            color = TextMuted
                        )
                        val allergenText = if (product.allergens.isNotEmpty()) {
                            "Contains: " + product.allergens.joinToString(", ")
                        } else {
                            "No major allergens declared"
                        }
                        Text(
                            text = allergenText,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = TextPrimary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Phase 4 Honest Cart State:
            // Nonfunctional button is honestly disabled with "Coming Soon in Phase 5"
            Button(
                onClick = {},
                enabled = false,
                colors = ButtonDefaults.buttonColors(
                    disabledContainerColor = SurfaceVariant,
                    disabledContentColor = TextMuted
                ),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                Text(
                    text = "Online Ordering Coming in Phase 5",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

package com.moodyorange.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.data.model.Category
import com.moodyorange.app.data.model.Product
import com.moodyorange.app.ui.components.BrandStorySection
import com.moodyorange.app.ui.components.BrandValuesSection
import com.moodyorange.app.ui.components.FeaturedCollectionsRow
import com.moodyorange.app.ui.components.HeaderBar
import com.moodyorange.app.ui.components.ProductCard
import com.moodyorange.app.ui.components.ProductCardSkeleton
import com.moodyorange.app.ui.components.ProductShowcaseSection
import com.moodyorange.app.ui.components.`3d`.Hero3DObject
import com.moodyorange.app.ui.theme.DarkBackground
import com.moodyorange.app.ui.theme.DarkBorder
import com.moodyorange.app.ui.theme.DarkTextMuted
import com.moodyorange.app.ui.theme.DarkTextPrimary
import com.moodyorange.app.ui.theme.DarkTextSecondary
import com.moodyorange.app.ui.theme.EditorialSerif
import com.moodyorange.app.ui.theme.GourmetGold
import com.moodyorange.app.ui.theme.OrangeLight
import com.moodyorange.app.ui.theme.OrangePrimary
import com.moodyorange.app.ui.theme.TextMuted
import com.moodyorange.app.ui.theme.TextPrimary
import com.moodyorange.app.ui.viewmodel.CatalogViewModel
import com.moodyorange.app.ui.viewmodel.UiState

@Composable
fun HomeScreen(
    viewModel: CatalogViewModel,
    onProductClick: (Product) -> Unit,
    onQuickAdd: (Product) -> Unit = {},
    cartItemCount: Int = 0,
    onCartClick: () -> Unit = {},
    isLoggedIn: Boolean = false,
    customerName: String? = null,
    onProfileClick: () -> Unit = {},
    onNavigateToShop: (Category?) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val categoriesState by viewModel.categoriesState.collectAsState()
    val productsState by viewModel.productsState.collectAsState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(DarkBackground)
    ) {
        // Sticky Frosted Header
        HeaderBar(
            cartItemCount = cartItemCount,
            onCartClick = onCartClick,
            isLoggedIn = isLoggedIn,
            customerName = customerName,
            onProfileClick = onProfileClick,
            isDark = true
        )

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 24.dp)
        ) {
            // 1. Cinematic Hero Section with 3D Centerpiece
            item {
                HeroSection(
                    onShopNow = { onNavigateToShop(null) }
                )
            }

            // 2. Featured Collections Horizontal Panels
            if (categoriesState is UiState.Success) {
                val categories = (categoriesState as UiState.Success<List<Category>>).data
                item {
                    Spacer(modifier = Modifier.height(28.dp))
                    FeaturedCollectionsRow(
                        categories = categories,
                        onCategoryClick = { category -> onNavigateToShop(category) }
                    )
                }
            }

            // 3. Tactile 3D Inspection Studio
            item {
                Spacer(modifier = Modifier.height(32.dp))
                ProductShowcaseSection(
                    onExploreShop = { onNavigateToShop(null) }
                )
            }

            // 4. Featured Confections Section
            item {
                Spacer(modifier = Modifier.height(36.dp))
                FeaturedConfectionsHeader(onViewAll = { onNavigateToShop(null) })
                Spacer(modifier = Modifier.height(14.dp))
            }

            when (val state = productsState) {
                is UiState.Loading -> {
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            ProductCardSkeleton(modifier = Modifier.weight(1f))
                            ProductCardSkeleton(modifier = Modifier.weight(1f))
                        }
                    }
                }
                is UiState.Success -> {
                    val products = state.data.take(6)
                    // Render in 2-column paired rows
                    val chunked = products.chunked(2)
                    items(chunked) { pair ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 20.dp, vertical = 6.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            ProductCard(
                                product = pair[0],
                                onClick = { onProductClick(pair[0]) },
                                onQuickAdd = { onQuickAdd(pair[0]) },
                                modifier = Modifier.weight(1f)
                            )
                            if (pair.size > 1) {
                                ProductCard(
                                    product = pair[1],
                                    onClick = { onProductClick(pair[1]) },
                                    onQuickAdd = { onQuickAdd(pair[1]) },
                                    modifier = Modifier.weight(1f)
                                )
                            } else {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }
                is UiState.Error -> {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(20.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Unable to load fresh confections. Pull to refresh.",
                                color = DarkTextMuted,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
                UiState.Idle -> {}
            }

            // 5. Brand Craft Story Spread
            item {
                Spacer(modifier = Modifier.height(36.dp))
                BrandStorySection()
            }

            // 6. Store Values & Guarantees
            item {
                Spacer(modifier = Modifier.height(36.dp))
                BrandValuesSection()
            }

            // 7. Boutique Footer
            item {
                Spacer(modifier = Modifier.height(36.dp))
                HomeFooter()
            }
        }
    }
}

@Composable
private fun HeroSection(
    onShopNow: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        DarkBackground,
                        Color(0xFF140F0A),
                        DarkBackground
                    )
                )
            )
            .padding(horizontal = 20.dp, vertical = 16.dp)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth()
        ) {
            // Editorial Capsule Pill
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0x33FF5500))
                    .border(1.dp, Color(0x66FF5500), RoundedCornerShape(20.dp))
                    .padding(horizontal = 14.dp, vertical = 5.dp)
            ) {
                Text(
                    text = "VALENCIA HARVEST 2026",
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = OrangePrimary,
                    letterSpacing = 1.2.sp
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Main Editorial Headline
            Text(
                text = "Pure Citrus &\nSingle-Origin Cacao",
                fontFamily = EditorialSerif,
                fontSize = 28.sp,
                lineHeight = 34.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                color = DarkTextPrimary
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Immersive digital commerce for artisanal cakes, cold-pressed elixirs and gourmet confections.",
                fontSize = 13.sp,
                lineHeight = 18.sp,
                textAlign = TextAlign.Center,
                color = DarkTextSecondary,
                modifier = Modifier.padding(horizontal = 16.dp)
            )

            Spacer(modifier = Modifier.height(16.dp))

            // Interactive 3D Orange Centerpiece
            Hero3DObject(
                size = 230.dp,
                modifier = Modifier.padding(vertical = 4.dp)
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Value pills row
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                HeroPill(text = "⚡ 15-Min Pickup")
                HeroPill(text = "🌱 100% Eggless")
                HeroPill(text = "✨ Small Batch")
            }

            Spacer(modifier = Modifier.height(20.dp))

            // CTA Button
            Button(
                onClick = onShopNow,
                colors = ButtonDefaults.buttonColors(
                    containerColor = OrangePrimary,
                    contentColor = Color.White
                ),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                Text(
                    text = "Explore Boutique Catalog →",
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp
                )
            }
        }
    }
}

@Composable
private fun HeroPill(text: String) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0x1AFFFFFF))
            .border(1.dp, DarkBorder, RoundedCornerShape(12.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(
            text = text,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            color = DarkTextSecondary
        )
    }
}

@Composable
private fun FeaturedConfectionsHeader(onViewAll: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = "DAILY CREATIONS",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                color = OrangePrimary,
                letterSpacing = 1.sp
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "Chef's Featured Treats",
                fontFamily = EditorialSerif,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = DarkTextPrimary
            )
        }

        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(10.dp))
                .clickable(onClick = onViewAll)
                .background(Color(0x1AFFFFFF))
                .padding(horizontal = 10.dp, vertical = 6.dp)
        ) {
            Text(
                text = "View All →",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = OrangePrimary
            )
        }
    }
}

@Composable
private fun HomeFooter() {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(Color(0x33FF5500)),
            contentAlignment = Alignment.Center
        ) {
            Text(text = "🍊", fontSize = 18.sp)
        }

        Spacer(modifier = Modifier.height(10.dp))

        Text(
            text = "MOODY ORANGE",
            fontFamily = EditorialSerif,
            fontSize = 16.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
            color = DarkTextPrimary
        )

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = "Counter Pickup Kitchen • Open 10:00 AM – 10:00 PM",
            fontSize = 12.sp,
            color = DarkTextSecondary,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(2.dp))

        Text(
            text = "All items eggless, 100% vegetarian & freshly prepared.",
            fontSize = 11.sp,
            color = DarkTextMuted,
            textAlign = TextAlign.Center
        )
    }
}

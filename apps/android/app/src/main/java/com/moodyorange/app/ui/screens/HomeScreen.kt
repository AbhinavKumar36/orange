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
import androidx.compose.foundation.layout.width
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
import com.moodyorange.app.ui.theme.EditorialSerif
import com.moodyorange.app.ui.theme.ForestGreen
import com.moodyorange.app.ui.theme.MangalaTheme
import com.moodyorange.app.ui.theme.MutedGold
import com.moodyorange.app.ui.theme.WhiteSurface
import com.moodyorange.app.ui.viewmodel.CatalogViewModel
import com.moodyorange.app.ui.viewmodel.UiState
import coil.compose.SubcomposeAsyncImage
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.Brush

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
    onThemeToggle: (() -> Unit)? = null,
    onNavigateToShop: (Category?) -> Unit = {},
    onNavigateToOrders: () -> Unit = {},
    activePackedOrdersCount: Int = 0,
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors
    val categoriesState by viewModel.categoriesState.collectAsState()
    val productsState by viewModel.productsState.collectAsState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.canvas)
    ) {
        // Sticky Header with Theme Toggle & Cart
        HeaderBar(
            cartItemCount = cartItemCount,
            onCartClick = onCartClick,
            isLoggedIn = isLoggedIn,
            customerName = customerName,
            onProfileClick = onProfileClick,
            onThemeToggle = onThemeToggle,
            isDark = colors.isDark
        )

        // Live Order Packed Notification Banner (if customer has active packed order)
        if (activePackedOrdersCount > 0) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (colors.isDark) Color(0xFF0F2532) else Color(0xFFE8F5EC))
                    .border(1.dp, if (colors.isDark) MutedGold else ForestGreen, RoundedCornerShape(12.dp))
                    .clickable { onNavigateToOrders() }
                    .padding(horizontal = 14.dp, vertical = 10.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = "🎉", fontSize = 20.sp)
                    Spacer(modifier = Modifier.width(10.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "ORDER PACKED & READY FOR PICKUP!",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (colors.isDark) MutedGold else ForestGreen,
                            letterSpacing = 0.5.sp
                        )
                        Text(
                            text = "Your delicacies are packed in our boutique packaging waiting at the counter.",
                            fontSize = 11.5.sp,
                            color = colors.textPrimary,
                            lineHeight = 15.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "View →",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (colors.isDark) MutedGold else ForestGreen
                    )
                }
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 28.dp)
        ) {
            // 1. Luxury Editorial Hero Section with 3D Centerpiece
            item {
                HeroSection(
                    onShopNow = { onNavigateToShop(null) }
                )
            }

            // 2. Featured Collections Horizontal Panels
            if (categoriesState is UiState.Success) {
                val categories = (categoriesState as UiState.Success<List<Category>>).data
                item {
                    Spacer(modifier = Modifier.height(24.dp))
                    FeaturedCollectionsRow(
                        categories = categories,
                        onCategoryClick = { category -> onNavigateToShop(category) }
                    )
                }
            }

            // 3. Tactile 3D Inspection Studio
            item {
                Spacer(modifier = Modifier.height(28.dp))
                ProductShowcaseSection(
                    onExploreShop = { onNavigateToShop(null) }
                )
            }

            // 4. Featured Confections Section
            item {
                Spacer(modifier = Modifier.height(28.dp))
                FeaturedConfectionsHeader(onViewAll = { onNavigateToShop(null) })
                Spacer(modifier = Modifier.height(12.dp))
            }

            when (val state = productsState) {
                is UiState.Loading -> {
                    item {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            ProductCardSkeleton(modifier = Modifier.weight(1f))
                            ProductCardSkeleton(modifier = Modifier.weight(1f))
                        }
                    }
                }
                is UiState.Success -> {
                    val products = state.data.take(6)
                    val chunked = products.chunked(2)
                    items(chunked) { pair ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 6.dp),
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
                                color = colors.textMuted,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
                UiState.Idle -> {}
            }

            // 5. Brand Heritage & Story Spread
            item {
                Spacer(modifier = Modifier.height(28.dp))
                BrandStorySection()
            }

            // 6. Store Values & Guarantees
            item {
                Spacer(modifier = Modifier.height(28.dp))
                BrandValuesSection()
            }

            // 7. Boutique Footer
            item {
                Spacer(modifier = Modifier.height(28.dp))
                HomeFooter()
            }
        }
    }
}

@Composable
private fun HeroSection(
    onShopNow: () -> Unit
) {
    val colors = MangalaTheme.colors
    val isDark = colors.isDark

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.surfaceElevated)
            .padding(horizontal = 16.dp, vertical = 20.dp)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.fillMaxWidth()
        ) {
            // Editorial Capsule Pill
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(16.dp))
                    .background(colors.primaryContainer)
                    .border(0.5.dp, colors.border, RoundedCornerShape(16.dp))
                    .padding(horizontal = 12.dp, vertical = 4.5.dp)
            ) {
                Text(
                    text = "MANGALA ENTERPRISES • ARTISANAL DELICACIES",
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.primary,
                    letterSpacing = 1.sp
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Main Editorial Headline
            Text(
                text = "Exquisite Patisserie &\nFine Confections",
                fontFamily = EditorialSerif,
                fontSize = 26.sp,
                lineHeight = 32.sp,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                color = colors.textPrimary
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "Curated daily in our boutique vitrines using single-origin cacao, pure cold-pressed fruit extracts, and farm-fresh ingredients. In-store ready to sell for instant counter pickup.",
                fontSize = 12.5.sp,
                lineHeight = 18.sp,
                textAlign = TextAlign.Center,
                color = colors.textSecondary,
                modifier = Modifier.padding(horizontal = 12.dp)
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Boutique In-Store Display Counter Photo
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .border(1.dp, colors.border, RoundedCornerShape(14.dp))
            ) {
                SubcomposeAsyncImage(
                    model = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
                    contentDescription = "Mangala Enterprises In-Store Display Counter",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(Color.Transparent, Color(0xAA040D12))
                            )
                        )
                )
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(10.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color(0xCC040D12))
                        .border(0.5.dp, colors.gold, RoundedCornerShape(6.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "✨ IN-STORE DISPLAY VITRINE • READY TO SELL",
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.gold,
                        letterSpacing = 0.5.sp
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Value pills row
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                HeroPill(text = "🛍️ Ready Stock")
                HeroPill(text = "⚡ Instant Handover")
                HeroPill(text = "🌿 FSSAI Declared")
            }

            Spacer(modifier = Modifier.height(18.dp))

            // CTA Button
            Button(
                onClick = onShopNow,
                colors = ButtonDefaults.buttonColors(
                    containerColor = colors.primary,
                    contentColor = if (isDark) colors.canvas else WhiteSurface
                ),
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
            ) {
                Text(
                    text = "Shop Live Menu →",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.5.sp
                )
            }
        }
    }
}

@Composable
private fun HeroPill(text: String) {
    val colors = MangalaTheme.colors
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(colors.surface)
            .border(0.5.dp, colors.border, RoundedCornerShape(8.dp))
            .padding(horizontal = 9.dp, vertical = 4.dp)
    ) {
        Text(
            text = text,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            color = colors.textSecondary
        )
    }
}

@Composable
private fun FeaturedConfectionsHeader(onViewAll: () -> Unit) {
    val colors = MangalaTheme.colors

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(
                text = "DAILY CREATIONS",
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                color = colors.primary,
                letterSpacing = 1.sp
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "Chef's Featured Treats",
                fontFamily = EditorialSerif,
                fontSize = 19.sp,
                fontWeight = FontWeight.Bold,
                color = colors.textPrimary
            )
        }

        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(8.dp))
                .clickable(onClick = onViewAll)
                .background(colors.primaryContainer)
                .padding(horizontal = 10.dp, vertical = 5.dp)
        ) {
            Text(
                text = "View All →",
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.primary
            )
        }
    }
}

@Composable
private fun HomeFooter() {
    val colors = MangalaTheme.colors
    val isDark = colors.isDark

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(if (isDark) MutedGold else ForestGreen),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "M",
                fontFamily = EditorialSerif,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                color = if (isDark) colors.canvas else WhiteSurface
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = "MANGALA ENTERPRISES",
            fontFamily = EditorialSerif,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.sp,
            color = colors.textPrimary
        )

        Spacer(modifier = Modifier.height(4.dp))

        Text(
            text = "Boutique Counter Pickup • Open 10:00 AM – 10:00 PM",
            fontSize = 11.5.sp,
            color = colors.textSecondary,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(2.dp))

        Text(
            text = "Freshly prepared for immediate or scheduled collection.",
            fontSize = 10.5.sp,
            color = colors.textMuted,
            textAlign = TextAlign.Center
        )
    }
}

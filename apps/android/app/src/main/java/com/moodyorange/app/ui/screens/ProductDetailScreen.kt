package com.moodyorange.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import androidx.compose.ui.window.Dialog
import com.moodyorange.app.data.model.Product
import com.moodyorange.app.ui.components.ErrorStateView
import com.moodyorange.app.ui.components.FoodClassificationIndicator
import com.moodyorange.app.ui.components.LoadingStateView
import com.moodyorange.app.ui.components.ProductCard
import com.moodyorange.app.ui.components.ProductImage
import com.moodyorange.app.ui.components.`3d`.Product3DViewer
import com.moodyorange.app.ui.theme.EditorialSerif
import com.moodyorange.app.ui.theme.ForestGreen
import com.moodyorange.app.ui.theme.MangalaTheme
import com.moodyorange.app.ui.theme.MutedGold
import com.moodyorange.app.ui.theme.WhiteSurface
import com.moodyorange.app.ui.viewmodel.CatalogViewModel
import com.moodyorange.app.ui.viewmodel.ProductDetailUiState
import com.moodyorange.app.ui.viewmodel.UiState
import com.moodyorange.app.util.CurrencyFormatter

enum class GalleryMode { STUDIO_2D, THREE_D }

@Composable
fun ProductDetailScreen(
    productIdOrSlug: String,
    viewModel: CatalogViewModel,
    onBackClick: () -> Unit,
    onAddToCart: (Product, Int) -> Unit = { _, _ -> },
    onProductClick: (Product) -> Unit = {},
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors
    val detailState by viewModel.productDetailState.collectAsState()
    val allProductsState by viewModel.productsState.collectAsState()

    LaunchedEffect(productIdOrSlug) {
        viewModel.loadProductDetail(productIdOrSlug)
    }

    when (val state = detailState) {
        is ProductDetailUiState.Loading, ProductDetailUiState.Idle -> {
            Column(
                modifier = modifier
                    .fillMaxSize()
                    .background(colors.canvas)
            ) {
                DetailTopBar(
                    title = "Loading...",
                    subtitle = "Mangala Enterprises",
                    onBackClick = onBackClick
                )
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    LoadingStateView(message = "Preparing fine confection details...")
                }
            }
        }
        is ProductDetailUiState.NotFound -> {
            Column(
                modifier = modifier
                    .fillMaxSize()
                    .background(colors.canvas)
            ) {
                DetailTopBar(
                    title = "Confection Not Found",
                    subtitle = "Boutique Catalog",
                    onBackClick = onBackClick
                )
                ErrorStateView(
                    message = "The requested delicacy could not be found or has been retired from today's batch.",
                    onRetry = onBackClick,
                    modifier = Modifier.fillMaxSize()
                )
            }
        }
        is ProductDetailUiState.Error -> {
            Column(
                modifier = modifier
                    .fillMaxSize()
                    .background(colors.canvas)
            ) {
                DetailTopBar(
                    title = "Unable to Load",
                    subtitle = "Boutique Catalog",
                    onBackClick = onBackClick
                )
                ErrorStateView(
                    message = state.message,
                    onRetry = { viewModel.loadProductDetail(productIdOrSlug) },
                    modifier = Modifier.fillMaxSize()
                )
            }
        }
        is ProductDetailUiState.Success -> {
            val product = state.product
            val relatedProducts = if (allProductsState is UiState.Success) {
                (allProductsState as UiState.Success<List<Product>>).data
                    .filter { it.id != product.id && it.categoryId == product.categoryId }
                    .take(4)
            } else emptyList()

            ProductDetailContent(
                product = product,
                relatedProducts = relatedProducts,
                onBackClick = onBackClick,
                onAddToCart = onAddToCart,
                onRelatedProductClick = onProductClick,
                modifier = modifier
            )
        }
    }
}

@Composable
private fun DetailTopBar(
    title: String,
    subtitle: String,
    onBackClick: () -> Unit
) {
    val colors = MangalaTheme.colors

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.surface)
            .statusBarsPadding()
            .border(0.5.dp, colors.border)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .border(0.5.dp, colors.border, CircleShape)
                .background(colors.surfaceElevated)
                .clickable(onClick = onBackClick),
            contentAlignment = Alignment.Center
        ) {
            Text(text = "←", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = colors.textPrimary)
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column {
            Text(
                text = title,
                fontFamily = EditorialSerif,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = colors.textPrimary,
                maxLines = 1
            )
            Text(
                text = subtitle,
                fontSize = 10.5.sp,
                color = colors.textSecondary
            )
        }
    }
}

@Composable
private fun ProductDetailContent(
    product: Product,
    relatedProducts: List<Product>,
    onBackClick: () -> Unit,
    onAddToCart: (Product, Int) -> Unit,
    onRelatedProductClick: (Product) -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors
    val isDark = colors.isDark
    val scrollState = rememberScrollState()
    var galleryMode by remember { mutableStateOf(GalleryMode.STUDIO_2D) }
    var quantity by remember { mutableIntStateOf(1) }
    var showZoomModal by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.canvas)
    ) {
        DetailTopBar(
            title = product.name,
            subtitle = product.categoryName,
            onBackClick = onBackClick
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(16.dp)
        ) {
            // Gallery Mode Tabs
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(10.dp))
                    .background(colors.surface)
                    .border(0.5.dp, colors.border, RoundedCornerShape(10.dp))
                    .padding(3.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (galleryMode == GalleryMode.STUDIO_2D) (if (isDark) MutedGold else ForestGreen) else Color.Transparent)
                        .clickable { galleryMode = GalleryMode.STUDIO_2D }
                        .padding(vertical = 7.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "📷 Studio View",
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (galleryMode == GalleryMode.STUDIO_2D) (if (isDark) colors.canvas else WhiteSurface) else colors.textSecondary
                    )
                }

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (galleryMode == GalleryMode.THREE_D) (if (isDark) MutedGold else ForestGreen) else Color.Transparent)
                        .clickable { galleryMode = GalleryMode.THREE_D }
                        .padding(vertical = 7.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "✨ 3D Orbit Viewer",
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (galleryMode == GalleryMode.THREE_D) (if (isDark) colors.canvas else WhiteSurface) else colors.textSecondary
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Main Visual Area
            if (galleryMode == GalleryMode.STUDIO_2D) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(230.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(colors.surface)
                        .border(0.5.dp, colors.border, RoundedCornerShape(14.dp))
                        .clickable { showZoomModal = true }
                ) {
                    ProductImage(
                        imageUrl = product.imageUrl,
                        categorySlug = product.categorySlug,
                        contentDescription = product.name,
                        modifier = Modifier.fillMaxSize()
                    )

                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(10.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color(0x88000000))
                            .padding(horizontal = 8.dp, vertical = 3.5.dp)
                    ) {
                        Text(text = "🔍 Tap to Zoom", fontSize = 10.sp, color = Color.White)
                    }
                }
            } else {
                Product3DViewer(
                    categorySlug = product.categorySlug,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(240.dp)
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Badges row: Dietary classification, category, availability
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    FoodClassificationIndicator(
                        isVeg = product.isVeg,
                        showLabel = true,
                        size = 18.dp
                    )

                    Spacer(modifier = Modifier.width(8.dp))

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(colors.primaryContainer)
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = product.categoryName,
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = colors.primary
                        )
                    }
                }

                if (product.isInStock) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(colors.inStockBg)
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = "In Stock",
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = colors.inStockGreen
                        )
                    }
                } else {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(colors.outOfStockBg)
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = "Unavailable",
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = colors.outOfStockRed
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Product Title
            Text(
                text = product.name,
                fontFamily = EditorialSerif,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = colors.textPrimary
            )

            Spacer(modifier = Modifier.height(4.dp))

            // Price in INR
            Text(
                text = product.formattedPrice,
                fontFamily = EditorialSerif,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = colors.primary
            )

            Spacer(modifier = Modifier.height(14.dp))

            // Description Section
            if (!product.description.isNullOrBlank()) {
                Text(
                    text = "Culinary Profile",
                    fontFamily = EditorialSerif,
                    fontSize = 14.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.textPrimary
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = product.description,
                    fontSize = 13.sp,
                    lineHeight = 19.sp,
                    color = colors.textSecondary
                )
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Specs Card: Preparation time and Allergens
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(colors.surface)
                    .border(0.5.dp, colors.border, RoundedCornerShape(12.dp))
                    .padding(14.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = "⏱️", fontSize = 16.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = "Preparation Time",
                            fontSize = 10.5.sp,
                            color = colors.textMuted
                        )
                        Text(
                            text = "${product.prepTimeMinutes} minutes fresh kitchen craft",
                            fontSize = 12.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = colors.textPrimary
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = "🌾", fontSize = 16.sp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Column {
                        Text(
                            text = "Allergen Information",
                            fontSize = 10.5.sp,
                            color = colors.textMuted
                        )
                        val allergenText = if (product.allergens.isNotEmpty()) {
                            "Contains: " + product.allergens.joinToString(", ")
                        } else {
                            "No major allergens declared"
                        }
                        Text(
                            text = allergenText,
                            fontSize = 12.5.sp,
                            fontWeight = FontWeight.Medium,
                            color = colors.textPrimary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Quantity Stepper & Add to Cart
            val isInStock = product.isInStock
            val totalPricePaise = product.basePrice * quantity
            val totalPriceFormatted = CurrencyFormatter.formatPaiseToInr(totalPricePaise)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(10.dp))
                        .background(colors.surface)
                        .border(0.5.dp, colors.border, RoundedCornerShape(10.dp))
                        .padding(horizontal = 4.dp, vertical = 2.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clickable(enabled = quantity > 1) { quantity -= 1 },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "−",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (quantity > 1) colors.textPrimary else colors.textMuted
                        )
                    }

                    Text(
                        text = "$quantity",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.textPrimary,
                        modifier = Modifier.padding(horizontal = 8.dp)
                    )

                    Box(
                        modifier = Modifier
                            .size(34.dp)
                            .clickable(enabled = quantity < 10) { quantity += 1 },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "+",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (quantity < 10) colors.textPrimary else colors.textMuted
                        )
                    }
                }

                Button(
                    onClick = { onAddToCart(product, quantity) },
                    enabled = isInStock,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = colors.primary,
                        contentColor = if (isDark) colors.canvas else WhiteSurface
                    ),
                    shape = RoundedCornerShape(10.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(46.dp)
                ) {
                    Text(
                        text = if (isInStock) "Add to Bag • $totalPriceFormatted" else "Temporarily Unavailable",
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Related Products Carousel
            if (relatedProducts.isNotEmpty()) {
                Spacer(modifier = Modifier.height(28.dp))
                Text(
                    text = "You May Also Relish",
                    fontFamily = EditorialSerif,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.textPrimary
                )
                Spacer(modifier = Modifier.height(10.dp))

                val relatedScrollState = rememberScrollState()
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(relatedScrollState),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    relatedProducts.forEach { rel ->
                        Box(modifier = Modifier.width(160.dp)) {
                            ProductCard(
                                product = rel,
                                onClick = { onRelatedProductClick(rel) }
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))
        }
    }

    if (showZoomModal) {
        Dialog(onDismissRequest = { showZoomModal = false }) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clickable { showZoomModal = false }
                    .padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(320.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(colors.surfaceElevated)
                        .border(0.5.dp, colors.border, RoundedCornerShape(16.dp))
                ) {
                    ProductImage(
                        imageUrl = product.imageUrl,
                        categorySlug = product.categorySlug,
                        contentDescription = product.name,
                        modifier = Modifier.fillMaxSize()
                    )
                }
            }
        }
    }
}

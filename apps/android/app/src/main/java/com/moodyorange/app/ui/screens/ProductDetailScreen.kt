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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.moodyorange.app.data.model.Product
import com.moodyorange.app.ui.components.ErrorStateView
import com.moodyorange.app.ui.components.LoadingStateView
import com.moodyorange.app.ui.components.ProductCard
import com.moodyorange.app.ui.components.ProductImage
import com.moodyorange.app.ui.components.`3d`.Product3DViewer
import com.moodyorange.app.ui.theme.BorderMuted
import com.moodyorange.app.ui.theme.CardBackground
import com.moodyorange.app.ui.theme.CreamBackground
import com.moodyorange.app.ui.theme.DarkBackground
import com.moodyorange.app.ui.theme.EditorialSerif
import com.moodyorange.app.ui.theme.InStockBg
import com.moodyorange.app.ui.theme.InStockGreen
import com.moodyorange.app.ui.theme.OrangeLight
import com.moodyorange.app.ui.theme.OrangePrimary
import com.moodyorange.app.ui.theme.OutOfStockBg
import com.moodyorange.app.ui.theme.OutOfStockRed
import com.moodyorange.app.ui.theme.TextMuted
import com.moodyorange.app.ui.theme.TextPrimary
import com.moodyorange.app.ui.theme.TextSecondary
import com.moodyorange.app.ui.theme.VegGreen
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
                    .background(CreamBackground)
            ) {
                DetailTopBar(
                    title = "Loading...",
                    subtitle = "Boutique Catalog",
                    onBackClick = onBackClick
                )
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    LoadingStateView(message = "Fetching confection details...")
                }
            }
        }
        is ProductDetailUiState.NotFound -> {
            Column(
                modifier = modifier
                    .fillMaxSize()
                    .background(CreamBackground)
            ) {
                DetailTopBar(
                    title = "Not Found",
                    subtitle = "Boutique Catalog",
                    onBackClick = onBackClick
                )
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .clip(CircleShape)
                            .background(OrangeLight),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "🍰", fontSize = 26.sp)
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    Text(
                        text = "Confection Not Found",
                        fontFamily = EditorialSerif,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Text(
                        text = "The requested product is no longer available in the boutique catalog.",
                        fontSize = 13.sp,
                        color = TextMuted,
                        textAlign = TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    Button(
                        onClick = onBackClick,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = OrangePrimary,
                            contentColor = Color.White
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(text = "Back to Catalog", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
        is ProductDetailUiState.Error -> {
            Column(
                modifier = modifier
                    .fillMaxSize()
                    .background(CreamBackground)
            ) {
                DetailTopBar(
                    title = "Error",
                    subtitle = "Boutique Catalog",
                    onBackClick = onBackClick
                )
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    ErrorStateView(
                        message = state.message,
                        onRetry = { viewModel.loadProductDetail(productIdOrSlug, force = true) }
                    )
                }
            }
        }
        is ProductDetailUiState.Success -> {
            val relatedProducts = if (allProductsState is UiState.Success) {
                (allProductsState as UiState.Success<List<Product>>).data.filter { it.id != state.product.id }.take(4)
            } else emptyList()

            ProductDetailContent(
                product = state.product,
                relatedProducts = relatedProducts,
                onBackClick = onBackClick,
                onAddToCart = { prod, qty -> onAddToCart(prod, qty) },
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
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(CardBackground)
            .border(width = 0.5.dp, color = BorderMuted)
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
                text = title,
                fontFamily = EditorialSerif,
                fontSize = 16.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary,
                maxLines = 1
            )
            Text(
                text = subtitle,
                fontSize = 11.sp,
                color = TextSecondary
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
    val scrollState = rememberScrollState()
    var galleryMode by remember { mutableStateOf(GalleryMode.STUDIO_2D) }
    var quantity by remember { mutableIntStateOf(1) }
    var showZoomModal by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(CreamBackground)
    ) {
        // 1. Top Bar
        DetailTopBar(
            title = product.name,
            subtitle = product.categoryName,
            onBackClick = onBackClick
        )

        // 2. Scrollable Body
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(20.dp)
        ) {
            // Gallery Mode Tabs: Studio 2D vs 3D Orbit Viewer
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(CardBackground)
                    .border(1.dp, BorderMuted, RoundedCornerShape(12.dp))
                    .padding(4.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (galleryMode == GalleryMode.STUDIO_2D) OrangePrimary else Color.Transparent)
                        .clickable { galleryMode = GalleryMode.STUDIO_2D }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "📷 Studio View",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (galleryMode == GalleryMode.STUDIO_2D) Color.White else TextSecondary
                    )
                }

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (galleryMode == GalleryMode.THREE_D) OrangePrimary else Color.Transparent)
                        .clickable { galleryMode = GalleryMode.THREE_D }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "🍊 3D Orbit Viewer",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (galleryMode == GalleryMode.THREE_D) Color.White else TextSecondary
                    )
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Main Visual Area
            if (galleryMode == GalleryMode.STUDIO_2D) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(240.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .border(1.dp, BorderMuted, RoundedCornerShape(20.dp))
                        .clickable { showZoomModal = true }
                ) {
                    ProductImage(
                        imageUrl = product.imageUrl,
                        categorySlug = product.categorySlug,
                        contentDescription = product.name,
                        modifier = Modifier.fillMaxSize()
                    )

                    // Zoom icon badge
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(12.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0x88000000))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Text(text = "🔍 Tap to Zoom", fontSize = 10.sp, color = Color.White)
                    }
                }
            } else {
                Product3DViewer(
                    categorySlug = product.categorySlug,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(260.dp)
                )
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Badges row: Veg, Category, Availability
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
                                    .size(7.dp)
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
                        Spacer(modifier = Modifier.width(10.dp))
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
                            fontWeight = FontWeight.Bold,
                            color = OrangePrimary
                        )
                    }
                }

                // In Stock vs Out of Stock
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
                            fontWeight = FontWeight.Bold,
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
                            fontWeight = FontWeight.Bold,
                            color = OutOfStockRed
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Product Title
            Text(
                text = product.name,
                fontFamily = EditorialSerif,
                fontSize = 24.sp,
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
                    text = "Culinary Profile",
                    fontFamily = EditorialSerif,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = product.description,
                    fontSize = 14.sp,
                    lineHeight = 21.sp,
                    color = TextSecondary
                )
                Spacer(modifier = Modifier.height(18.dp))
            }

            // Specs Card: Preparation time and Allergens
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(CardBackground)
                    .border(1.dp, BorderMuted, RoundedCornerShape(16.dp))
                    .padding(16.dp)
            ) {
                // Prep time
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = "⏱️", fontSize = 18.sp)
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "Preparation Time",
                            fontSize = 11.sp,
                            color = TextMuted
                        )
                        Text(
                            text = "${product.prepTimeMinutes} minutes fresh craft",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Allergens
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = "🌾", fontSize = 18.sp)
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "Allergen Information",
                            fontSize = 11.sp,
                            color = TextMuted
                        )
                        val allergenText = if (product.allergens.isNotEmpty()) {
                            "Contains: " + product.allergens.joinToString(", ")
                        } else {
                            "No major allergens declared"
                        }
                        Text(
                            text = allergenText,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = TextPrimary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))

            // Quantity Stepper & Add to Cart Action
            val isInStock = product.isInStock
            val totalPricePaise = product.basePrice * quantity
            val totalPriceFormatted = CurrencyFormatter.formatPaiseToInr(totalPricePaise)

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Stepper
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(CardBackground)
                        .border(1.dp, BorderMuted, RoundedCornerShape(12.dp))
                        .padding(horizontal = 6.dp, vertical = 4.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clickable(enabled = quantity > 1) { quantity -= 1 },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "−", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = if (quantity > 1) TextPrimary else TextMuted)
                    }

                    Text(
                        text = "$quantity",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary,
                        modifier = Modifier.padding(horizontal = 10.dp)
                    )

                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clickable(enabled = quantity < 10) { quantity += 1 },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "+", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = if (quantity < 10) TextPrimary else TextMuted)
                    }
                }

                // Add to Shopping Bag Button
                Button(
                    onClick = { onAddToCart(product, quantity) },
                    enabled = isInStock,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = OrangePrimary,
                        contentColor = Color.White
                    ),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .weight(1f)
                        .height(48.dp)
                ) {
                    Text(
                        text = if (isInStock) "Add to Bag • $totalPriceFormatted" else "Temporarily Unavailable",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            // Related Products Carousel
            if (relatedProducts.isNotEmpty()) {
                Spacer(modifier = Modifier.height(32.dp))
                Text(
                    text = "You May Also Relish",
                    fontFamily = EditorialSerif,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                Spacer(modifier = Modifier.height(12.dp))

                val relatedScrollState = rememberScrollState()
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(relatedScrollState),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    relatedProducts.forEach { rel ->
                        Box(modifier = Modifier.width(170.dp)) {
                            ProductCard(
                                product = rel,
                                onClick = { onRelatedProductClick(rel) }
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }

    // Fullscreen Zoom Dialog
    if (showZoomModal) {
        Dialog(onDismissRequest = { showZoomModal = false }) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clickable { showZoomModal = false }
                    .padding(20.dp),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(340.dp)
                        .clip(RoundedCornerShape(20.dp))
                        .background(DarkBackground)
                        .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(20.dp))
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

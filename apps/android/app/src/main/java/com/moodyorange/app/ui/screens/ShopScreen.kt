package com.moodyorange.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.data.model.Category
import com.moodyorange.app.data.model.Product
import com.moodyorange.app.ui.components.CategoryPillRow
import com.moodyorange.app.ui.components.EmptyStateView
import com.moodyorange.app.ui.components.ErrorStateView
import com.moodyorange.app.ui.components.HeaderBar
import com.moodyorange.app.ui.components.ProductCard
import com.moodyorange.app.ui.components.ProductCardSkeleton
import com.moodyorange.app.ui.components.SearchBar
import com.moodyorange.app.ui.theme.MangalaTheme
import com.moodyorange.app.ui.viewmodel.CatalogViewModel
import com.moodyorange.app.ui.viewmodel.SortOption
import com.moodyorange.app.ui.viewmodel.UiState

@Composable
fun ShopScreen(
    viewModel: CatalogViewModel,
    onProductClick: (Product) -> Unit,
    onQuickAdd: (Product) -> Unit = {},
    cartItemCount: Int = 0,
    onCartClick: () -> Unit = {},
    isLoggedIn: Boolean = false,
    customerName: String? = null,
    onProfileClick: () -> Unit = {},
    onThemeToggle: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors
    val categoriesState by viewModel.categoriesState.collectAsState()
    val productsState by viewModel.productsState.collectAsState()
    val selectedCategory by viewModel.selectedCategory.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    val sortOption by viewModel.sortOption.collectAsState()
    val isVegOnly by viewModel.isVegOnly.collectAsState()
    val isInStockOnly by viewModel.isInStockOnly.collectAsState()

    var showSortMenu by remember { mutableStateOf(false) }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.canvas)
    ) {
        // Sticky Header with theme toggle
        HeaderBar(
            cartItemCount = cartItemCount,
            onCartClick = onCartClick,
            isLoggedIn = isLoggedIn,
            customerName = customerName,
            onProfileClick = onProfileClick,
            onThemeToggle = onThemeToggle,
            isDark = colors.isDark
        )

        // Search Input
        Box(modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) {
            SearchBar(
                query = searchQuery,
                onQueryChange = { viewModel.onSearchQueryChanged(it) }
            )
        }

        // Category Pills
        when (val catState = categoriesState) {
            is UiState.Success -> {
                CategoryPillRow(
                    categories = catState.data,
                    selectedCategorySlug = selectedCategory?.slug,
                    onCategorySelected = { viewModel.selectCategory(it) }
                )
            }
            else -> {
                Spacer(modifier = Modifier.height(4.dp))
            }
        }

        // Filters & Sorting Chips Row
        val filterScrollState = rememberScrollState()
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .horizontalScroll(filterScrollState)
                .padding(horizontal = 16.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Veg Only Toggle Chip
            FilterChip(
                label = "🌿 Veg Only",
                isActive = isVegOnly,
                onClick = { viewModel.toggleVegOnly() }
            )

            // In Stock Only Toggle Chip
            FilterChip(
                label = "✓ In Stock",
                isActive = isInStockOnly,
                onClick = { viewModel.toggleInStockOnly() }
            )

            // Sorting Dropdown Trigger
            Box {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(if (sortOption != SortOption.FEATURED) colors.primaryContainer else colors.surface)
                        .border(
                            0.5.dp,
                            if (sortOption != SortOption.FEATURED) colors.primary else colors.border,
                            RoundedCornerShape(8.dp)
                        )
                        .clickable { showSortMenu = true }
                        .padding(horizontal = 11.dp, vertical = 6.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "⇅ ${sortOption.label}",
                            fontSize = 11.5.sp,
                            fontWeight = if (sortOption != SortOption.FEATURED) FontWeight.Bold else FontWeight.Medium,
                            color = if (sortOption != SortOption.FEATURED) colors.primary else colors.textSecondary
                        )
                    }
                }

                DropdownMenu(
                    expanded = showSortMenu,
                    onDismissRequest = { showSortMenu = false }
                ) {
                    SortOption.entries.forEach { option ->
                        DropdownMenuItem(
                            text = {
                                Text(
                                    text = option.label,
                                    fontSize = 12.5.sp,
                                    fontWeight = if (sortOption == option) FontWeight.Bold else FontWeight.Normal,
                                    color = if (sortOption == option) colors.primary else colors.textPrimary
                                )
                            },
                            onClick = {
                                viewModel.setSortOption(option)
                                showSortMenu = false
                            }
                        )
                    }
                }
            }
        }

        // Products Catalog Result Grid
        when (val state = productsState) {
            is UiState.Loading -> {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(6) {
                        ProductCardSkeleton()
                    }
                }
            }
            is UiState.Error -> {
                ErrorStateView(
                    message = state.message,
                    onRetry = { viewModel.loadCatalog() },
                    modifier = Modifier.fillMaxSize()
                )
            }
            is UiState.Success -> {
                // Apply local filters and sorting
                var products = state.data

                if (isVegOnly) {
                    products = products.filter { it.isVeg == true }
                }
                if (isInStockOnly) {
                    products = products.filter { it.isInStock }
                }

                products = when (sortOption) {
                    SortOption.FEATURED -> products
                    SortOption.PRICE_ASC -> products.sortedBy { it.basePrice }
                    SortOption.PRICE_DESC -> products.sortedByDescending { it.basePrice }
                    SortOption.PREP_ASC -> products.sortedBy { it.prepTimeMinutes }
                }

                if (products.isEmpty()) {
                    EmptyStateView(
                        title = "No Confections Found",
                        message = "We couldn't find items matching your current filters or search term.",
                        onClear = { viewModel.resetFilters() },
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 20.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(products, key = { it.id }) { product ->
                            ProductCard(
                                product = product,
                                onClick = { onProductClick(product) },
                                onQuickAdd = { onQuickAdd(product) }
                            )
                        }
                    }
                }
            }
            UiState.Idle -> {}
        }
    }
}

@Composable
private fun FilterChip(
    label: String,
    isActive: Boolean,
    onClick: () -> Unit
) {
    val colors = MangalaTheme.colors

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(if (isActive) colors.primaryContainer else colors.surface)
            .border(
                0.5.dp,
                if (isActive) colors.primary else colors.border,
                RoundedCornerShape(8.dp)
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 11.dp, vertical = 6.dp)
    ) {
        Text(
            text = label,
            fontSize = 11.5.sp,
            fontWeight = if (isActive) FontWeight.Bold else FontWeight.Medium,
            color = if (isActive) colors.primary else colors.textSecondary
        )
    }
}

package com.moodyorange.app.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.data.model.Product
import com.moodyorange.app.ui.components.CategoryPillRow
import com.moodyorange.app.ui.components.EmptyStateView
import com.moodyorange.app.ui.components.ErrorStateView
import com.moodyorange.app.ui.components.HeaderBar
import com.moodyorange.app.ui.components.LoadingStateView
import com.moodyorange.app.ui.components.ProductCard
import com.moodyorange.app.ui.components.SearchBar
import com.moodyorange.app.ui.theme.CreamBackground
import com.moodyorange.app.ui.theme.TextMuted
import com.moodyorange.app.ui.theme.TextPrimary
import com.moodyorange.app.ui.viewmodel.CatalogViewModel
import com.moodyorange.app.ui.viewmodel.UiState

@Composable
fun HomeScreen(
    viewModel: CatalogViewModel,
    onProductClick: (Product) -> Unit,
    modifier: Modifier = Modifier
) {
    val categoriesState by viewModel.categoriesState.collectAsState()
    val productsState by viewModel.productsState.collectAsState()
    val selectedCategory by viewModel.selectedCategory.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(CreamBackground)
    ) {
        // 1. Top Brand Header
        HeaderBar()

        // 2. Search Field
        Box(modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp)) {
            SearchBar(
                query = searchQuery,
                onQueryChange = { viewModel.onSearchQueryChanged(it) }
            )
        }

        // 3. Category Shortcuts / Pills
        when (val catState = categoriesState) {
            is UiState.Success -> {
                CategoryPillRow(
                    categories = catState.data,
                    selectedCategorySlug = selectedCategory?.slug,
                    onCategorySelected = { viewModel.selectCategory(it) }
                )
            }
            is UiState.Loading -> {
                // Subtle spacing while categories load
                Spacer(modifier = Modifier.height(4.dp))
            }
            is UiState.Error -> {
                // Silently fallback without crashing UI; categories can be re-tried with full reload
                Spacer(modifier = Modifier.height(4.dp))
            }
            UiState.Idle -> {}
        }

        // Section Title: Shows active category name or search status
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            val titleText = when {
                searchQuery.isNotEmpty() -> "Results for \"$searchQuery\""
                selectedCategory != null -> selectedCategory?.name ?: "Treats"
                else -> "Artisanal Collection"
            }

            Text(
                text = titleText,
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )

            if (productsState is UiState.Success) {
                val count = (productsState as UiState.Success<List<Product>>).data.size
                Text(
                    text = "$count item${if (count == 1) "" else "s"}",
                    fontSize = 12.sp,
                    color = TextMuted
                )
            }
        }

        // 4. Products Grid / State Handling
        when (val state = productsState) {
            is UiState.Loading -> {
                LoadingStateView(
                    message = "Loading boutique confections...",
                    modifier = Modifier.fillMaxSize()
                )
            }
            is UiState.Error -> {
                ErrorStateView(
                    message = state.message,
                    onRetry = { viewModel.loadCatalog() },
                    modifier = Modifier.fillMaxSize()
                )
            }
            is UiState.Success -> {
                val products = state.data
                if (products.isEmpty()) {
                    val isFiltering = searchQuery.isNotEmpty() || selectedCategory != null
                    EmptyStateView(
                        title = if (isFiltering) "No Matching Items" else "Catalog Currently Empty",
                        message = if (isFiltering) {
                            "We couldn't find any artisanal items matching your selection."
                        } else {
                            "Fresh batches are currently in preparation. Please check back shortly."
                        },
                        onClear = if (isFiltering) {
                            {
                                viewModel.selectCategory(null)
                                viewModel.onSearchQueryChanged("")
                            }
                        } else null,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    LazyVerticalGrid(
                        columns = GridCells.Fixed(2),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(products, key = { it.id }) { product ->
                            ProductCard(
                                product = product,
                                onClick = { onProductClick(product) }
                            )
                        }
                    }
                }
            }
            UiState.Idle -> {}
        }
    }
}


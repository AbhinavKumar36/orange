package com.moodyorange.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.moodyorange.app.data.model.Category
import com.moodyorange.app.data.model.Product
import com.moodyorange.app.data.repository.CatalogRepository
import com.moodyorange.app.data.repository.CatalogRepositoryImpl
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface UiState<out T> {
    object Idle : UiState<Nothing>
    object Loading : UiState<Nothing>
    data class Success<T>(val data: T) : UiState<T>
    data class Error(val message: String) : UiState<Nothing>
}

sealed interface ProductDetailUiState {
    object Idle : ProductDetailUiState
    object Loading : ProductDetailUiState
    data class Success(val product: Product) : ProductDetailUiState
    object NotFound : ProductDetailUiState
    data class Error(val message: String) : ProductDetailUiState
}

enum class SortOption(val label: String) {
    FEATURED("Featured"),
    PRICE_ASC("Price: Low to High"),
    PRICE_DESC("Price: High to Low"),
    PREP_ASC("Prep Time")
}

class CatalogViewModel(
    private val repository: CatalogRepository = CatalogRepositoryImpl(),
    private val coroutineScope: CoroutineScope? = null
) : ViewModel() {

    private val scope: CoroutineScope
        get() = coroutineScope ?: viewModelScope

    private val _categoriesState = MutableStateFlow<UiState<List<Category>>>(UiState.Loading)
    val categoriesState: StateFlow<UiState<List<Category>>> = _categoriesState.asStateFlow()

    private val _productsState = MutableStateFlow<UiState<List<Product>>>(UiState.Loading)
    val productsState: StateFlow<UiState<List<Product>>> = _productsState.asStateFlow()

    private val _selectedCategory = MutableStateFlow<Category?>(null)
    val selectedCategory: StateFlow<Category?> = _selectedCategory.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _sortOption = MutableStateFlow(SortOption.FEATURED)
    val sortOption: StateFlow<SortOption> = _sortOption.asStateFlow()

    private val _isVegOnly = MutableStateFlow(false)
    val isVegOnly: StateFlow<Boolean> = _isVegOnly.asStateFlow()

    private val _isInStockOnly = MutableStateFlow(false)
    val isInStockOnly: StateFlow<Boolean> = _isInStockOnly.asStateFlow()

    private val _productDetailState = MutableStateFlow<ProductDetailUiState>(ProductDetailUiState.Idle)
    val productDetailState: StateFlow<ProductDetailUiState> = _productDetailState.asStateFlow()

    private var currentDetailIdOrSlug: String? = null
    private var loadProductDetailJob: Job? = null
    private var searchJob: Job? = null
    private var loadProductsJob: Job? = null

    init {
        loadCatalog()
    }

    fun loadCatalog() {
        loadCategories()
        loadProducts()
    }

    fun loadCategories() {
        scope.launch {
            _categoriesState.value = UiState.Loading
            repository.getCategories()
                .onSuccess { categories ->
                    _categoriesState.value = UiState.Success(categories)
                }
                .onFailure { error ->
                    _categoriesState.value = UiState.Error(
                        error.message ?: "Failed to load boutique categories."
                    )
                }
        }
    }

    fun selectCategory(category: Category?) {
        _selectedCategory.value = category
        // Category selection clears any previous free-form search query to show category contents
        _searchQuery.value = ""
        loadProducts()
    }

    fun onSearchQueryChanged(newQuery: String) {
        _searchQuery.value = newQuery
        searchJob?.cancel()
        searchJob = scope.launch {
            // Debounce user input by 300ms
            delay(300)
            loadProducts()
        }
    }

    fun setSortOption(option: SortOption) {
        _sortOption.value = option
    }

    fun toggleVegOnly() {
        _isVegOnly.value = !_isVegOnly.value
    }

    fun toggleInStockOnly() {
        _isInStockOnly.value = !_isInStockOnly.value
    }

    fun resetFilters() {
        _selectedCategory.value = null
        _searchQuery.value = ""
        _sortOption.value = SortOption.FEATURED
        _isVegOnly.value = false
        _isInStockOnly.value = false
        loadProducts()
    }

    fun loadProducts() {
        loadProductsJob?.cancel()
        loadProductsJob = scope.launch {
            _productsState.value = UiState.Loading

            val categoryId = _selectedCategory.value?.id
            val categorySlug = _selectedCategory.value?.slug
            val query = _searchQuery.value.trim().takeIf { it.isNotEmpty() }

            repository.getProducts(
                categoryId = categoryId,
                categorySlug = categorySlug,
                search = query
            )
                .onSuccess { products ->
                    _productsState.value = UiState.Success(products)
                }
                .onFailure { error ->
                    _productsState.value = UiState.Error(
                        error.message ?: "Failed to retrieve products from boutique catalog."
                    )
                }
        }
    }

    fun loadProductDetail(idOrSlug: String, force: Boolean = false) {
        if (!force && currentDetailIdOrSlug == idOrSlug && _productDetailState.value is ProductDetailUiState.Success) {
            // Avoid redundant request when this product is already loaded
            return
        }

        currentDetailIdOrSlug = idOrSlug
        loadProductDetailJob?.cancel()
        loadProductDetailJob = scope.launch {
            _productDetailState.value = ProductDetailUiState.Loading
            repository.getProductByIdOrSlug(idOrSlug)
                .onSuccess { product ->
                    if (product != null) {
                        _productDetailState.value = ProductDetailUiState.Success(product)
                    } else {
                        _productDetailState.value = ProductDetailUiState.NotFound
                    }
                }
                .onFailure { error ->
                    _productDetailState.value = ProductDetailUiState.Error(
                        error.message ?: "Failed to load product details."
                    )
                }
        }
    }

    fun clearProductDetail() {
        loadProductDetailJob?.cancel()
        currentDetailIdOrSlug = null
        _productDetailState.value = ProductDetailUiState.Idle
    }
}

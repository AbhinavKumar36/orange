package com.moodyorange.app.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.moodyorange.app.data.model.Category
import com.moodyorange.app.data.model.Product
import com.moodyorange.app.data.repository.CatalogRepository
import com.moodyorange.app.data.repository.CatalogRepositoryImpl
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

class CatalogViewModel(
    private val repository: CatalogRepository = CatalogRepositoryImpl()
) : ViewModel() {

    private val _categoriesState = MutableStateFlow<UiState<List<Category>>>(UiState.Loading)
    val categoriesState: StateFlow<UiState<List<Category>>> = _categoriesState.asStateFlow()

    private val _productsState = MutableStateFlow<UiState<List<Product>>>(UiState.Loading)
    val productsState: StateFlow<UiState<List<Product>>> = _productsState.asStateFlow()

    private val _selectedCategory = MutableStateFlow<Category?>(null)
    val selectedCategory: StateFlow<Category?> = _selectedCategory.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _productDetailState = MutableStateFlow<UiState<Product?>>(UiState.Idle)
    val productDetailState: StateFlow<UiState<Product?>> = _productDetailState.asStateFlow()

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
        viewModelScope.launch {
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
        searchJob = viewModelScope.launch {
            // Debounce user input by 300ms
            delay(300)
            loadProducts()
        }
    }

    fun loadProducts() {
        loadProductsJob?.cancel()
        loadProductsJob = viewModelScope.launch {
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

    fun loadProductDetail(idOrSlug: String) {
        viewModelScope.launch {
            _productDetailState.value = UiState.Loading
            repository.getProductByIdOrSlug(idOrSlug)
                .onSuccess { product ->
                    if (product != null) {
                        _productDetailState.value = UiState.Success(product)
                    } else {
                        _productDetailState.value = UiState.Error("Product not found.")
                    }
                }
                .onFailure { error ->
                    _productDetailState.value = UiState.Error(
                        error.message ?: "Failed to load product details."
                    )
                }
        }
    }

    fun clearProductDetail() {
        _productDetailState.value = UiState.Idle
    }
}

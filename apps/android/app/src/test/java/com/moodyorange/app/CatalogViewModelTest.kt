package com.moodyorange.app

import com.moodyorange.app.data.api.ApiException
import com.moodyorange.app.data.model.Category
import com.moodyorange.app.data.model.Product
import com.moodyorange.app.data.repository.CatalogRepository
import com.moodyorange.app.ui.viewmodel.CatalogViewModel
import com.moodyorange.app.ui.viewmodel.ProductDetailUiState
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CatalogViewModelTest {

    private val testProduct = Product(
        id = "test-uuid-1",
        categoryId = "cat-1",
        categoryName = "Artisanal Cakes",
        categorySlug = "artisanal-cakes",
        name = "Valencia Orange Cake",
        slug = "valencia-orange-cake",
        description = "Delicious orange infused sponge",
        basePrice = 45000L,
        isInStock = true
    )

    class TrackingCatalogRepository(
        private val product: Product?,
        private val shouldFail: Boolean = false
    ) : CatalogRepository {
        var fetchCallCount = 0

        override suspend fun getCategories(): Result<List<Category>> {
            return Result.success(emptyList())
        }

        override suspend fun getProducts(
            categoryId: String?,
            categorySlug: String?,
            search: String?
        ): Result<List<Product>> {
            return Result.success(emptyList())
        }

        override suspend fun getProductByIdOrSlug(idOrSlug: String): Result<Product?> {
            fetchCallCount++
            if (shouldFail) {
                return Result.failure(ApiException(500, "Database connection error"))
            }
            return Result.success(product)
        }
    }

    @Test
    fun testLoadProductDetailSuccess() {
        val repo = TrackingCatalogRepository(testProduct)
        val testScope = CoroutineScope(Dispatchers.Unconfined)
        val viewModel = CatalogViewModel(repository = repo, coroutineScope = testScope)

        viewModel.loadProductDetail("test-uuid-1")

        val state = viewModel.productDetailState.value
        assertTrue("State must be Success", state is ProductDetailUiState.Success)
        val success = state as ProductDetailUiState.Success
        assertEquals("Valencia Orange Cake", success.product.name)
        assertEquals(1, repo.fetchCallCount)
    }

    @Test
    fun testLoadProductDetailNotFound() {
        val repo = TrackingCatalogRepository(null)
        val testScope = CoroutineScope(Dispatchers.Unconfined)
        val viewModel = CatalogViewModel(repository = repo, coroutineScope = testScope)

        viewModel.loadProductDetail("non-existent-slug")

        val state = viewModel.productDetailState.value
        assertTrue("State must be NotFound", state is ProductDetailUiState.NotFound)
        assertEquals(1, repo.fetchCallCount)
    }

    @Test
    fun testLoadProductDetailError() {
        val repo = TrackingCatalogRepository(testProduct, shouldFail = true)
        val testScope = CoroutineScope(Dispatchers.Unconfined)
        val viewModel = CatalogViewModel(repository = repo, coroutineScope = testScope)

        viewModel.loadProductDetail("test-uuid-1")

        val state = viewModel.productDetailState.value
        assertTrue("State must be Error", state is ProductDetailUiState.Error)
        val error = state as ProductDetailUiState.Error
        assertEquals("Database connection error", error.message)
    }

    @Test
    fun testAvoidsRedundantFetchesUnlessForced() {
        val repo = TrackingCatalogRepository(testProduct)
        val testScope = CoroutineScope(Dispatchers.Unconfined)
        val viewModel = CatalogViewModel(repository = repo, coroutineScope = testScope)

        viewModel.loadProductDetail("test-uuid-1")
        assertEquals(1, repo.fetchCallCount)

        // Second call with same id without force must skip redundant request
        viewModel.loadProductDetail("test-uuid-1", force = false)
        assertEquals("Call count must remain 1 due to deduplication", 1, repo.fetchCallCount)

        // Third call with force = true must re-fetch
        viewModel.loadProductDetail("test-uuid-1", force = true)
        assertEquals("Call count must increment to 2 when force = true", 2, repo.fetchCallCount)
    }

    @Test
    fun testClearProductDetail() {
        val repo = TrackingCatalogRepository(testProduct)
        val testScope = CoroutineScope(Dispatchers.Unconfined)
        val viewModel = CatalogViewModel(repository = repo, coroutineScope = testScope)

        viewModel.loadProductDetail("test-uuid-1")
        assertTrue(viewModel.productDetailState.value is ProductDetailUiState.Success)

        viewModel.clearProductDetail()
        assertTrue(viewModel.productDetailState.value is ProductDetailUiState.Idle)
    }
}


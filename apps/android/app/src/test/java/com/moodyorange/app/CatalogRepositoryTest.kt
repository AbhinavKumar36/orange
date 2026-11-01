package com.moodyorange.app

import com.moodyorange.app.data.api.ApiException
import com.moodyorange.app.data.model.Category
import com.moodyorange.app.data.model.Product
import com.moodyorange.app.data.repository.CatalogRepository
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CatalogRepositoryTest {

    private val sampleCategories = listOf(
        Category("11111111-1111-1111-1111-111111111111", "Artisanal Cakes", "artisanal-cakes"),
        Category("22222222-2222-2222-2222-222222222222", "Cold-Pressed Juices", "cold-pressed-juices"),
        Category("33333333-3333-3333-3333-333333333333", "Gourmet Chocolates", "gourmet-chocolates")
    )

    private val sampleProducts = listOf(
        Product(
            id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            categoryId = "11111111-1111-1111-1111-111111111111",
            categoryName = "Artisanal Cakes",
            categorySlug = "artisanal-cakes",
            name = "Dark Chocolate Truffle Cake (500g)",
            slug = "dark-chocolate-truffle-cake-500g",
            description = "Rich dark chocolate cake layered with ganache",
            basePrice = 65000L,
            isInStock = true
        ),
        Product(
            id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            categoryId = "22222222-2222-2222-2222-222222222222",
            categoryName = "Cold-Pressed Juices",
            categorySlug = "cold-pressed-juices",
            name = "Valencia Orange Cold-Pressed (300ml)",
            slug = "valencia-orange-cold-pressed-300ml",
            description = "Refreshing chilled orange juice",
            basePrice = 18000L,
            isInStock = true
        ),
        Product(
            id = "cccccccc-cccc-cccc-cccc-cccccccccccc",
            categoryId = "33333333-3333-3333-3333-333333333333",
            categoryName = "Gourmet Chocolates",
            categorySlug = "gourmet-chocolates",
            name = "Artisanal Praline Box (6 pcs)",
            slug = "artisanal-praline-box-6-pcs",
            description = "Assorted roasted hazelnut pralines",
            basePrice = 35000L,
            isInStock = false
        )
    )

    class FakeCatalogRepository(
        private val categories: List<Category>,
        private val products: List<Product>,
        private val shouldFail: Boolean = false
    ) : CatalogRepository {

        override suspend fun getCategories(): Result<List<Category>> {
            if (shouldFail) {
                return Result.failure(ApiException(503, "Database service is temporarily unavailable."))
            }
            return Result.success(categories)
        }

        override suspend fun getProducts(
            categoryId: String?,
            categorySlug: String?,
            search: String?
        ): Result<List<Product>> {
            if (shouldFail) {
                return Result.failure(ApiException(503, "Database service is temporarily unavailable."))
            }

            var filtered = products
            if (!categoryId.isNullOrBlank()) {
                filtered = filtered.filter { it.categoryId.equals(categoryId, ignoreCase = true) }
            }
            if (!categorySlug.isNullOrBlank()) {
                filtered = filtered.filter { it.categorySlug.equals(categorySlug, ignoreCase = true) }
            }
            if (!search.isNullOrBlank()) {
                val q = search.trim().lowercase()
                filtered = filtered.filter {
                    it.name.lowercase().contains(q) || (it.description?.lowercase()?.contains(q) == true)
                }
            }
            return Result.success(filtered)
        }

        override suspend fun getProductByIdOrSlug(idOrSlug: String): Result<Product?> {
            if (shouldFail) {
                return Result.failure(ApiException(503, "Database service is temporarily unavailable."))
            }
            val target = idOrSlug.lowercase()
            val product = products.find {
                it.id.lowercase() == target || it.slug.lowercase() == target
            }
            return Result.success(product)
        }
    }

    @Test
    fun testGetCategoriesSuccess() = runBlocking {
        val repo = FakeCatalogRepository(sampleCategories, sampleProducts)
        val result = repo.getCategories()
        assertTrue(result.isSuccess)
        assertEquals(3, result.getOrNull()?.size)
    }

    @Test
    fun testCategoryFiltering() = runBlocking {
        val repo = FakeCatalogRepository(sampleCategories, sampleProducts)
        val juiceResult = repo.getProducts(categorySlug = "cold-pressed-juices")
        assertTrue(juiceResult.isSuccess)
        val juices = juiceResult.getOrNull() ?: emptyList()
        assertEquals(1, juices.size)
        assertEquals("Valencia Orange Cold-Pressed (300ml)", juices[0].name)
    }

    @Test
    fun testSearchFiltering() = runBlocking {
        val repo = FakeCatalogRepository(sampleCategories, sampleProducts)
        val searchResult = repo.getProducts(search = "truffle")
        assertTrue(searchResult.isSuccess)
        val results = searchResult.getOrNull() ?: emptyList()
        assertEquals(1, results.size)
        assertEquals("Dark Chocolate Truffle Cake (500g)", results[0].name)
    }

    @Test
    fun testEmptySearchResults() = runBlocking {
        val repo = FakeCatalogRepository(sampleCategories, sampleProducts)
        val searchResult = repo.getProducts(search = "nonexistent product")
        assertTrue(searchResult.isSuccess)
        assertTrue(searchResult.getOrNull()?.isEmpty() == true)
    }

    @Test
    fun testUnknownProductReturnsNull() = runBlocking {
        val repo = FakeCatalogRepository(sampleCategories, sampleProducts)
        val result = repo.getProductByIdOrSlug("unknown-uuid-or-slug")
        assertTrue(result.isSuccess)
        assertNull("Unknown product must return null without crashing", result.getOrNull())
    }

    @Test
    fun testKnownProductFoundByIdOrSlug() = runBlocking {
        val repo = FakeCatalogRepository(sampleCategories, sampleProducts)
        val byId = repo.getProductByIdOrSlug("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
        assertTrue(byId.isSuccess)
        assertNotNull(byId.getOrNull())
        assertEquals("Dark Chocolate Truffle Cake (500g)", byId.getOrNull()?.name)

        val bySlug = repo.getProductByIdOrSlug("dark-chocolate-truffle-cake-500g")
        assertTrue(bySlug.isSuccess)
        assertNotNull(bySlug.getOrNull())
        assertEquals(65000L, bySlug.getOrNull()?.basePrice)
    }

    @Test
    fun testApiFailureHandling() = runBlocking {
        val failingRepo = FakeCatalogRepository(sampleCategories, sampleProducts, shouldFail = true)
        val catResult = failingRepo.getCategories()
        assertTrue(catResult.isFailure)
        val prodResult = failingRepo.getProducts()
        assertTrue(prodResult.isFailure)
        val detailResult = failingRepo.getProductByIdOrSlug("any-id")
        assertTrue(detailResult.isFailure)
    }
}


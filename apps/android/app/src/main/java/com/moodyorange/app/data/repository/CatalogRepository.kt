package com.moodyorange.app.data.repository

import com.moodyorange.app.data.api.MoodyOrangeApiClient
import com.moodyorange.app.data.model.Category
import com.moodyorange.app.data.model.Product

interface CatalogRepository {
    suspend fun getCategories(): Result<List<Category>>
    suspend fun getProducts(
        categoryId: String? = null,
        categorySlug: String? = null,
        search: String? = null
    ): Result<List<Product>>
    suspend fun getProductByIdOrSlug(idOrSlug: String): Result<Product?>
}

class CatalogRepositoryImpl(
    private val apiClient: MoodyOrangeApiClient = MoodyOrangeApiClient()
) : CatalogRepository {

    override suspend fun getCategories(): Result<List<Category>> {
        return apiClient.getCategories()
    }

    override suspend fun getProducts(
        categoryId: String?,
        categorySlug: String?,
        search: String?
    ): Result<List<Product>> {
        return apiClient.getProducts(
            categoryId = categoryId,
            categorySlug = categorySlug,
            search = search
        )
    }

    override suspend fun getProductByIdOrSlug(idOrSlug: String): Result<Product?> {
        return apiClient.getProductByIdOrSlug(idOrSlug)
    }
}

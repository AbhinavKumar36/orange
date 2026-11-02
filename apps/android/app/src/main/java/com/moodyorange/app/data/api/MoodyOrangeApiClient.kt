package com.moodyorange.app.data.api

import com.moodyorange.app.BuildConfig
import com.moodyorange.app.data.model.Category
import com.moodyorange.app.data.model.Product
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Networking client for Moody Orange Fastify Backend API.
 * Uses HttpURLConnection and Dispatchers.IO to maintain hermetic execution without heavy third-party wrappers.
 */
class MoodyOrangeApiClient(
    baseUrl: String = BuildConfig.API_BASE_URL
) {
    val sanitizedBaseUrl = baseUrl.trimEnd('/')

    suspend fun getCategories(): Result<List<Category>> = withContext(Dispatchers.IO) {
        val endpoint = "$sanitizedBaseUrl/categories"
        executeRequest(endpoint) { body ->
            parseCategories(body)
        }
    }

    suspend fun getProducts(
        categoryId: String? = null,
        categorySlug: String? = null,
        search: String? = null
    ): Result<List<Product>> = withContext(Dispatchers.IO) {
        val queryParams = mutableListOf<String>()
        categoryId?.takeIf { it.isNotBlank() }?.let {
            queryParams.add("category_id=" + URLEncoder.encode(it, "UTF-8"))
        }
        categorySlug?.takeIf { it.isNotBlank() }?.let {
            queryParams.add("category_slug=" + URLEncoder.encode(it, "UTF-8"))
        }
        search?.takeIf { it.isNotBlank() }?.let {
            queryParams.add("search=" + URLEncoder.encode(it.trim(), "UTF-8"))
        }

        val queryString = if (queryParams.isNotEmpty()) "?" + queryParams.joinToString("&") else ""
        val endpoint = "$sanitizedBaseUrl/products$queryString"

        executeRequest(endpoint) { body ->
            parseProducts(body)
        }
    }

    suspend fun getProductByIdOrSlug(idOrSlug: String): Result<Product?> = withContext(Dispatchers.IO) {
        val encoded = URLEncoder.encode(idOrSlug, "UTF-8")
        val endpoint = "$sanitizedBaseUrl/products/$encoded"
        var connection: HttpURLConnection? = null

        try {
            val url = URL(endpoint)
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 10_000
                readTimeout = 10_000
                setRequestProperty("Accept", "application/json")
            }

            val statusCode = connection.responseCode
            if (statusCode == 404) {
                return@withContext Result.success(null)
            }

            if (statusCode in 200..299) {
                val responseBody = connection.inputStream.bufferedReader().use { it.readText() }
                val product = parseProductDetail(responseBody)
                Result.success(product)
            } else {
                val errorBody = connection.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                val errorMessage = extractErrorMessage(errorBody, "Server returned HTTP $statusCode")
                Result.failure(ApiException(statusCode, errorMessage))
            }
        } catch (e: Exception) {
            Result.failure(e)
        } finally {
            connection?.disconnect()
        }
    }

    private fun <T> executeRequest(endpoint: String, parser: (String) -> T): Result<T> {
        var connection: HttpURLConnection? = null
        return try {
            val url = URL(endpoint)
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 10_000
                readTimeout = 10_000
                setRequestProperty("Accept", "application/json")
            }

            val statusCode = connection.responseCode
            if (statusCode in 200..299) {
                val body = connection.inputStream.bufferedReader().use { it.readText() }
                Result.success(parser(body))
            } else {
                val errorBody = connection.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                val message = extractErrorMessage(errorBody, "Server error: HTTP $statusCode")
                Result.failure(ApiException(statusCode, message))
            }
        } catch (e: Exception) {
            Result.failure(e)
        } finally {
            connection?.disconnect()
        }
    }

    fun parseCategories(jsonString: String): List<Category> {
        val root = JSONObject(jsonString)
        val array = root.getJSONArray("categories")
        val list = ArrayList<Category>(array.length())
        for (i in 0 until array.length()) {
            val obj = array.getJSONObject(i)
            list.add(
                Category(
                    id = obj.getString("id"),
                    name = obj.getString("name"),
                    slug = obj.getString("slug"),
                    description = if (obj.isNull("description")) null else obj.getString("description"),
                    displayOrder = obj.optInt("display_order", 0)
                )
            )
        }
        return list
    }

    fun parseProducts(jsonString: String): List<Product> {
        val root = JSONObject(jsonString)
        val array = root.getJSONArray("products")
        val list = ArrayList<Product>(array.length())
        for (i in 0 until array.length()) {
            val obj = array.getJSONObject(i)
            list.add(parseSingleProduct(obj))
        }
        return list
    }

    fun parseProductDetail(jsonString: String): Product {
        val root = JSONObject(jsonString)
        val productObj = root.getJSONObject("product")
        return parseSingleProduct(productObj)
    }

    fun parseSingleProduct(obj: JSONObject): Product {
        val allergensList = mutableListOf<String>()
        val allergensArray = obj.optJSONArray("allergens")
        if (allergensArray != null) {
            for (j in 0 until allergensArray.length()) {
                allergensList.add(allergensArray.getString(j))
            }
        }

        // Mandatory safety rule: Never default missing availability to true!
        val isInStock = if (obj.has("isInStock") && !obj.isNull("isInStock")) {
            obj.getBoolean("isInStock")
        } else {
            false
        }

        return Product(
            id = obj.getString("id"),
            categoryId = obj.getString("categoryId"),
            categoryName = obj.optString("categoryName", "Boutique"),
            categorySlug = obj.optString("categorySlug", "boutique"),
            name = obj.getString("name"),
            slug = obj.getString("slug"),
            description = if (obj.isNull("description")) null else obj.getString("description"),
            basePrice = obj.getLong("basePrice"), // Preserved in integer INR paise
            taxRatePct = obj.optDouble("taxRatePct", 5.0),
            isVeg = obj.optBoolean("isVeg", true),
            allergens = allergensList,
            prepTimeMinutes = obj.optInt("prepTimeMinutes", 15),
            imageUrl = if (obj.isNull("imageUrl")) null else obj.getString("imageUrl"),
            isInStock = isInStock
        )
    }

    private fun extractErrorMessage(errorBody: String, fallback: String): String {
        return try {
            val json = JSONObject(errorBody)
            val errorObj = json.optJSONObject("error")
            errorObj?.optString("message", "")?.takeIf { it.isNotBlank() }
                ?: json.optString("message", "")?.takeIf { it.isNotBlank() }
                ?: fallback
        } catch (_: Exception) {
            fallback
        }
    }
}

class ApiException(
    val statusCode: Int,
    override val message: String
) : Exception(message)


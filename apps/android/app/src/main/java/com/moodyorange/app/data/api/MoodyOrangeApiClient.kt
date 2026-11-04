package com.moodyorange.app.data.api

import com.moodyorange.app.BuildConfig
import com.moodyorange.app.data.model.CartValidationItem
import com.moodyorange.app.data.model.CartValidationResponse
import com.moodyorange.app.data.model.Category
import com.moodyorange.app.data.model.CheckoutRequest
import com.moodyorange.app.data.model.CheckoutResponse
import com.moodyorange.app.data.model.CustomerProfile
import com.moodyorange.app.data.model.InitiatePaymentResponse
import com.moodyorange.app.data.model.VerifyPaymentResponse
import com.moodyorange.app.data.model.Order
import com.moodyorange.app.data.model.OrderItem
import com.moodyorange.app.data.model.Product
import com.moodyorange.app.data.model.ValidatedLineItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.ConnectException
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.net.URLEncoder
import java.net.UnknownHostException

/**
 * Networking client for Moody Orange Fastify Backend API.
 * Uses HttpURLConnection and Dispatchers.IO to maintain hermetic execution without heavy third-party wrappers.
 * In DEBUG mode, automatically falls back across local dev hosts (LAN IP, Android Emulator 10.0.2.2, USB reverse 127.0.0.1).
 */
class MoodyOrangeApiClient(
    baseUrl: String = BuildConfig.API_BASE_URL,
    candidateHosts: List<String>? = null,
    private val isDebug: Boolean = BuildConfig.DEBUG
) {
    val configuredBaseUrl: String

    init {
        val trimmed = baseUrl.trimEnd('/')
        if (!isDebug) {
            check(trimmed.isNotBlank()) {
                "Production release builds require a configured API base URL."
            }
            check(trimmed.startsWith("https://")) {
                "Production release builds require HTTPS API base URL. Found: $trimmed"
            }
            val lower = trimmed.lowercase()
            check(!lower.contains("localhost") && !lower.contains("127.0.0.1") && !lower.contains("10.0.2.2")
                && !lower.contains("0.0.0.0") && !lower.contains(".local")
                && !lower.matches(Regex(""".*//(?:192\.168\.|10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.).*"""))) {
                "Production release builds cannot point to local development hosts. Found: $trimmed"
            }
        }
        configuredBaseUrl = trimmed
    }

    @Volatile
    var activeBaseUrl: String = configuredBaseUrl

    // For DEBUG builds only: fallback across standard local development hosts
    // (configured URL / LAN IP, USB reverse 127.0.0.1, Android emulator 10.0.2.2, localhost)
    // Never rely on hardcoded individual LAN IPs.
    val debugCandidateHosts: List<String> = if (isDebug) {
        (candidateHosts ?: listOf(
            configuredBaseUrl,
            "http://127.0.0.1:4000/api/v1",
            "http://10.0.2.2:4000/api/v1",
            "http://localhost:4000/api/v1"
        )).map { it.trimEnd('/') }.distinct()
    } else {
        emptyList()
    }

    fun getCandidateEndpoints(): List<String> {
        return if (isDebug) {
            listOf(activeBaseUrl).plus(debugCandidateHosts).distinct()
        } else {
            listOf(activeBaseUrl)
        }
    }

    suspend fun getCategories(): Result<List<Category>> = withContext(Dispatchers.IO) {
        executeWithFallback("/categories", "GET") { body ->
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
        executeWithFallback("/products$queryString", "GET") { body ->
            parseProducts(body)
        }
    }

    suspend fun getProductByIdOrSlug(idOrSlug: String): Result<Product?> = withContext(Dispatchers.IO) {
        val encoded = URLEncoder.encode(idOrSlug, "UTF-8")
        val path = "/products/$encoded"
        executeWithFallback(
            path = path,
            method = "GET",
            allow404AsNull = true
        ) { body ->
            if (body.isEmpty()) null else parseProductDetail(body)
        }
    }

    suspend fun validateCart(items: List<CartValidationItem>): Result<CartValidationResponse> = withContext(Dispatchers.IO) {
        val jsonArray = JSONArray()
        for (item in items) {
            val itemObj = JSONObject().apply {
                put("productId", item.productId)
                put("quantity", item.quantity)
            }
            jsonArray.put(itemObj)
        }
        val requestBody = JSONObject().apply {
            put("items", jsonArray)
        }.toString()

        executeWithFallback("/orders/validate-cart", "POST", requestBody) { body ->
            parseCartValidation(body)
        }
    }

    suspend fun checkout(
        request: CheckoutRequest,
        token: String,
        idempotencyKey: String
    ): Result<CheckoutResponse> = withContext(Dispatchers.IO) {
        val itemsArray = JSONArray()
        for (item in request.items) {
            val obj = JSONObject().apply {
                put("productId", item.productId)
                put("quantity", item.quantity)
            }
            itemsArray.put(obj)
        }

        val payload = JSONObject().apply {
            put("items", itemsArray)
            put("fulfillment", request.fulfillment)
            if (request.scheduledPickupAt != null) {
                put("scheduledPickupAt", request.scheduledPickupAt)
            }
            put("paymentMethod", request.paymentMethod)
            if (!request.customerName.isNullOrBlank()) {
                put("customerName", request.customerName)
            }
            if (!request.customerPhone.isNullOrBlank()) {
                put("customerPhone", request.customerPhone)
            }
            if (!request.specialNotes.isNullOrBlank()) {
                put("specialNotes", request.specialNotes)
            }
        }.toString()

        val headers = mapOf(
            "Authorization" to "Bearer $token",
            "X-Idempotency-Key" to idempotencyKey,
            "Idempotency-Key" to idempotencyKey
        )

        executeWithFallback("/orders/checkout", "POST", payload, headers) { body ->
            parseCheckoutResponse(body)
        }
    }

    suspend fun initiatePayment(orderId: String, token: String): Result<InitiatePaymentResponse> = withContext(Dispatchers.IO) {
        val payload = JSONObject().apply {
            put("orderId", orderId)
        }.toString()
        val headers = mapOf("Authorization" to "Bearer $token")
        executeWithFallback("/payments/initiate", "POST", payload, headers) { body ->
            parseInitiatePaymentResponse(body)
        }
    }

    suspend fun verifyPayment(
        orderId: String,
        razorpayOrderId: String,
        razorpayPaymentId: String,
        razorpaySignature: String,
        token: String
    ): Result<VerifyPaymentResponse> = withContext(Dispatchers.IO) {
        val payload = JSONObject().apply {
            put("orderId", orderId)
            put("razorpayOrderId", razorpayOrderId)
            put("razorpayPaymentId", razorpayPaymentId)
            put("razorpaySignature", razorpaySignature)
        }.toString()
        val headers = mapOf("Authorization" to "Bearer $token")
        executeWithFallback("/payments/verify", "POST", payload, headers) { body ->
            parseVerifyPaymentResponse(body)
        }
    }

    suspend fun getOrders(token: String): Result<List<Order>> = withContext(Dispatchers.IO) {
        val headers = mapOf("Authorization" to "Bearer $token")
        executeWithFallback("/orders", "GET", null, headers) { body ->
            parseOrdersResponse(body)
        }
    }

    suspend fun getProfile(token: String): Result<CustomerProfile> = withContext(Dispatchers.IO) {
        val headers = mapOf("Authorization" to "Bearer $token")
        executeWithFallback("/profile", "GET", null, headers) { body ->
            parseProfileResponse(body)
        }
    }

    suspend fun updateProfile(fullName: String, email: String? = null, token: String): Result<CustomerProfile> = withContext(Dispatchers.IO) {
        val payload = JSONObject().apply {
            put("fullName", fullName)
            put("full_name", fullName)
            if (email != null) {
                put("email", email)
            }
        }.toString()
        val headers = mapOf("Authorization" to "Bearer $token")
        executeWithFallback("/profile", "PUT", payload, headers) { body ->
            parseProfileResponse(body)
        }
    }

    /**
     * Executes HTTP request with automatic candidate URL fallback in DEBUG mode.
     */
    private fun <T> executeWithFallback(
        path: String,
        method: String,
        body: String? = null,
        extraHeaders: Map<String, String> = emptyMap(),
        allow404AsNull: Boolean = false,
        parser: (String) -> T
    ): Result<T> {
        val candidates = getCandidateEndpoints()

        var lastException: Exception? = null

        for (base in candidates) {
            val endpoint = "$base$path"
            var connection: HttpURLConnection? = null
            try {
                val url = URL(endpoint)
                connection = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = method
                    connectTimeout = 2_500 // Fast failover across candidates in local dev
                    readTimeout = 8_000
                    setRequestProperty("Accept", "application/json")
                    if (body != null) {
                        setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                        doOutput = true
                    }
                    extraHeaders.forEach { (k, v) -> setRequestProperty(k, v) }
                }

                if (body != null) {
                    OutputStreamWriter(connection.outputStream, "UTF-8").use {
                        it.write(body)
                        it.flush()
                    }
                }

                val statusCode = connection.responseCode
                if (allow404AsNull && statusCode == 404) {
                    activeBaseUrl = base
                    return Result.success(parser(""))
                }

                if (statusCode in 200..299) {
                    activeBaseUrl = base
                    val responseText = connection.inputStream.bufferedReader().use { it.readText() }
                    return Result.success(parser(responseText))
                } else {
                    val errorBody = connection.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                    val message = extractErrorMessage(errorBody, "Server returned HTTP $statusCode")
                    return Result.failure(ApiException(statusCode, message))
                }
            } catch (e: Exception) {
                lastException = e
                // Only fallback on network unreachable/timeout errors
                val isNetworkError = e is ConnectException || e is SocketTimeoutException || e is UnknownHostException
                if (!isDebug || !isNetworkError) {
                    return Result.failure(e)
                }
            } finally {
                connection?.disconnect()
            }
        }

        return Result.failure(
            lastException ?: ApiException(-1, "Unable to connect to Moody Orange server on $activeBaseUrl")
        )
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

        val isInStock = if (obj.has("isInStock") && !obj.isNull("isInStock")) {
            obj.getBoolean("isInStock")
        } else {
            false
        }

        return Product(
            id = obj.getString("id"),
            categoryId = obj.optString("categoryId", obj.optString("category_id", "")),
            categoryName = obj.optString("categoryName", obj.optString("category_name", "Boutique")),
            categorySlug = obj.optString("categorySlug", obj.optString("category_slug", "boutique")),
            name = obj.getString("name"),
            slug = obj.getString("slug"),
            description = if (obj.isNull("description")) null else obj.getString("description"),
            basePrice = obj.getLong("basePrice"),
            taxRatePct = obj.optDouble("taxRatePct", 5.0),
            isVeg = if (obj.has("isVeg") && !obj.isNull("isVeg")) {
                obj.getBoolean("isVeg")
            } else if (obj.has("is_veg") && !obj.isNull("is_veg")) {
                obj.getBoolean("is_veg")
            } else if (obj.has("foodClassification") && !obj.isNull("foodClassification")) {
                when (obj.getString("foodClassification")) {
                    "vegetarian" -> true
                    "non_vegetarian" -> false
                    else -> null
                }
            } else {
                null
            },
            allergens = allergensList,
            prepTimeMinutes = obj.optInt("prepTimeMinutes", 15),
            imageUrl = if (obj.isNull("imageUrl")) null else obj.getString("imageUrl"),
            isInStock = isInStock
        )
    }

    fun parseCartValidation(jsonString: String): CartValidationResponse {
        val root = JSONObject(jsonString)
        val isValid = root.getBoolean("isValid")
        val itemsArray = root.getJSONArray("items")
        val items = ArrayList<ValidatedLineItem>(itemsArray.length())
        for (i in 0 until itemsArray.length()) {
            val it = itemsArray.getJSONObject(i)
            items.add(
                ValidatedLineItem(
                    productId = it.getString("productId"),
                    title = it.getString("title"),
                    unitPricePaise = it.getLong("unitPricePaise"),
                    requestedQuantity = it.getInt("requestedQuantity"),
                    availableQuantity = it.getInt("availableQuantity"),
                    lineTotalPaise = it.getLong("lineTotalPaise"),
                    isAvailable = it.getBoolean("isAvailable")
                )
            )
        }

        val errorsArray = root.optJSONArray("errors")
        val errors = mutableListOf<String>()
        if (errorsArray != null) {
            for (i in 0 until errorsArray.length()) {
                errors.add(errorsArray.getString(i))
            }
        }

        return CartValidationResponse(
            isValid = isValid,
            items = items,
            subtotalPaise = root.getLong("subtotalPaise"),
            taxPaise = root.getLong("taxPaise"),
            totalPaise = root.getLong("totalPaise"),
            currency = root.optString("currency", "INR"),
            errors = errors
        )
    }

    fun parseCheckoutResponse(jsonString: String): CheckoutResponse {
        val root = JSONObject(jsonString)
        return CheckoutResponse(
            orderId = root.getString("orderId"),
            orderNumber = root.getString("orderNumber"),
            orderStatus = root.getString("orderStatus"),
            paymentStatus = root.getString("paymentStatus"),
            fulfillmentType = root.optString("fulfillmentType", "counter_pickup"),
            totalAmount = root.getLong("totalAmount"),
            currency = root.optString("currency", "INR"),
            expiresAt = if (root.isNull("expiresAt")) null else root.getString("expiresAt"),
            estimatedPickupAt = if (root.isNull("estimatedPickupAt")) null else root.getString("estimatedPickupAt")
        )
    }

    fun parseInitiatePaymentResponse(jsonString: String): InitiatePaymentResponse {
        val root = JSONObject(jsonString)
        return InitiatePaymentResponse(
            orderId = root.getString("orderId"),
            razorpayOrderId = root.getString("razorpayOrderId"),
            amount = root.getLong("amount"),
            currency = root.optString("currency", "INR"),
            keyId = root.getString("keyId"),
            customerName = root.optString("customerName", "Customer"),
            customerPhone = root.optString("customerPhone", "")
        )
    }

    fun parseVerifyPaymentResponse(jsonString: String): VerifyPaymentResponse {
        val root = JSONObject(jsonString)
        return VerifyPaymentResponse(
            success = root.getBoolean("success"),
            orderId = root.getString("orderId"),
            orderNumber = root.getString("orderNumber"),
            orderStatus = root.getString("orderStatus"),
            paymentStatus = root.getString("paymentStatus"),
            paymentId = root.getString("paymentId")
        )
    }

    fun parseProfileResponse(jsonString: String): CustomerProfile {
        val root = JSONObject(jsonString)
        val profile = root.getJSONObject("profile")
        val fullName = if (profile.has("fullName") && !profile.isNull("fullName")) {
            profile.getString("fullName")
        } else if (profile.has("full_name") && !profile.isNull("full_name")) {
            profile.getString("full_name")
        } else {
            null
        }
        val email = if (profile.has("email") && !profile.isNull("email")) {
            profile.getString("email")
        } else {
            null
        }
        val createdAt = if (profile.has("createdAt") && !profile.isNull("createdAt")) {
            profile.getString("createdAt")
        } else if (profile.has("created_at") && !profile.isNull("created_at")) {
            profile.getString("created_at")
        } else {
            null
        }
        return CustomerProfile(
            id = profile.getString("id"),
            phone = profile.getString("phone"),
            fullName = fullName,
            email = email,
            createdAt = createdAt
        )
    }

    fun parseOrdersResponse(jsonString: String): List<Order> {
        val root = JSONObject(jsonString)
        val ordersArray = root.getJSONArray("orders")
        val result = mutableListOf<Order>()
        for (i in 0 until ordersArray.length()) {
            val obj = ordersArray.getJSONObject(i)
            val itemsList = mutableListOf<OrderItem>()
            val itemsArr = obj.optJSONArray("items")
            if (itemsArr != null) {
                for (j in 0 until itemsArr.length()) {
                    val itObj = itemsArr.getJSONObject(j)
                    itemsList.add(
                        OrderItem(
                            id = itObj.optString("id", ""),
                            productId = itObj.optString("productId", ""),
                            productNameSnapshot = itObj.optString("productNameSnapshot", ""),
                            unitPriceSnapshot = itObj.optLong("unitPriceSnapshot", 0L),
                            taxRateSnapshot = itObj.optDouble("taxRateSnapshot", 5.0),
                            quantity = itObj.optInt("quantity", 1),
                            lineTotal = itObj.optLong("lineTotal", 0L)
                        )
                    )
                }
            }
            result.add(
                Order(
                    id = obj.getString("id"),
                    orderNumber = obj.getString("orderNumber"),
                    customerId = obj.getString("customerId"),
                    customerPhone = obj.getString("customerPhone"),
                    customerName = obj.optString("customerName", "Customer"),
                    fulfillmentType = obj.optString("fulfillmentType", "counter_pickup"),
                    scheduledPickupAt = if (obj.isNull("scheduledPickupAt")) null else obj.getString("scheduledPickupAt"),
                    estimatedPickupAt = obj.optString("estimatedPickupAt", ""),
                    orderStatus = obj.getString("orderStatus"),
                    paymentStatus = obj.getString("paymentStatus"),
                    paymentMethod = obj.getString("paymentMethod"),
                    subtotalAmount = obj.getLong("subtotalAmount"),
                    taxAmount = obj.getLong("taxAmount"),
                    packagingAmount = obj.optLong("packagingAmount", 0L),
                    totalAmount = obj.getLong("totalAmount"),
                    specialNotes = if (obj.isNull("specialNotes")) null else obj.getString("specialNotes"),
                    expiresAt = if (obj.isNull("expiresAt")) null else obj.getString("expiresAt"),
                    createdAt = obj.getString("createdAt"),
                    items = itemsList
                )
            )
        }
        return result
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

package com.moodyorange.app.data.cart

import android.content.Context
import android.content.SharedPreferences
import com.moodyorange.app.data.model.CartItem
import com.moodyorange.app.data.model.Product
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import org.json.JSONArray
import org.json.JSONObject

class CartManager(
    private val context: Context
) {
    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val _items = MutableStateFlow<List<CartItem>>(emptyList())
    val items: StateFlow<List<CartItem>> = _items.asStateFlow()

    init {
        loadPersistedCart()
    }

    fun addItem(product: Product, quantity: Int = 1) {
        if (quantity <= 0) return
        val currentList = _items.value.toMutableList()
        val index = currentList.indexOfFirst { it.productId == product.id }
        if (index != -1) {
            val existing = currentList[index]
            val newQty = (existing.quantity + quantity).coerceAtMost(99)
            currentList[index] = existing.copy(quantity = newQty)
        } else {
            currentList.add(CartItem(productId = product.id, product = product, quantity = quantity))
        }
        _items.value = currentList
        persistCart(currentList)
    }

    fun updateQuantity(productId: String, quantity: Int) {
        if (quantity <= 0) {
            removeItem(productId)
            return
        }
        val currentList = _items.value.toMutableList()
        val index = currentList.indexOfFirst { it.productId == productId }
        if (index != -1) {
            val existing = currentList[index]
            currentList[index] = existing.copy(quantity = quantity.coerceAtMost(99))
            _items.value = currentList
            persistCart(currentList)
        }
    }

    fun removeItem(productId: String) {
        val currentList = _items.value.filter { it.productId != productId }
        _items.value = currentList
        persistCart(currentList)
    }

    fun clearCart() {
        _items.value = emptyList()
        prefs.edit().remove(KEY_CART_JSON).apply()
    }

    fun getTotalCount(): Int {
        return _items.value.sumOf { it.quantity }
    }

    fun getSubtotalPaise(): Long {
        return _items.value.sumOf { it.lineTotalPaise }
    }

    private fun persistCart(items: List<CartItem>) {
        try {
            val array = JSONArray()
            for (item in items) {
                val p = item.product
                val pObj = JSONObject().apply {
                    put("id", p.id)
                    put("categoryId", p.categoryId)
                    put("categoryName", p.categoryName)
                    put("categorySlug", p.categorySlug)
                    put("name", p.name)
                    put("slug", p.slug)
                    put("description", p.description ?: JSONObject.NULL)
                    put("basePrice", p.basePrice)
                    put("taxRatePct", p.taxRatePct)
                    put("isVeg", p.isVeg)
                    put("allergens", JSONArray(p.allergens))
                    put("prepTimeMinutes", p.prepTimeMinutes)
                    put("imageUrl", p.imageUrl ?: JSONObject.NULL)
                    put("isInStock", p.isInStock)
                }

                val itemObj = JSONObject().apply {
                    put("productId", item.productId)
                    put("quantity", item.quantity)
                    put("product", pObj)
                }
                array.put(itemObj)
            }
            prefs.edit().putString(KEY_CART_JSON, array.toString()).apply()
        } catch (_: Exception) {
            // Non-critical persistence failure handled gracefully
        }
    }

    private fun loadPersistedCart() {
        val raw = prefs.getString(KEY_CART_JSON, null) ?: return
        try {
            val array = JSONArray(raw)
            val list = mutableListOf<CartItem>()
            for (i in 0 until array.length()) {
                val itemObj = array.getJSONObject(i)
                val pObj = itemObj.getJSONObject("product")

                val allergens = mutableListOf<String>()
                val allergensArr = pObj.optJSONArray("allergens")
                if (allergensArr != null) {
                    for (j in 0 until allergensArr.length()) {
                        allergens.add(allergensArr.getString(j))
                    }
                }

                val product = Product(
                    id = pObj.getString("id"),
                    categoryId = pObj.getString("categoryId"),
                    categoryName = pObj.optString("categoryName", "Boutique"),
                    categorySlug = pObj.optString("categorySlug", "boutique"),
                    name = pObj.getString("name"),
                    slug = pObj.getString("slug"),
                    description = if (pObj.isNull("description")) null else pObj.getString("description"),
                    basePrice = pObj.getLong("basePrice"),
                    taxRatePct = pObj.optDouble("taxRatePct", 5.0),
                    isVeg = pObj.optBoolean("isVeg", true),
                    allergens = allergens,
                    prepTimeMinutes = pObj.optInt("prepTimeMinutes", 15),
                    imageUrl = if (pObj.isNull("imageUrl")) null else pObj.getString("imageUrl"),
                    isInStock = pObj.optBoolean("isInStock", true)
                )

                list.add(
                    CartItem(
                        productId = itemObj.getString("productId"),
                        product = product,
                        quantity = itemObj.getInt("quantity")
                    )
                )
            }
            _items.value = list
        } catch (_: Exception) {
            _items.value = emptyList()
        }
    }

    companion object {
        private const val PREFS_NAME = "moody_orange_cart_prefs"
        private const val KEY_CART_JSON = "cart_items_json"
    }
}


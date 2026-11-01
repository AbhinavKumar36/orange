package com.moodyorange.app.data.model

import com.moodyorange.app.util.CurrencyFormatter

/**
 * Product data model mirroring @orange/api-contracts ProductSchema.
 * All monetary amounts are preserved internally as integer INR paise (Long).
 */
data class Product(
    val id: String,
    val categoryId: String,
    val categoryName: String,
    val categorySlug: String,
    val name: String,
    val slug: String,
    val description: String? = null,
    val basePrice: Long, // Integer INR paise (e.g. 65000 = ₹650.00)
    val taxRatePct: Double = 5.0,
    val isVeg: Boolean = true,
    val allergens: List<String> = emptyList(),
    val prepTimeMinutes: Int = 15,
    val imageUrl: String? = null,
    val isInStock: Boolean = false // Must never default missing availability to true
) {
    val formattedPrice: String
        get() = CurrencyFormatter.formatPaiseToInr(basePrice)
}

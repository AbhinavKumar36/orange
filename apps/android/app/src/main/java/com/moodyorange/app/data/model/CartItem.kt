package com.moodyorange.app.data.model

data class CartItem(
    val productId: String,
    val product: Product,
    val quantity: Int
) {
    val lineTotalPaise: Long
        get() = product.basePrice * quantity
}

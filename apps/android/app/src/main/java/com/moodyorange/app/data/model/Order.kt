package com.moodyorange.app.data.model

data class OrderItem(
    val id: String,
    val productId: String,
    val productNameSnapshot: String,
    val unitPriceSnapshot: Long,
    val taxRateSnapshot: Double,
    val quantity: Int,
    val lineTotal: Long
)

data class Order(
    val id: String,
    val orderNumber: String,
    val customerId: String,
    val customerPhone: String,
    val customerName: String,
    val fulfillmentType: String,
    val scheduledPickupAt: String?,
    val estimatedPickupAt: String,
    val orderStatus: String,
    val paymentStatus: String,
    val paymentMethod: String,
    val subtotalAmount: Long,
    val taxAmount: Long,
    val packagingAmount: Long,
    val totalAmount: Long,
    val specialNotes: String?,
    val expiresAt: String?,
    val createdAt: String,
    val items: List<OrderItem> = emptyList()
)


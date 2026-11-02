package com.moodyorange.app.data.model

data class CheckoutItemPayload(
    val productId: String,
    val quantity: Int
)

data class CheckoutRequest(
    val items: List<CheckoutItemPayload>,
    val fulfillment: String = "counter_pickup",
    val scheduledPickupAt: String? = null,
    val paymentMethod: String = "cash_at_pickup",
    val customerName: String? = null,
    val customerPhone: String? = null,
    val specialNotes: String? = null
)

data class CheckoutResponse(
    val orderId: String,
    val orderNumber: String,
    val orderStatus: String,
    val paymentStatus: String,
    val fulfillmentType: String,
    val totalAmount: Long,
    val currency: String,
    val expiresAt: String?,
    val estimatedPickupAt: String?
)


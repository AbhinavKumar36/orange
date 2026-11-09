package com.moodyorange.app.data.model

data class InitiatePaymentResponse(
    val orderId: String,
    val youpiPaymentId: String = "",
    val razorpayOrderId: String = "",
    val checkoutUrl: String = "",
    val vpa: String = "",
    val qrPayload: String = "",
    val amount: Long,
    val currency: String,
    val keyId: String = "",
    val customerName: String = "",
    val customerPhone: String = ""
)

data class VerifyPaymentResponse(
    val success: Boolean,
    val orderId: String,
    val orderNumber: String,
    val orderStatus: String,
    val paymentStatus: String,
    val paymentId: String
)

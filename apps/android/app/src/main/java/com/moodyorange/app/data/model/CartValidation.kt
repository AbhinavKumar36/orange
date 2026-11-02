package com.moodyorange.app.data.model

data class CartValidationItem(
    val productId: String,
    val quantity: Int
)

data class ValidatedLineItem(
    val productId: String,
    val title: String,
    val unitPricePaise: Long,
    val requestedQuantity: Int,
    val availableQuantity: Int,
    val lineTotalPaise: Long,
    val isAvailable: Boolean
)

data class CartValidationResponse(
    val isValid: Boolean,
    val items: List<ValidatedLineItem>,
    val subtotalPaise: Long,
    val taxPaise: Long,
    val totalPaise: Long,
    val currency: String,
    val errors: List<String>
)


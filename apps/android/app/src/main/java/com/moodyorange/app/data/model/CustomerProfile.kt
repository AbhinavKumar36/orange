package com.moodyorange.app.data.model

data class CustomerProfile(
    val id: String,
    val phone: String,
    val fullName: String?,
    val createdAt: String? = null
)

data class CustomerSession(
    val accessToken: String,
    val customerId: String,
    val phone: String,
    val fullName: String?,
    val expiresAt: Long
)


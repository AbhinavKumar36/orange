package com.moodyorange.app.data.model

/**
 * Category data model mirroring @orange/api-contracts CategorySchema.
 */
data class Category(
    val id: String,
    val name: String,
    val slug: String,
    val description: String? = null,
    val displayOrder: Int = 0
)

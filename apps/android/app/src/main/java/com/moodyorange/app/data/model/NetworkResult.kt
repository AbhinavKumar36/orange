package com.moodyorange.app.data.model

/**
 * Result wrapper for API operations and UI state transitions.
 */
sealed class NetworkResult<out T> {
    data class Success<out T>(val data: T) : NetworkResult<T>()
    data class Error(
        val message: String,
        val statusCode: Int? = null,
        val cause: Throwable? = null
    ) : NetworkResult<Nothing>()
    object Loading : NetworkResult<Nothing>()
}

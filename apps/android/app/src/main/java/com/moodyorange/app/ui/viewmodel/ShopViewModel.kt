package com.moodyorange.app.ui.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.moodyorange.app.data.api.MoodyOrangeApiClient
import com.moodyorange.app.data.auth.AuthManager
import com.moodyorange.app.data.cart.CartManager
import com.moodyorange.app.data.model.CartItem
import com.moodyorange.app.data.model.CartValidationItem
import com.moodyorange.app.data.model.CartValidationResponse
import com.moodyorange.app.data.model.CheckoutItemPayload
import com.moodyorange.app.data.model.CheckoutRequest
import com.moodyorange.app.data.model.CheckoutResponse
import com.moodyorange.app.data.model.CustomerProfile
import com.moodyorange.app.data.model.CustomerSession
import com.moodyorange.app.data.model.InitiatePaymentResponse
import com.moodyorange.app.data.model.Order
import com.moodyorange.app.data.model.Product
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

sealed interface CheckoutUiState {
    object Idle : CheckoutUiState
    object Validating : CheckoutUiState
    object Submitting : CheckoutUiState
    data class AwaitingPayment(val order: CheckoutResponse, val paymentInit: InitiatePaymentResponse) : CheckoutUiState
    object VerifyingPayment : CheckoutUiState
    data class Success(val order: CheckoutResponse) : CheckoutUiState
    data class Error(val message: String) : CheckoutUiState
}

sealed interface ProfileUpdateUiState {
    object Idle : ProfileUpdateUiState
    object Loading : ProfileUpdateUiState
    data class Success(val profile: CustomerProfile) : ProfileUpdateUiState
    data class Error(val message: String) : ProfileUpdateUiState
}

class ShopViewModel(application: Application) : AndroidViewModel(application) {

    val apiClient = MoodyOrangeApiClient()
    val authManager = AuthManager(application.applicationContext, apiClient)
    val cartManager = CartManager(application.applicationContext)
    val themeManager = com.moodyorange.app.data.theme.ThemeManager.getInstance(application.applicationContext)

    val sessionState: StateFlow<CustomerSession?> = authManager.sessionState
    val cartItems: StateFlow<List<CartItem>> = cartManager.items
    val themeMode: StateFlow<com.moodyorange.app.data.theme.ThemeMode> = themeManager.themeMode

    private val _profileUpdateState = MutableStateFlow<ProfileUpdateUiState>(ProfileUpdateUiState.Idle)
    val profileUpdateState: StateFlow<ProfileUpdateUiState> = _profileUpdateState.asStateFlow()

    fun setThemeMode(mode: com.moodyorange.app.data.theme.ThemeMode) {
        themeManager.setThemeMode(mode)
    }

    fun toggleTheme(isCurrentlyDark: Boolean) {
        themeManager.toggleTheme(isCurrentlyDark)
    }

    fun clearProfileUpdateState() {
        _profileUpdateState.value = ProfileUpdateUiState.Idle
    }

    fun updateProfile(fullName: String, email: String?) {
        viewModelScope.launch {
            _profileUpdateState.value = ProfileUpdateUiState.Loading
            val res = authManager.updateProfile(fullName.trim(), email?.trim()?.takeIf { it.isNotBlank() })
            res.onSuccess { profile ->
                _profileUpdateState.value = ProfileUpdateUiState.Success(profile)
            }.onFailure { err ->
                _profileUpdateState.value = ProfileUpdateUiState.Error(
                    err.message ?: "Failed to update profile. Please try again."
                )
            }
        }
    }

    fun refreshProfile() {
        viewModelScope.launch {
            authManager.fetchProfile()
        }
    }

    private val _isCartOpen = MutableStateFlow(false)
    val isCartOpen: StateFlow<Boolean> = _isCartOpen.asStateFlow()

    private val _isAuthOpen = MutableStateFlow(false)
    val isAuthOpen: StateFlow<Boolean> = _isAuthOpen.asStateFlow()

    private val _isCheckoutOpen = MutableStateFlow(false)
    val isCheckoutOpen: StateFlow<Boolean> = _isCheckoutOpen.asStateFlow()

    private val _checkoutState = MutableStateFlow<CheckoutUiState>(CheckoutUiState.Idle)
    val checkoutState: StateFlow<CheckoutUiState> = _checkoutState.asStateFlow()

    private val _cartValidation = MutableStateFlow<CartValidationResponse?>(null)
    val cartValidation: StateFlow<CartValidationResponse?> = _cartValidation.asStateFlow()

    private var currentCheckoutAttemptKey: String? = null

    private val _orders = MutableStateFlow<List<Order>>(emptyList())
    val orders: StateFlow<List<Order>> = _orders.asStateFlow()

    private val _isOrdersLoading = MutableStateFlow(false)
    val isOrdersLoading: StateFlow<Boolean> = _isOrdersLoading.asStateFlow()

    private val _ordersError = MutableStateFlow<String?>(null)
    val ordersError: StateFlow<String?> = _ordersError.asStateFlow()

    fun openCart() { _isCartOpen.value = true }
    fun closeCart() { _isCartOpen.value = false }

    fun openAuth() { _isAuthOpen.value = true }
    fun closeAuth() { _isAuthOpen.value = false }

    fun openCheckout() {
        _isCartOpen.value = false
        _isCheckoutOpen.value = true
        currentCheckoutAttemptKey = null
        validateCurrentCart()
    }
    fun closeCheckout() {
        _isCheckoutOpen.value = false
        _checkoutState.value = CheckoutUiState.Idle
    }

    fun loadOrders() {
        val session = sessionState.value ?: return
        viewModelScope.launch {
            _isOrdersLoading.value = true
            _ordersError.value = null
            val res = apiClient.getOrders(session.accessToken)
            res.onSuccess {
                _orders.value = it
                _isOrdersLoading.value = false
            }.onFailure { err ->
                _ordersError.value = err.message ?: "Failed to load orders"
                _isOrdersLoading.value = false
            }
        }
    }

    fun addToCart(product: Product, quantity: Int = 1) {
        cartManager.addItem(product, quantity)
    }

    fun updateQuantity(productId: String, quantity: Int) {
        cartManager.updateQuantity(productId, quantity)
    }

    fun removeFromCart(productId: String) {
        cartManager.removeItem(productId)
    }

    fun clearCart() {
        cartManager.clearCart()
    }

    fun requestOtp(phone: String, onResult: (Result<Boolean>) -> Unit) {
        viewModelScope.launch {
            val res = authManager.requestOtp(phone)
            onResult(res)
        }
    }

    fun verifyOtp(phone: String, token: String, onResult: (Result<CustomerSession>) -> Unit) {
        viewModelScope.launch {
            val res = authManager.verifyOtp(phone, token)
            onResult(res)
        }
    }

    fun updateCustomerName(name: String, onResult: (Result<CustomerProfile>) -> Unit) {
        viewModelScope.launch {
            val res = authManager.updateFullName(name)
            onResult(res)
        }
    }

    fun logout() {
        authManager.logout()
    }

    fun validateCurrentCart() {
        viewModelScope.launch {
            val items = cartItems.value.map { CartValidationItem(it.productId, it.quantity) }
            if (items.isEmpty()) {
                _cartValidation.value = null
                return@launch
            }
            _checkoutState.value = CheckoutUiState.Validating
            val res = apiClient.validateCart(items)
            res.onSuccess { validation ->
                _cartValidation.value = validation
                _checkoutState.value = CheckoutUiState.Idle
            }.onFailure { err ->
                _checkoutState.value = CheckoutUiState.Error(err.message ?: "Failed to validate cart with store")
            }
        }
    }

    fun submitCheckout(
        fulfillment: String,
        scheduledPickupAt: String?,
        paymentMethod: String,
        specialNotes: String?
    ) {
        val session = sessionState.value
        if (session == null) {
            _isAuthOpen.value = true
            return
        }

        val items = cartItems.value.map { CheckoutItemPayload(it.productId, it.quantity) }
        if (items.isEmpty()) {
            _checkoutState.value = CheckoutUiState.Error("Your shopping bag is empty")
            return
        }

        val idempotencyKey = currentCheckoutAttemptKey ?: UUID.randomUUID().toString().also {
            currentCheckoutAttemptKey = it
        }

        val req = CheckoutRequest(
            items = items,
            fulfillment = fulfillment,
            scheduledPickupAt = scheduledPickupAt,
            paymentMethod = paymentMethod,
            customerName = session.fullName ?: "Boutique Guest",
            customerPhone = session.phone,
            specialNotes = specialNotes
        )

        viewModelScope.launch {
            _checkoutState.value = CheckoutUiState.Submitting
            val res = apiClient.checkout(req, session.accessToken, idempotencyKey)
            res.onSuccess { order ->
                currentCheckoutAttemptKey = null
                if (paymentMethod == "online_razorpay") {
                    val initRes = apiClient.initiatePayment(order.orderId, session.accessToken)
                    initRes.onSuccess { initData ->
                        _checkoutState.value = CheckoutUiState.AwaitingPayment(order, initData)
                    }.onFailure { pErr ->
                        _checkoutState.value = CheckoutUiState.Error("Stock reserved, but failed to launch payment: ${pErr.message}")
                    }
                } else {
                    _checkoutState.value = CheckoutUiState.Success(order)
                    cartManager.clearCart()
                }
            }.onFailure { err ->
                _checkoutState.value = CheckoutUiState.Error(err.message ?: "Checkout failed. Please try again.")
            }
        }
    }

    fun verifyOnlinePayment(
        order: CheckoutResponse,
        razorpayOrderId: String,
        razorpayPaymentId: String,
        razorpaySignature: String
    ) {
        val session = sessionState.value ?: return
        viewModelScope.launch {
            _checkoutState.value = CheckoutUiState.VerifyingPayment
            val res = apiClient.verifyPayment(
                orderId = order.orderId,
                razorpayOrderId = razorpayOrderId,
                razorpayPaymentId = razorpayPaymentId,
                razorpaySignature = razorpaySignature,
                token = session.accessToken
            )
            res.onSuccess { verifyData ->
                cartManager.clearCart()
                _checkoutState.value = CheckoutUiState.Success(
                    order.copy(
                        orderStatus = verifyData.orderStatus,
                        paymentStatus = verifyData.paymentStatus
                    )
                )
            }.onFailure { err ->
                _checkoutState.value = CheckoutUiState.Error("Payment verification failed on server: ${err.message}")
            }
        }
    }

    fun retryOnlinePayment(order: CheckoutResponse) {
        val session = sessionState.value ?: return
        viewModelScope.launch {
            _checkoutState.value = CheckoutUiState.Submitting
            val initRes = apiClient.initiatePayment(order.orderId, session.accessToken)
            initRes.onSuccess { initData ->
                _checkoutState.value = CheckoutUiState.AwaitingPayment(order, initData)
            }.onFailure { pErr ->
                _checkoutState.value = CheckoutUiState.Error("Failed to initiate payment retry: ${pErr.message}")
            }
        }
    }
}


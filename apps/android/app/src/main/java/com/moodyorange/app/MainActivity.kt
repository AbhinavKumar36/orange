package com.moodyorange.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.moodyorange.app.ui.components.AccountDialog
import com.moodyorange.app.ui.components.AuthDialog
import com.moodyorange.app.ui.components.CartBottomSheet
import com.moodyorange.app.ui.components.CheckoutBottomSheet
import com.moodyorange.app.ui.components.OrderConfirmationDialog
import com.moodyorange.app.ui.screens.HomeScreen
import com.moodyorange.app.ui.screens.ProductDetailScreen
import com.moodyorange.app.ui.theme.CreamBackground
import com.moodyorange.app.ui.theme.MoodyOrangeTheme
import com.moodyorange.app.ui.viewmodel.CatalogViewModel
import com.moodyorange.app.ui.viewmodel.CheckoutUiState
import com.moodyorange.app.ui.viewmodel.ShopViewModel

sealed class AppDestination {
    object Home : AppDestination()
    data class ProductDetail(val productIdOrSlug: String) : AppDestination()
}

class MainActivity : ComponentActivity() {

    private val catalogViewModel: CatalogViewModel by viewModels()
    private val shopViewModel: ShopViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MoodyOrangeTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = CreamBackground
                ) {
                    MoodyOrangeApp(
                        catalogViewModel = catalogViewModel,
                        shopViewModel = shopViewModel
                    )
                }
            }
        }
    }
}

@Composable
fun MoodyOrangeApp(
    catalogViewModel: CatalogViewModel,
    shopViewModel: ShopViewModel
) {
    var currentDestination by remember { mutableStateOf<AppDestination>(AppDestination.Home) }
    var isAccountDialogOpen by remember { mutableStateOf(false) }

    val cartItems by shopViewModel.cartItems.collectAsState()
    val session by shopViewModel.sessionState.collectAsState()
    val isCartOpen by shopViewModel.isCartOpen.collectAsState()
    val isAuthOpen by shopViewModel.isAuthOpen.collectAsState()
    val isCheckoutOpen by shopViewModel.isCheckoutOpen.collectAsState()
    val checkoutState by shopViewModel.checkoutState.collectAsState()
    val orders by shopViewModel.orders.collectAsState()
    val isOrdersLoading by shopViewModel.isOrdersLoading.collectAsState()

    val totalItemCount = cartItems.sumOf { it.quantity }

    when (val dest = currentDestination) {
        is AppDestination.Home -> {
            HomeScreen(
                viewModel = catalogViewModel,
                cartItemCount = totalItemCount,
                onCartClick = { shopViewModel.openCart() },
                isLoggedIn = session != null,
                customerName = session?.fullName,
                onProfileClick = {
                    if (session != null) {
                        shopViewModel.loadOrders()
                        isAccountDialogOpen = true
                    } else {
                        shopViewModel.openAuth()
                    }
                },
                onProductClick = { product ->
                    currentDestination = AppDestination.ProductDetail(product.id)
                }
            )
        }
        is AppDestination.ProductDetail -> {
            BackHandler {
                catalogViewModel.clearProductDetail()
                currentDestination = AppDestination.Home
            }
            ProductDetailScreen(
                productIdOrSlug = dest.productIdOrSlug,
                viewModel = catalogViewModel,
                onBackClick = {
                    catalogViewModel.clearProductDetail()
                    currentDestination = AppDestination.Home
                },
                onAddToCart = { product ->
                    shopViewModel.addToCart(product)
                    shopViewModel.openCart()
                }
            )
        }
    }

    // Modal Overlays & Bottom Sheets
    if (isCartOpen) {
        CartBottomSheet(
            shopViewModel = shopViewModel,
            onDismiss = { shopViewModel.closeCart() }
        )
    }

    if (isAuthOpen) {
        AuthDialog(
            shopViewModel = shopViewModel,
            onDismiss = { shopViewModel.closeAuth() }
        )
    }

    if (isCheckoutOpen) {
        CheckoutBottomSheet(
            shopViewModel = shopViewModel,
            onDismiss = { shopViewModel.closeCheckout() }
        )
    }

    if (isAccountDialogOpen && session != null) {
        AccountDialog(
            session = session!!,
            orders = orders,
            isLoadingOrders = isOrdersLoading,
            onRefreshOrders = { shopViewModel.loadOrders() },
            onLogout = { shopViewModel.logout() },
            onDismiss = { isAccountDialogOpen = false }
        )
    }

    if (checkoutState is CheckoutUiState.Success) {
        OrderConfirmationDialog(
            order = (checkoutState as CheckoutUiState.Success).order,
            onDismiss = { shopViewModel.closeCheckout() }
        )
    }
}

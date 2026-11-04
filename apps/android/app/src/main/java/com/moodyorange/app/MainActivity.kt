package com.moodyorange.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.moodyorange.app.ui.components.AuthDialog
import com.moodyorange.app.ui.components.BottomNavBar
import com.moodyorange.app.ui.components.CartBottomSheet
import com.moodyorange.app.ui.components.CheckoutBottomSheet
import com.moodyorange.app.ui.components.NavTab
import com.moodyorange.app.ui.components.OrderConfirmationDialog
import com.moodyorange.app.ui.screens.AccountScreen
import com.moodyorange.app.ui.screens.HomeScreen
import com.moodyorange.app.ui.screens.OrdersScreen
import com.moodyorange.app.ui.screens.ProductDetailScreen
import com.moodyorange.app.ui.screens.ShopScreen
import com.moodyorange.app.ui.theme.DarkBackground
import com.moodyorange.app.ui.theme.MoodyOrangeTheme
import com.moodyorange.app.ui.viewmodel.CatalogViewModel
import com.moodyorange.app.ui.viewmodel.CheckoutUiState
import com.moodyorange.app.ui.viewmodel.ShopViewModel

sealed class AppDestination {
    object Main : AppDestination()
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
                    color = DarkBackground
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
    var currentDestination by remember { mutableStateOf<AppDestination>(AppDestination.Main) }
    var selectedTab by remember { mutableStateOf(NavTab.HOME) }

    val cartItems by shopViewModel.cartItems.collectAsState()
    val session by shopViewModel.sessionState.collectAsState()
    val isCartOpen by shopViewModel.isCartOpen.collectAsState()
    val isAuthOpen by shopViewModel.isAuthOpen.collectAsState()
    val isCheckoutOpen by shopViewModel.isCheckoutOpen.collectAsState()
    val checkoutState by shopViewModel.checkoutState.collectAsState()

    val totalItemCount = cartItems.sumOf { it.quantity }

    when (val dest = currentDestination) {
        is AppDestination.ProductDetail -> {
            BackHandler {
                catalogViewModel.clearProductDetail()
                currentDestination = AppDestination.Main
            }
            ProductDetailScreen(
                productIdOrSlug = dest.productIdOrSlug,
                viewModel = catalogViewModel,
                onBackClick = {
                    catalogViewModel.clearProductDetail()
                    currentDestination = AppDestination.Main
                },
                onAddToCart = { product, quantity ->
                    shopViewModel.addToCart(product, quantity)
                    shopViewModel.openCart()
                },
                onProductClick = { rel ->
                    catalogViewModel.clearProductDetail()
                    currentDestination = AppDestination.ProductDetail(rel.id)
                }
            )
        }

        is AppDestination.Main -> {
            Scaffold(
                bottomBar = {
                    BottomNavBar(
                        selectedTab = selectedTab,
                        onTabSelected = { selectedTab = it }
                    )
                }
            ) { innerPadding ->
                Box(modifier = Modifier.padding(innerPadding)) {
                    when (selectedTab) {
                        NavTab.HOME -> {
                            HomeScreen(
                                viewModel = catalogViewModel,
                                cartItemCount = totalItemCount,
                                onCartClick = { shopViewModel.openCart() },
                                isLoggedIn = session != null,
                                customerName = session?.fullName,
                                onProfileClick = {
                                    if (session != null) {
                                        selectedTab = NavTab.ACCOUNT
                                    } else {
                                        shopViewModel.openAuth()
                                    }
                                },
                                onProductClick = { product ->
                                    currentDestination = AppDestination.ProductDetail(product.id)
                                },
                                onQuickAdd = { product ->
                                    shopViewModel.addToCart(product)
                                },
                                onNavigateToShop = { category ->
                                    if (category != null) {
                                        catalogViewModel.selectCategory(category)
                                    }
                                    selectedTab = NavTab.SHOP
                                }
                            )
                        }

                        NavTab.SHOP -> {
                            ShopScreen(
                                viewModel = catalogViewModel,
                                cartItemCount = totalItemCount,
                                onCartClick = { shopViewModel.openCart() },
                                isLoggedIn = session != null,
                                customerName = session?.fullName,
                                onProfileClick = {
                                    if (session != null) {
                                        selectedTab = NavTab.ACCOUNT
                                    } else {
                                        shopViewModel.openAuth()
                                    }
                                },
                                onProductClick = { product ->
                                    currentDestination = AppDestination.ProductDetail(product.id)
                                },
                                onQuickAdd = { product ->
                                    shopViewModel.addToCart(product)
                                }
                            )
                        }

                        NavTab.ORDERS -> {
                            OrdersScreen(
                                shopViewModel = shopViewModel,
                                cartItemCount = totalItemCount,
                                onCartClick = { shopViewModel.openCart() },
                                onProfileClick = {
                                    if (session != null) {
                                        selectedTab = NavTab.ACCOUNT
                                    } else {
                                        shopViewModel.openAuth()
                                    }
                                },
                                onNavigateToShop = {
                                    selectedTab = NavTab.SHOP
                                }
                            )
                        }

                        NavTab.ACCOUNT -> {
                            AccountScreen(
                                shopViewModel = shopViewModel,
                                cartItemCount = totalItemCount,
                                onCartClick = { shopViewModel.openCart() }
                            )
                        }
                    }
                }
            }
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

    if (checkoutState is CheckoutUiState.Success) {
        OrderConfirmationDialog(
            order = (checkoutState as CheckoutUiState.Success).order,
            onDismiss = { shopViewModel.closeCheckout() }
        )
    }
}

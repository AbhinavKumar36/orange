package com.moodyorange.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.moodyorange.app.ui.screens.HomeScreen
import com.moodyorange.app.ui.screens.ProductDetailScreen
import com.moodyorange.app.ui.theme.CreamBackground
import com.moodyorange.app.ui.theme.MoodyOrangeTheme
import com.moodyorange.app.ui.viewmodel.CatalogViewModel

sealed class AppDestination {
    object Home : AppDestination()
    data class ProductDetail(val productIdOrSlug: String) : AppDestination()
}

class MainActivity : ComponentActivity() {

    private val catalogViewModel: CatalogViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MoodyOrangeTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = CreamBackground
                ) {
                    MoodyOrangeApp(viewModel = catalogViewModel)
                }
            }
        }
    }
}

@Composable
fun MoodyOrangeApp(
    viewModel: CatalogViewModel
) {
    var currentDestination by remember { mutableStateOf<AppDestination>(AppDestination.Home) }

    when (val dest = currentDestination) {
        is AppDestination.Home -> {
            HomeScreen(
                viewModel = viewModel,
                onProductClick = { product ->
                    currentDestination = AppDestination.ProductDetail(product.id)
                }
            )
        }
        is AppDestination.ProductDetail -> {
            BackHandler {
                viewModel.clearProductDetail()
                currentDestination = AppDestination.Home
            }
            ProductDetailScreen(
                productIdOrSlug = dest.productIdOrSlug,
                viewModel = viewModel,
                onBackClick = {
                    viewModel.clearProductDetail()
                    currentDestination = AppDestination.Home
                }
            )
        }
    }
}

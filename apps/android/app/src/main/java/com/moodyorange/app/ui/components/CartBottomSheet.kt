package com.moodyorange.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.data.model.CartItem
import com.moodyorange.app.ui.theme.EditorialSerif
import com.moodyorange.app.ui.theme.MangalaTheme
import com.moodyorange.app.ui.theme.WhiteSurface
import com.moodyorange.app.ui.viewmodel.ShopViewModel
import com.moodyorange.app.util.CurrencyFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CartBottomSheet(
    shopViewModel: ShopViewModel,
    onDismiss: () -> Unit
) {
    val colors = MangalaTheme.colors
    val isDark = colors.isDark
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val cartItems by shopViewModel.cartItems.collectAsState()
    val session by shopViewModel.sessionState.collectAsState()

    val subtotalPaise = cartItems.sumOf { it.lineTotalPaise }
    val totalItems = cartItems.sumOf { it.quantity }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = colors.surface,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.85f)
                .padding(horizontal = 16.dp, vertical = 8.dp)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "Shopping Bag",
                        fontFamily = EditorialSerif,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.textPrimary
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Box(
                        modifier = Modifier
                            .clip(CircleShape)
                            .background(colors.primaryContainer)
                            .padding(horizontal = 8.dp, vertical = 2.5.dp)
                    ) {
                        Text(
                            text = "$totalItems items",
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = colors.primary
                        )
                    }
                }

                if (cartItems.isNotEmpty()) {
                    TextButton(onClick = { shopViewModel.clearCart() }) {
                        Text("Clear All", color = colors.outOfStockRed, fontSize = 11.5.sp)
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            if (cartItems.isEmpty()) {
                // Empty state
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Box(
                        modifier = Modifier
                            .size(56.dp)
                            .clip(CircleShape)
                            .background(colors.surfaceElevated),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "🛍️", fontSize = 24.sp)
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "Your Bag is Empty",
                        fontFamily = EditorialSerif,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.textPrimary
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "Browse our handcrafted delicacies and cold extracts for pickup.",
                        fontSize = 12.5.sp,
                        color = colors.textSecondary,
                        modifier = Modifier.padding(horizontal = 24.dp),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Button(
                        onClick = onDismiss,
                        colors = ButtonDefaults.buttonColors(
                            containerColor = colors.primary,
                            contentColor = if (isDark) colors.canvas else WhiteSurface
                        ),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Text("Explore Boutique Menu", fontWeight = FontWeight.Bold, fontSize = 13.5.sp)
                    }
                }
            } else {
                // Cart items list
                LazyColumn(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentPadding = PaddingValues(vertical = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(cartItems, key = { it.productId }) { item ->
                        CartItemRow(
                            item = item,
                            onIncrement = { shopViewModel.updateQuantity(item.productId, item.quantity + 1) },
                            onDecrement = { shopViewModel.updateQuantity(item.productId, item.quantity - 1) },
                            onRemove = { shopViewModel.removeFromCart(item.productId) }
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Bottom Subtotal & Checkout Action
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(colors.surfaceElevated)
                        .border(0.5.dp, colors.border, RoundedCornerShape(14.dp))
                        .padding(14.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Estimated Subtotal",
                            fontSize = 13.sp,
                            color = colors.textSecondary
                        )
                        Text(
                            text = CurrencyFormatter.formatPaiseToInr(subtotalPaise),
                            fontFamily = EditorialSerif,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = colors.textPrimary
                        )
                    }

                    Spacer(modifier = Modifier.height(3.dp))
                    Text(
                        text = "Counter pickup in ~15 mins. Taxes calculated at checkout.",
                        fontSize = 10.5.sp,
                        color = colors.textMuted
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Button(
                        onClick = {
                            if (session == null) {
                                onDismiss()
                                shopViewModel.openAuth()
                            } else {
                                shopViewModel.openCheckout()
                            }
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = colors.primary,
                            contentColor = if (isDark) colors.canvas else WhiteSurface
                        ),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(46.dp)
                    ) {
                        Text(
                            text = if (session == null) "Sign In to Checkout" else "Proceed to Counter Pickup",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))
            }
        }
    }
}

@Composable
fun CartItemRow(
    item: CartItem,
    onIncrement: () -> Unit,
    onDecrement: () -> Unit,
    onRemove: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(colors.surface)
            .border(0.5.dp, colors.border, RoundedCornerShape(12.dp))
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Thumbnail Image
        Box(
            modifier = Modifier
                .size(54.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(colors.surfaceElevated)
        ) {
            ProductImage(
                imageUrl = item.product.imageUrl,
                categorySlug = item.product.categorySlug,
                contentDescription = item.product.name,
                modifier = Modifier.size(54.dp)
            )
        }

        Spacer(modifier = Modifier.width(10.dp))

        // Product details & dietary classification
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                FoodClassificationIndicator(
                    isVeg = item.product.isVeg,
                    size = 14.dp
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = item.product.name,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = colors.textPrimary,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }

            Spacer(modifier = Modifier.height(2.dp))

            Text(
                text = CurrencyFormatter.formatPaiseToInr(item.product.basePrice),
                fontFamily = EditorialSerif,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = colors.primary
            )
        }

        // Stepper: [-] [qty] [+]
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .clip(RoundedCornerShape(6.dp))
                .border(0.5.dp, colors.border, RoundedCornerShape(6.dp))
                .background(colors.surfaceElevated)
                .padding(horizontal = 4.dp, vertical = 2.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(26.dp)
                    .clickable { onDecrement() },
                contentAlignment = Alignment.Center
            ) {
                Text(text = "−", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = colors.textPrimary)
            }

            Text(
                text = "${item.quantity}",
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = colors.textPrimary,
                modifier = Modifier.padding(horizontal = 6.dp)
            )

            Box(
                modifier = Modifier
                    .size(26.dp)
                    .clickable { onIncrement() },
                contentAlignment = Alignment.Center
            ) {
                Text(text = "+", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = colors.textPrimary)
            }
        }
    }
}

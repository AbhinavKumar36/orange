package com.moodyorange.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.data.model.Order
import com.moodyorange.app.ui.components.HeaderBar
import com.moodyorange.app.ui.theme.EditorialSerif
import com.moodyorange.app.ui.theme.MangalaTheme
import com.moodyorange.app.ui.theme.WhiteSurface
import com.moodyorange.app.ui.viewmodel.ShopViewModel
import com.moodyorange.app.util.CurrencyFormatter
import java.util.Locale

@Composable
fun OrdersScreen(
    shopViewModel: ShopViewModel,
    cartItemCount: Int = 0,
    onCartClick: () -> Unit = {},
    onProfileClick: () -> Unit = {},
    onThemeToggle: (() -> Unit)? = null,
    onNavigateToShop: () -> Unit = {},
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors
    val isDark = colors.isDark
    val session by shopViewModel.sessionState.collectAsState()
    val orders by shopViewModel.orders.collectAsState()
    val isLoading by shopViewModel.isOrdersLoading.collectAsState()
    val error by shopViewModel.ordersError.collectAsState()

    LaunchedEffect(session) {
        if (session != null) {
            shopViewModel.loadOrders()
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.canvas)
    ) {
        HeaderBar(
            cartItemCount = cartItemCount,
            onCartClick = onCartClick,
            isLoggedIn = session != null,
            customerName = session?.fullName,
            onProfileClick = onProfileClick,
            onThemeToggle = onThemeToggle,
            isDark = isDark
        )

        // Title and Refresh Row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "ORDER HISTORY",
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.primary,
                    letterSpacing = 1.sp
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "Counter Reservations",
                    fontFamily = EditorialSerif,
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.textPrimary
                )
            }

            if (session != null) {
                TextButton(onClick = { shopViewModel.loadOrders() }) {
                    Text(
                        text = "Refresh ↺",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = colors.primary
                    )
                }
            }
        }

        if (session == null) {
            // Not Signed In Prompt
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
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
                    Text(text = "📦", fontSize = 24.sp)
                }

                Spacer(modifier = Modifier.height(14.dp))

                Text(
                    text = "Track Your Counter Pickups",
                    fontFamily = EditorialSerif,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.textPrimary,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = "Sign in with your mobile number to view live order preparation status and pickup references.",
                    fontSize = 12.5.sp,
                    lineHeight = 18.sp,
                    color = colors.textSecondary,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(18.dp))

                Button(
                    onClick = { shopViewModel.openAuth() },
                    colors = ButtonDefaults.buttonColors(
                        containerColor = colors.primary,
                        contentColor = if (isDark) colors.canvas else WhiteSurface
                    ),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text("Sign In with Mobile OTP", fontWeight = FontWeight.Bold, fontSize = 13.5.sp)
                }
            }
        } else if (isLoading) {
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = colors.primary, modifier = Modifier.size(34.dp), strokeWidth = 2.5.dp)
            }
        } else if (orders.isEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(32.dp),
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

                Spacer(modifier = Modifier.height(14.dp))

                Text(
                    text = "No Orders Placed Yet",
                    fontFamily = EditorialSerif,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.textPrimary
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = "Your counter pickup reservations and receipts will appear here.",
                    fontSize = 12.5.sp,
                    color = colors.textSecondary,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(18.dp))

                Button(
                    onClick = onNavigateToShop,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = colors.primary,
                        contentColor = if (isDark) colors.canvas else WhiteSurface
                    ),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text("Browse Boutique Menu", fontWeight = FontWeight.Bold, fontSize = 13.5.sp)
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(orders, key = { it.id }) { order ->
                    OrderCard(order)
                }
            }
        }
    }
}

@Composable
private fun OrderCard(order: Order) {
    val colors = MangalaTheme.colors
    val isConfirmed = order.orderStatus.equals("confirmed", ignoreCase = true)
    val isCompleted = order.orderStatus.equals("completed", ignoreCase = true)
    val statusBg = if (isConfirmed || isCompleted) colors.inStockBg else colors.outOfStockBg
    val statusColor = if (isConfirmed || isCompleted) colors.inStockGreen else colors.outOfStockRed

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(colors.surface)
            .border(0.5.dp, colors.border, RoundedCornerShape(14.dp))
            .padding(14.dp)
    ) {
        // Order Number & Status Badge
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(CircleShape)
                        .background(colors.surfaceElevated),
                    contentAlignment = Alignment.Center
                ) {
                    Text(text = "📦", fontSize = 14.sp)
                }
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(
                        text = "Order #${order.orderNumber}",
                        fontSize = 13.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.textPrimary
                    )
                    Text(
                        text = "Counter Pickup",
                        fontSize = 10.5.sp,
                        color = colors.textMuted
                    )
                }
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(5.dp))
                    .background(statusBg)
                    .padding(horizontal = 7.dp, vertical = 3.dp)
            ) {
                Text(
                    text = order.orderStatus.replace('_', ' ').uppercase(Locale.ROOT),
                    fontSize = 9.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = statusColor
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Items list snapshot
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            order.items.forEach { item ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "${item.quantity}× ${item.productNameSnapshot}",
                        fontSize = 12.5.sp,
                        color = colors.textSecondary
                    )
                    Text(
                        text = CurrencyFormatter.formatPaiseToInr(item.lineTotal),
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.Medium,
                        color = colors.textPrimary
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(0.5.dp)
                .background(colors.border)
        )

        Spacer(modifier = Modifier.height(10.dp))

        // Order Total & Payment status
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "Payment: ${order.paymentStatus.replace('_', ' ').uppercase()}",
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = colors.textMuted
                )
            }

            Text(
                text = CurrencyFormatter.formatPaiseToInr(order.totalAmount),
                fontFamily = EditorialSerif,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = colors.primary
            )
        }
    }
}

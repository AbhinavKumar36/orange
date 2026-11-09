package com.moodyorange.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.ui.theme.EditorialSerif
import com.moodyorange.app.ui.theme.MangalaTheme
import com.moodyorange.app.ui.viewmodel.CheckoutUiState
import com.moodyorange.app.ui.viewmodel.ShopViewModel
import com.moodyorange.app.util.CurrencyFormatter
import java.time.Instant
import java.time.temporal.ChronoUnit

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CheckoutBottomSheet(
    shopViewModel: ShopViewModel,
    onDismiss: () -> Unit
) {
    val colors = MangalaTheme.colors
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val session by shopViewModel.sessionState.collectAsState()
    val validation by shopViewModel.cartValidation.collectAsState()
    val checkoutState by shopViewModel.checkoutState.collectAsState()

    var isScheduled by remember { mutableStateOf(false) }
    var paymentMethod by remember { mutableStateOf("cash_at_pickup") } // "cash_at_pickup" or "online_razorpay"

    val scrollState = rememberScrollState()

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = colors.surface,
        shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.9f)
                .padding(horizontal = 20.dp, vertical = 10.dp)
                .verticalScroll(scrollState)
        ) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "Counter Pickup",
                    fontFamily = EditorialSerif,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.textPrimary
                )
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(colors.primaryContainer)
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "MANGALA ENTERPRISES",
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.8.sp,
                        color = if (colors.isDark) colors.gold else colors.primary
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Pickup Timing Selector
            Text(
                text = "Pickup Option",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.5.sp,
                color = colors.textSecondary
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .border(
                            1.5.dp,
                            if (!isScheduled) colors.primary else colors.border,
                            RoundedCornerShape(12.dp)
                        )
                        .background(if (!isScheduled) colors.primaryContainer else colors.canvas)
                        .clickable { isScheduled = false }
                        .padding(14.dp)
                ) {
                    Column {
                        Text(
                            text = "⚡ Immediate",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (!isScheduled) (if (colors.isDark) colors.gold else colors.primary) else colors.textPrimary
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "Ready in ~15-20m",
                            fontSize = 11.sp,
                            color = colors.textSecondary
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .border(
                            1.5.dp,
                            if (isScheduled) colors.primary else colors.border,
                            RoundedCornerShape(12.dp)
                        )
                        .background(if (isScheduled) colors.primaryContainer else colors.canvas)
                        .clickable { isScheduled = true }
                        .padding(14.dp)
                ) {
                    Column {
                        Text(
                            text = "🕒 Later Today",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isScheduled) (if (colors.isDark) colors.gold else colors.primary) else colors.textPrimary
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "In 2 hours",
                            fontSize = 11.sp,
                            color = colors.textSecondary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Customer Contact Info Box
            Text(
                text = "Customer Information",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.5.sp,
                color = colors.textSecondary
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(colors.canvas)
                    .border(1.dp, colors.border, RoundedCornerShape(12.dp))
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(colors.inStockBg),
                    contentAlignment = Alignment.Center
                ) {
                    Text(text = "✓", color = colors.inStockGreen, fontWeight = FontWeight.Bold)
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = session?.fullName ?: "Guest Customer",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.textPrimary
                    )
                    Text(
                        text = session?.phone ?: "",
                        fontSize = 12.sp,
                        color = colors.textSecondary
                    )
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Payment Method Selector
            Text(
                text = "Payment Method",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 0.5.sp,
                color = colors.textSecondary
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .border(
                            1.5.dp,
                            if (paymentMethod == "cash_at_pickup") colors.primary else colors.border,
                            RoundedCornerShape(12.dp)
                        )
                        .background(if (paymentMethod == "cash_at_pickup") colors.primaryContainer else colors.canvas)
                        .clickable { paymentMethod = "cash_at_pickup" }
                        .padding(14.dp)
                ) {
                    Column {
                        Text(
                            text = "💵 Pay at Counter",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (paymentMethod == "cash_at_pickup") (if (colors.isDark) colors.gold else colors.primary) else colors.textPrimary
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "Cash / Card at counter",
                            fontSize = 11.sp,
                            color = colors.textSecondary
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .border(
                            1.5.dp,
                            if (paymentMethod == "online_razorpay") colors.primary else colors.border,
                            RoundedCornerShape(12.dp)
                        )
                        .background(if (paymentMethod == "online_razorpay") colors.primaryContainer else colors.canvas)
                        .clickable { paymentMethod = "online_razorpay" }
                        .padding(14.dp)
                ) {
                    Column {
                        Text(
                            text = "💳 Online Checkout",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (paymentMethod == "online_razorpay") (if (colors.isDark) colors.gold else colors.primary) else colors.textPrimary
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "10-min reservation",
                            fontSize = 11.sp,
                            color = colors.textSecondary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Price Breakdown
            val valRes = validation
            if (valRes != null) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(colors.canvas)
                        .border(1.dp, colors.border, RoundedCornerShape(14.dp))
                        .padding(16.dp)
                ) {
                    Text(
                        text = "Order Summary",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.textPrimary
                    )
                    Spacer(modifier = Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Subtotal", fontSize = 13.sp, color = colors.textSecondary)
                        Text(CurrencyFormatter.formatPaiseToInr(valRes.subtotalPaise), fontSize = 13.sp, color = colors.textPrimary)
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("GST (5%)", fontSize = 13.sp, color = colors.textSecondary)
                        Text(CurrencyFormatter.formatPaiseToInr(valRes.taxPaise), fontSize = 13.sp, color = colors.textPrimary)
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(colors.divider)
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Total to Pay", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = colors.textPrimary)
                        Text(
                            CurrencyFormatter.formatPaiseToInr(valRes.totalPaise),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (colors.isDark) colors.gold else colors.primary
                        )
                    }
                }
            }

            // Error banner if checkout failed or items invalid
            if (valRes?.errors?.isNotEmpty() == true) {
                Spacer(modifier = Modifier.height(14.dp))
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(colors.outOfStockBg)
                        .padding(12.dp)
                ) {
                    valRes.errors.forEach { err ->
                        Text(text = "• $err", fontSize = 12.sp, color = colors.outOfStockRed)
                    }
                }
            }

            if (checkoutState is CheckoutUiState.Error) {
                Spacer(modifier = Modifier.height(14.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(colors.outOfStockBg)
                        .padding(12.dp)
                ) {
                    Text(
                        text = (checkoutState as CheckoutUiState.Error).message,
                        fontSize = 12.sp,
                        color = colors.outOfStockRed
                    )
                }
            }

            if (checkoutState is CheckoutUiState.AwaitingPayment) {
                val state = checkoutState as CheckoutUiState.AwaitingPayment
                Spacer(modifier = Modifier.height(14.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(colors.surfaceElevated)
                        .border(1.dp, colors.gold, RoundedCornerShape(12.dp))
                        .padding(14.dp)
                ) {
                    Column {
                        Text(
                            text = "Payment Required: Order #${state.order.orderNumber}",
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp,
                            color = if (colors.isDark) colors.gold else colors.primary
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "Payable Amount: ${CurrencyFormatter.formatPaiseToInr(state.paymentInit.amount)}",
                            fontSize = 13.sp,
                            color = colors.textSecondary
                        )
                        Spacer(modifier = Modifier.height(10.dp))
                        Button(
                            onClick = {
                                shopViewModel.verifyOnlinePayment(
                                    order = state.order,
                                    razorpayOrderId = state.paymentInit.razorpayOrderId,
                                    razorpayPaymentId = "pay_mock_${System.currentTimeMillis()}",
                                    razorpaySignature = "mock_sig_${state.paymentInit.razorpayOrderId}"
                                )
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = colors.primary,
                                contentColor = colors.onPrimary
                            ),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.fillMaxWidth().height(44.dp)
                        ) {
                            Text("Pay Now with UPI (YouPI-PG) →", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Action Button
            val isSubmitting = checkoutState is CheckoutUiState.Submitting || checkoutState is CheckoutUiState.Validating || checkoutState is CheckoutUiState.VerifyingPayment
            val canSubmit = valRes?.isValid == true && !isSubmitting && checkoutState !is CheckoutUiState.AwaitingPayment

            Button(
                onClick = {
                    val scheduledTime = if (isScheduled) {
                        Instant.now().plus(2, ChronoUnit.HOURS).toString()
                    } else null

                    shopViewModel.submitCheckout(
                        fulfillment = "counter_pickup",
                        scheduledPickupAt = scheduledTime,
                        paymentMethod = paymentMethod,
                        specialNotes = null
                    )
                },
                enabled = canSubmit,
                colors = ButtonDefaults.buttonColors(
                    containerColor = colors.primary,
                    contentColor = colors.onPrimary,
                    disabledContainerColor = colors.primary.copy(alpha = 0.4f),
                    disabledContentColor = colors.onPrimary.copy(alpha = 0.6f)
                ),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(color = colors.onPrimary, modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                } else {
                    Text("Confirm & Reserve Order", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}

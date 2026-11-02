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
import com.moodyorange.app.ui.theme.BorderMuted
import com.moodyorange.app.ui.theme.CardBackground
import com.moodyorange.app.ui.theme.CreamBackground
import com.moodyorange.app.ui.theme.InStockBg
import com.moodyorange.app.ui.theme.InStockGreen
import com.moodyorange.app.ui.theme.OrangeLight
import com.moodyorange.app.ui.theme.OrangePrimary
import com.moodyorange.app.ui.theme.OutOfStockBg
import com.moodyorange.app.ui.theme.OutOfStockRed
import com.moodyorange.app.ui.theme.TextMuted
import com.moodyorange.app.ui.theme.TextPrimary
import com.moodyorange.app.ui.theme.TextSecondary
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
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val session by shopViewModel.sessionState.collectAsState()
    val validation by shopViewModel.cartValidation.collectAsState()
    val checkoutState by shopViewModel.checkoutState.collectAsState()

    var isScheduled by remember { mutableStateOf(false) }
    var paymentMethod by remember { mutableStateOf("cash_at_pickup") } // "cash_at_pickup" or "online_razorpay"
    var specialNotes by remember { mutableStateOf("") }

    val scrollState = rememberScrollState()

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = CardBackground,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
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
                    text = "Counter Pickup Checkout",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(OrangeLight)
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "Moody Orange Boutique",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = OrangePrimary
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Pickup Timing Selector
            Text(
                text = "Pickup Option",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextSecondary
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .border(
                            1.5.dp,
                            if (!isScheduled) OrangePrimary else BorderMuted,
                            RoundedCornerShape(12.dp)
                        )
                        .background(if (!isScheduled) OrangeLight else CreamBackground)
                        .clickable { isScheduled = false }
                        .padding(12.dp)
                ) {
                    Column {
                        Text(
                            text = "⚡ Immediate",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (!isScheduled) OrangePrimary else TextPrimary
                        )
                        Text(
                            text = "Ready in ~15-20m",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .border(
                            1.5.dp,
                            if (isScheduled) OrangePrimary else BorderMuted,
                            RoundedCornerShape(12.dp)
                        )
                        .background(if (isScheduled) OrangeLight else CreamBackground)
                        .clickable { isScheduled = true }
                        .padding(12.dp)
                ) {
                    Column {
                        Text(
                            text = "🕒 Later Today",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isScheduled) OrangePrimary else TextPrimary
                        )
                        Text(
                            text = "In 2 hours",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Customer Contact Info Box
            Text(
                text = "Customer Information",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextSecondary
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(CreamBackground)
                    .border(1.dp, BorderMuted, RoundedCornerShape(12.dp))
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .background(InStockBg),
                    contentAlignment = Alignment.Center
                ) {
                    Text(text = "✓", color = InStockGreen, fontWeight = FontWeight.Bold)
                }
                Spacer(modifier = Modifier.width(12.dp))
                Column {
                    Text(
                        text = session?.fullName ?: "Boutique Guest",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextPrimary
                    )
                    Text(
                        text = session?.phone ?: "",
                        fontSize = 12.sp,
                        color = TextSecondary
                    )
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Payment Method Selector
            Text(
                text = "Payment Method",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextSecondary
            )
            Spacer(modifier = Modifier.height(8.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .border(
                            1.5.dp,
                            if (paymentMethod == "cash_at_pickup") OrangePrimary else BorderMuted,
                            RoundedCornerShape(12.dp)
                        )
                        .background(if (paymentMethod == "cash_at_pickup") OrangeLight else CreamBackground)
                        .clickable { paymentMethod = "cash_at_pickup" }
                        .padding(12.dp)
                ) {
                    Column {
                        Text(
                            text = "💵 Pay at Counter",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (paymentMethod == "cash_at_pickup") OrangePrimary else TextPrimary
                        )
                        Text(
                            text = "Cash / Card at pickup",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }
                }

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(12.dp))
                        .border(
                            1.5.dp,
                            if (paymentMethod == "online_razorpay") OrangePrimary else BorderMuted,
                            RoundedCornerShape(12.dp)
                        )
                        .background(if (paymentMethod == "online_razorpay") OrangeLight else CreamBackground)
                        .clickable { paymentMethod = "online_razorpay" }
                        .padding(12.dp)
                ) {
                    Column {
                        Text(
                            text = "💳 Online Checkout",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (paymentMethod == "online_razorpay") OrangePrimary else TextPrimary
                        )
                        Text(
                            text = "10-min reservation",
                            fontSize = 11.sp,
                            color = TextSecondary
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Special notes
            Text(
                text = "Special Preparation Notes (Optional)",
                fontSize = 13.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextSecondary
            )
            Spacer(modifier = Modifier.height(6.dp))
            OutlinedTextField(
                value = specialNotes,
                onValueChange = { specialNotes = it.take(200) },
                placeholder = { Text("e.g. Please pack cakes separately or add birthday candle", color = TextMuted) },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = OrangePrimary,
                    unfocusedBorderColor = BorderMuted,
                    focusedContainerColor = CreamBackground,
                    unfocusedContainerColor = CreamBackground
                ),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth(),
                maxLines = 3
            )

            Spacer(modifier = Modifier.height(20.dp))

            // Price Breakdown
            val valRes = validation
            if (valRes != null) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(CreamBackground)
                        .border(1.dp, BorderMuted, RoundedCornerShape(14.dp))
                        .padding(16.dp)
                ) {
                    Text(
                        text = "Store Calculated Total",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                    Spacer(modifier = Modifier.height(10.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Subtotal", fontSize = 13.sp, color = TextSecondary)
                        Text(CurrencyFormatter.formatPaiseToInr(valRes.subtotalPaise), fontSize = 13.sp, color = TextPrimary)
                    }
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("Boutique Tax (GST 5%)", fontSize = 13.sp, color = TextSecondary)
                        Text(CurrencyFormatter.formatPaiseToInr(valRes.taxPaise), fontSize = 13.sp, color = TextPrimary)
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(1.dp)
                            .background(BorderMuted)
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Total to Pay", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = TextPrimary)
                        Text(
                            CurrencyFormatter.formatPaiseToInr(valRes.totalPaise),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = OrangePrimary
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
                        .background(OutOfStockBg)
                        .padding(12.dp)
                ) {
                    valRes.errors.forEach { err ->
                        Text(text = "• $err", fontSize = 12.sp, color = OutOfStockRed)
                    }
                }
            }

            if (checkoutState is CheckoutUiState.Error) {
                Spacer(modifier = Modifier.height(14.dp))
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(OutOfStockBg)
                        .padding(12.dp)
                ) {
                    Text(
                        text = (checkoutState as CheckoutUiState.Error).message,
                        fontSize = 12.sp,
                        color = OutOfStockRed
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Action Button
            val isSubmitting = checkoutState is CheckoutUiState.Submitting || checkoutState is CheckoutUiState.Validating
            val canSubmit = valRes?.isValid == true && !isSubmitting

            Button(
                onClick = {
                    val scheduledTime = if (isScheduled) {
                        Instant.now().plus(2, ChronoUnit.HOURS).toString()
                    } else null

                    shopViewModel.submitCheckout(
                        fulfillment = "counter_pickup",
                        scheduledPickupAt = scheduledTime,
                        paymentMethod = paymentMethod,
                        specialNotes = specialNotes.trim().takeIf { it.isNotEmpty() }
                    )
                },
                enabled = canSubmit,
                colors = ButtonDefaults.buttonColors(
                    containerColor = OrangePrimary,
                    contentColor = Color.White
                ),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp)
            ) {
                if (isSubmitting) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                } else {
                    Text("Confirm & Reserve Order", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                }
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}


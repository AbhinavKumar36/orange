package com.moodyorange.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.moodyorange.app.ui.theme.EditorialSerif
import com.moodyorange.app.ui.theme.MangalaTheme
import com.moodyorange.app.ui.viewmodel.ShopViewModel
import kotlinx.coroutines.delay

@Composable
fun AuthDialog(
    shopViewModel: ShopViewModel,
    onDismiss: () -> Unit
) {
    val colors = MangalaTheme.colors
    var step by remember { mutableStateOf(1) } // 1: Phone input, 2: OTP input, 3: Full name onboarding
    var phoneInput by remember { mutableStateOf("") }
    var otpInput by remember { mutableStateOf("") }
    var nameInput by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var cooldownSec by remember { mutableIntStateOf(0) }

    LaunchedEffect(cooldownSec) {
        if (cooldownSec > 0) {
            delay(1000)
            cooldownSec -= 1
        }
    }

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp)),
            color = colors.surface,
            tonalElevation = 6.dp
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Brand Header Monogram
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(colors.primaryContainer)
                        .border(1.dp, colors.gold.copy(alpha = 0.5f), CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "M",
                        fontFamily = EditorialSerif,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (colors.isDark) colors.gold else colors.primary
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                Text(
                    text = when (step) {
                        1 -> "Customer Sign In"
                        2 -> "Verify One-Time Code"
                        else -> "Complete Your Profile"
                    },
                    fontFamily = EditorialSerif,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.textPrimary
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = when (step) {
                        1 -> "Enter your mobile number to checkout and track orders with Mangala Enterprises."
                        2 -> "We sent a 6-digit verification code to +91 $phoneInput"
                        else -> "Tell us your name for orders and boutique counter pickup."
                    },
                    fontSize = 13.sp,
                    color = colors.textSecondary,
                    textAlign = TextAlign.Center
                )

                if (errorMessage != null) {
                    Spacer(modifier = Modifier.height(12.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(colors.outOfStockBg)
                            .padding(horizontal = 12.dp, vertical = 8.dp)
                    ) {
                        Text(
                            text = errorMessage ?: "",
                            fontSize = 12.sp,
                            color = colors.outOfStockRed,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                when (step) {
                    1 -> {
                        // Phone input
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .border(1.dp, colors.border, RoundedCornerShape(12.dp))
                                .background(colors.canvas)
                                .padding(horizontal = 14.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "🇮🇳 +91",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = colors.textPrimary
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            OutlinedTextField(
                                value = phoneInput,
                                onValueChange = { phoneInput = it.filter { char -> char.isDigit() }.take(10) },
                                placeholder = { Text("98765 43210", color = colors.textMuted) },
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = Color.Transparent,
                                    unfocusedBorderColor = Color.Transparent,
                                    focusedContainerColor = Color.Transparent,
                                    unfocusedContainerColor = Color.Transparent,
                                    focusedTextColor = colors.textPrimary,
                                    unfocusedTextColor = colors.textPrimary
                                ),
                                modifier = Modifier.fillMaxWidth()
                            )
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        Button(
                            onClick = {
                                if (phoneInput.length != 10) {
                                    errorMessage = "Please enter a valid 10-digit mobile number."
                                    return@Button
                                }
                                isLoading = true
                                errorMessage = null
                                shopViewModel.requestOtp(phoneInput) { res ->
                                    isLoading = false
                                    res.onSuccess {
                                        step = 2
                                        cooldownSec = 60
                                    }.onFailure { err ->
                                        errorMessage = err.message ?: "Failed to send verification code. Please try again."
                                    }
                                }
                            },
                            enabled = !isLoading && phoneInput.length == 10,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = colors.primary,
                                contentColor = colors.onPrimary,
                                disabledContainerColor = colors.primary.copy(alpha = 0.4f),
                                disabledContentColor = colors.onPrimary.copy(alpha = 0.6f)
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp)
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(color = colors.onPrimary, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                            } else {
                                Text("Send Verification Code", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            }
                        }
                    }

                    2 -> {
                        // OTP input
                        OutlinedTextField(
                            value = otpInput,
                            onValueChange = { otpInput = it.filter { char -> char.isDigit() }.take(6) },
                            placeholder = { Text("6-digit code", color = colors.textMuted) },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = colors.primary,
                                unfocusedBorderColor = colors.border,
                                focusedContainerColor = colors.canvas,
                                unfocusedContainerColor = colors.canvas,
                                focusedTextColor = colors.textPrimary,
                                unfocusedTextColor = colors.textPrimary
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            TextButton(onClick = { step = 1 }) {
                                Text("Change Number", color = colors.textSecondary, fontSize = 12.sp)
                            }

                            if (cooldownSec > 0) {
                                Text(
                                    text = "Resend in ${cooldownSec}s",
                                    fontSize = 12.sp,
                                    color = colors.textMuted
                                )
                            } else {
                                TextButton(
                                    onClick = {
                                        cooldownSec = 60
                                        shopViewModel.requestOtp(phoneInput) { }
                                    }
                                ) {
                                    Text(
                                        text = "Resend Code",
                                        color = if (colors.isDark) colors.gold else colors.primary,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        Button(
                            onClick = {
                                if (otpInput.length != 6) {
                                    errorMessage = "Please enter the 6-digit code."
                                    return@Button
                                }
                                isLoading = true
                                errorMessage = null
                                shopViewModel.verifyOtp(phoneInput, otpInput) { res ->
                                    isLoading = false
                                    res.onSuccess { session ->
                                        if (session.fullName.isNullOrBlank()) {
                                            step = 3
                                        } else {
                                            onDismiss()
                                        }
                                    }.onFailure { err ->
                                        errorMessage = err.message ?: "Invalid verification code."
                                    }
                                }
                            },
                            enabled = !isLoading && otpInput.length == 6,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = colors.primary,
                                contentColor = colors.onPrimary,
                                disabledContainerColor = colors.primary.copy(alpha = 0.4f),
                                disabledContentColor = colors.onPrimary.copy(alpha = 0.6f)
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp)
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(color = colors.onPrimary, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                            } else {
                                Text("Verify & Continue", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            }
                        }
                    }

                    3 -> {
                        // Profile Name input
                        OutlinedTextField(
                            value = nameInput,
                            onValueChange = { nameInput = it },
                            placeholder = { Text("Your full name (e.g. Priya Sharma)", color = colors.textMuted) },
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = colors.primary,
                                unfocusedBorderColor = colors.border,
                                focusedContainerColor = colors.canvas,
                                unfocusedContainerColor = colors.canvas,
                                focusedTextColor = colors.textPrimary,
                                unfocusedTextColor = colors.textPrimary
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        Button(
                            onClick = {
                                if (nameInput.isNotBlank()) {
                                    isLoading = true
                                    shopViewModel.updateCustomerName(nameInput.trim()) {
                                        isLoading = false
                                        onDismiss()
                                    }
                                } else {
                                    onDismiss()
                                }
                            },
                            enabled = !isLoading,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = colors.primary,
                                contentColor = colors.onPrimary
                            ),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(48.dp)
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(color = colors.onPrimary, modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                            } else {
                                Text("Complete Profile", fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                TextButton(onClick = onDismiss) {
                    Text("Close", color = colors.textSecondary, fontSize = 13.sp)
                }
            }
        }
    }
}

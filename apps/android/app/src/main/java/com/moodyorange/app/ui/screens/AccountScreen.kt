package com.moodyorange.app.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.data.theme.ThemeMode
import com.moodyorange.app.ui.components.HeaderBar
import com.moodyorange.app.ui.theme.EditorialSerif
import com.moodyorange.app.ui.theme.ForestGreen
import com.moodyorange.app.ui.theme.MangalaTheme
import com.moodyorange.app.ui.theme.MutedGold
import com.moodyorange.app.ui.theme.WhiteSurface
import com.moodyorange.app.ui.viewmodel.ProfileUpdateUiState
import com.moodyorange.app.ui.viewmodel.ShopViewModel

private enum class AccountScreenView {
    MAIN,
    ACCOUNT_INFO
}

@Composable
fun AccountScreen(
    shopViewModel: ShopViewModel,
    cartItemCount: Int = 0,
    onCartClick: () -> Unit = {},
    onNavigateToOrders: () -> Unit = {},
    onThemeToggle: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors
    val session by shopViewModel.sessionState.collectAsState()
    var currentSubView by remember { mutableStateOf(AccountScreenView.MAIN) }

    when (currentSubView) {
        AccountScreenView.MAIN -> {
            AccountMainView(
                shopViewModel = shopViewModel,
                cartItemCount = cartItemCount,
                onCartClick = onCartClick,
                onNavigateToAccountInfo = { currentSubView = AccountScreenView.ACCOUNT_INFO },
                onNavigateToOrders = onNavigateToOrders,
                onThemeToggle = onThemeToggle,
                modifier = modifier
            )
        }
        AccountScreenView.ACCOUNT_INFO -> {
            AccountInformationView(
                shopViewModel = shopViewModel,
                onBackClick = { currentSubView = AccountScreenView.MAIN },
                modifier = modifier
            )
        }
    }
}

@Composable
private fun AccountMainView(
    shopViewModel: ShopViewModel,
    cartItemCount: Int,
    onCartClick: () -> Unit,
    onNavigateToAccountInfo: () -> Unit,
    onNavigateToOrders: () -> Unit,
    onThemeToggle: (() -> Unit)?,
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors
    val isDark = colors.isDark
    val session by shopViewModel.sessionState.collectAsState()
    val themeMode by shopViewModel.themeMode.collectAsState()
    val scrollState = rememberScrollState()

    var showSignOutConfirm by remember { mutableStateOf(false) }

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
            onProfileClick = {},
            onThemeToggle = onThemeToggle,
            isDark = isDark
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(16.dp)
        ) {
            Text(
                text = "CUSTOMER ACCOUNT",
                fontSize = 10.5.sp,
                fontWeight = FontWeight.Bold,
                color = colors.primary,
                letterSpacing = 1.sp
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = "Mangala Enterprises",
                fontFamily = EditorialSerif,
                fontSize = 21.sp,
                fontWeight = FontWeight.Bold,
                color = colors.textPrimary
            )

            Spacer(modifier = Modifier.height(14.dp))

            if (session != null) {
                // Profile Summary Header Card
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(colors.surface)
                        .border(0.5.dp, colors.border, RoundedCornerShape(14.dp))
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(CircleShape)
                            .background(colors.primaryContainer),
                        contentAlignment = Alignment.Center
                    ) {
                        val initial = session?.fullName?.firstOrNull()?.uppercaseChar()?.toString() ?: "👤"
                        Text(
                            text = initial,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold,
                            color = colors.primary
                        )
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Text(
                        text = session?.fullName ?: "Boutique Guest",
                        fontFamily = EditorialSerif,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.textPrimary
                    )

                    Spacer(modifier = Modifier.height(3.dp))

                    Text(
                        text = session?.phone ?: "",
                        fontSize = 12.5.sp,
                        color = colors.textSecondary
                    )

                    if (!session?.email.isNullOrBlank()) {
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = session?.email ?: "",
                            fontSize = 11.5.sp,
                            color = colors.textMuted
                        )
                    }

                    Spacer(modifier = Modifier.height(8.dp))

                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(colors.inStockBg)
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = "✓ Verified Mobile Session",
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = colors.inStockGreen
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Functional Navigation Menu Card
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(colors.surface)
                        .border(0.5.dp, colors.border, RoundedCornerShape(14.dp))
                ) {
                    AccountNavItem(
                        icon = "👤",
                        title = "Account Information",
                        subtitle = "View and edit your personal profile",
                        onClick = onNavigateToAccountInfo
                    )
                    AccountNavDivider()

                    AccountNavItem(
                        icon = "📦",
                        title = "My Orders",
                        subtitle = "Review live orders and past counter pickups",
                        onClick = onNavigateToOrders
                    )
                    AccountNavDivider()

                    AccountNavItem(
                        icon = "🛍️",
                        title = "Store & Pickup Location",
                        subtitle = "In-store counter collection • 10:00 AM – 10:00 PM",
                        onClick = {}
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Appearance & Theme Selector
                ThemePreferenceCard(
                    currentTheme = themeMode,
                    onThemeSelected = { shopViewModel.setThemeMode(it) }
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Redesigned Sign Out Button (Neutral, subtle secondary styling)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(10.dp))
                        .background(colors.surface)
                        .border(0.5.dp, colors.border, RoundedCornerShape(10.dp))
                        .clickable { showSignOutConfirm = true }
                        .padding(vertical = 12.dp, horizontal = 16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(text = "🚪", fontSize = 14.sp)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Sign Out of Account",
                            fontSize = 13.5.sp,
                            fontWeight = FontWeight.Medium,
                            color = colors.textSecondary
                        )
                    }
                }
            } else {
                // Sign In Invitation Card for guests
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(colors.surface)
                        .border(0.5.dp, colors.border, RoundedCornerShape(14.dp))
                        .padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(CircleShape)
                            .background(colors.primaryContainer),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(text = "🌿", fontSize = 22.sp)
                    }

                    Spacer(modifier = Modifier.height(10.dp))

                    Text(
                        text = "Sign In to Your Account",
                        fontFamily = EditorialSerif,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.textPrimary
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Text(
                        text = "Verify with your Indian mobile number via instant SMS OTP to manage your profile, view orders, and enjoy fresh counter pickup.",
                        fontSize = 12.5.sp,
                        color = colors.textSecondary,
                        lineHeight = 18.sp,
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = { shopViewModel.openAuth() },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = colors.primary,
                            contentColor = if (isDark) colors.canvas else WhiteSurface
                        ),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(46.dp)
                    ) {
                        Text("Sign In with Mobile OTP", fontWeight = FontWeight.Bold, fontSize = 13.5.sp)
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Appearance & Theme Selector
                ThemePreferenceCard(
                    currentTheme = themeMode,
                    onThemeSelected = { shopViewModel.setThemeMode(it) }
                )
            }

            Spacer(modifier = Modifier.height(20.dp))
        }
    }

    // Confirmation Dialog for Sign Out
    if (showSignOutConfirm) {
        AlertDialog(
            onDismissRequest = { showSignOutConfirm = false },
            title = {
                Text(
                    text = "Sign Out",
                    fontFamily = EditorialSerif,
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp,
                    color = colors.textPrimary
                )
            },
            text = {
                Text(
                    text = "Are you sure you wish to sign out of Mangala Enterprises? You can sign back in anytime using your verified phone number.",
                    fontSize = 13.sp,
                    color = colors.textSecondary
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showSignOutConfirm = false
                        shopViewModel.logout()
                    }
                ) {
                    Text(
                        text = "Sign Out",
                        color = colors.primary,
                        fontWeight = FontWeight.Bold
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { showSignOutConfirm = false }) {
                    Text(text = "Cancel", color = colors.textMuted)
                }
            },
            containerColor = colors.surface,
            shape = RoundedCornerShape(14.dp)
        )
    }
}

@Composable
private fun AccountNavItem(
    icon: String,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    val colors = MangalaTheme.colors

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(colors.surfaceElevated),
            contentAlignment = Alignment.Center
        ) {
            Text(text = icon, fontSize = 15.sp)
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.textPrimary
            )
            Text(
                text = subtitle,
                fontSize = 11.sp,
                color = colors.textMuted
            )
        }

        Text(
            text = "›",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = colors.textMuted
        )
    }
}

@Composable
private fun AccountNavDivider() {
    val colors = MangalaTheme.colors
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .height(0.5.dp)
            .background(colors.border)
    )
}

@Composable
private fun ThemePreferenceCard(
    currentTheme: ThemeMode,
    onThemeSelected: (ThemeMode) -> Unit
) {
    val colors = MangalaTheme.colors
    val isDark = colors.isDark

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(colors.surface)
            .border(0.5.dp, colors.border, RoundedCornerShape(14.dp))
            .padding(16.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(text = "🎨", fontSize = 16.sp)
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Appearance & Theme",
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
                color = colors.textPrimary
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .background(colors.surfaceElevated)
                .border(0.5.dp, colors.border, RoundedCornerShape(10.dp))
                .padding(3.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            ThemeMode.entries.forEach { mode ->
                val isSelected = currentTheme == mode
                val icon = when (mode) {
                    ThemeMode.LIGHT -> "☀️"
                    ThemeMode.SYSTEM -> "📱"
                    ThemeMode.DARK -> "🌙"
                }

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(8.dp))
                        .background(
                            if (isSelected) (if (isDark) MutedGold else ForestGreen) else Color.Transparent
                        )
                        .clickable { onThemeSelected(mode) }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(text = icon, fontSize = 11.sp)
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = mode.title,
                            fontSize = 11.5.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) (if (isDark) colors.canvas else WhiteSurface) else colors.textSecondary
                        )
                    }
                }
            }
        }
    }
}

/**
 * Dedicated Account Information Page with Profile Editing
 */
@Composable
private fun AccountInformationView(
    shopViewModel: ShopViewModel,
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors
    val isDark = colors.isDark
    val session by shopViewModel.sessionState.collectAsState()
    val updateState by shopViewModel.profileUpdateState.collectAsState()

    var isEditing by remember { mutableStateOf(false) }
    var editFullName by remember { mutableStateOf(session?.fullName ?: "") }
    var editEmail by remember { mutableStateOf(session?.email ?: "") }

    var fullNameError by remember { mutableStateOf<String?>(null) }
    var emailError by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(session) {
        if (!isEditing) {
            editFullName = session?.fullName ?: ""
            editEmail = session?.email ?: ""
        }
    }

    LaunchedEffect(updateState) {
        if (updateState is ProfileUpdateUiState.Success) {
            isEditing = false
        }
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.canvas)
    ) {
        // Top bar with Back button
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(colors.surface)
                .statusBarsPadding()
                .border(0.5.dp, colors.border)
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .border(0.5.dp, colors.border, CircleShape)
                    .background(colors.surfaceElevated)
                    .clickable(onClick = onBackClick),
                contentAlignment = Alignment.Center
            ) {
                Text(text = "←", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = colors.textPrimary)
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column {
                Text(
                    text = "Account Information",
                    fontFamily = EditorialSerif,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.textPrimary
                )
                Text(
                    text = "Personal details & verified credentials",
                    fontSize = 11.sp,
                    color = colors.textSecondary
                )
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            // Status Feedback Banners
            AnimatedVisibility(visible = updateState is ProfileUpdateUiState.Success) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(colors.inStockBg)
                        .border(0.5.dp, colors.inStockGreen, RoundedCornerShape(8.dp))
                        .padding(12.dp)
                ) {
                    Text(
                        text = "✓ Profile details updated successfully.",
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = colors.inStockGreen
                    )
                }
            }

            AnimatedVisibility(visible = updateState is ProfileUpdateUiState.Error) {
                val err = (updateState as? ProfileUpdateUiState.Error)?.message ?: "Update failed"
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .background(colors.outOfStockBg)
                        .border(0.5.dp, colors.outOfStockRed, RoundedCornerShape(8.dp))
                        .padding(12.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = err,
                            fontSize = 12.sp,
                            color = colors.outOfStockRed,
                            modifier = Modifier.weight(1f)
                        )
                        Text(
                            text = "Retry",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = colors.outOfStockRed,
                            modifier = Modifier
                                .clickable {
                                    shopViewModel.updateProfile(editFullName, editEmail)
                                }
                                .padding(4.dp)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Information Display / Edit Form
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(colors.surface)
                    .border(0.5.dp, colors.border, RoundedCornerShape(14.dp))
                    .padding(16.dp)
            ) {
                if (!isEditing) {
                    // View Mode
                    ProfileFieldItem(
                        label = "CUSTOMER NAME",
                        value = session?.fullName?.takeIf { it.isNotBlank() } ?: "Not provided",
                        icon = "👤"
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    ProfileFieldItem(
                        label = "REGISTERED PHONE NUMBER",
                        value = session?.phone ?: "Not registered",
                        badge = "✓ Verified SMS OTP",
                        icon = "📱",
                        helperText = "Phone number is cryptographically linked to your Supabase authentication session and cannot be changed here."
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    ProfileFieldItem(
                        label = "EMAIL ADDRESS",
                        value = session?.email?.takeIf { it.isNotBlank() } ?: "Not provided",
                        icon = "✉️",
                        helperText = "Used optionally for order summaries and counter pickup receipts."
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    Button(
                        onClick = {
                            isEditing = true
                            editFullName = session?.fullName ?: ""
                            editEmail = session?.email ?: ""
                            fullNameError = null
                            emailError = null
                            shopViewModel.clearProfileUpdateState()
                        },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = colors.primary,
                            contentColor = if (isDark) colors.canvas else WhiteSurface
                        ),
                        shape = RoundedCornerShape(10.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(44.dp)
                    ) {
                        Text("Edit Profile Details", fontWeight = FontWeight.Bold, fontSize = 13.5.sp)
                    }
                } else {
                    // Edit Mode Form
                    Text(
                        text = "Edit Profile",
                        fontFamily = EditorialSerif,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.textPrimary
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // Full Name Input
                    Text(
                        text = "FULL NAME",
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.primary,
                        letterSpacing = 0.8.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(colors.surfaceElevated)
                            .border(
                                0.5.dp,
                                if (fullNameError != null) colors.outOfStockRed else colors.border,
                                RoundedCornerShape(8.dp)
                            )
                            .padding(horizontal = 12.dp, vertical = 10.dp)
                    ) {
                        BasicTextField(
                            value = editFullName,
                            onValueChange = {
                                editFullName = it
                                fullNameError = null
                            },
                            singleLine = true,
                            textStyle = TextStyle(
                                color = colors.textPrimary,
                                fontSize = 13.5.sp
                            ),
                            cursorBrush = SolidColor(colors.primary),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    if (fullNameError != null) {
                        Text(
                            text = fullNameError ?: "",
                            fontSize = 11.sp,
                            color = colors.outOfStockRed,
                            modifier = Modifier.padding(start = 2.dp, top = 2.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Non-editable Phone Display
                    Text(
                        text = "VERIFIED PHONE NUMBER (READ ONLY)",
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.textMuted,
                        letterSpacing = 0.8.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(colors.surfaceElevated.copy(alpha = 0.6f))
                            .border(0.5.dp, colors.border, RoundedCornerShape(8.dp))
                            .padding(horizontal = 12.dp, vertical = 10.dp)
                    ) {
                        Text(
                            text = session?.phone ?: "",
                            fontSize = 13.sp,
                            color = colors.textMuted
                        )
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Email Input (Optional)
                    Text(
                        text = "EMAIL ADDRESS (OPTIONAL)",
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.primary,
                        letterSpacing = 0.8.sp
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(colors.surfaceElevated)
                            .border(
                                0.5.dp,
                                if (emailError != null) colors.outOfStockRed else colors.border,
                                RoundedCornerShape(8.dp)
                            )
                            .padding(horizontal = 12.dp, vertical = 10.dp)
                    ) {
                        BasicTextField(
                            value = editEmail,
                            onValueChange = {
                                editEmail = it
                                emailError = null
                            },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                            textStyle = TextStyle(
                                color = colors.textPrimary,
                                fontSize = 13.5.sp
                            ),
                            cursorBrush = SolidColor(colors.primary),
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    if (emailError != null) {
                        Text(
                            text = emailError ?: "",
                            fontSize = 11.sp,
                            color = colors.outOfStockRed,
                            modifier = Modifier.padding(start = 2.dp, top = 2.dp)
                        )
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // Action buttons: Save & Cancel
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = {
                                val trimmedName = editFullName.trim()
                                val trimmedEmail = editEmail.trim()

                                if (trimmedName.length < 2) {
                                    fullNameError = "Customer name must be at least 2 characters."
                                    return@Button
                                }

                                if (trimmedEmail.isNotEmpty() && !android.util.Patterns.EMAIL_ADDRESS.matcher(trimmedEmail).matches()) {
                                    emailError = "Please enter a valid email address or leave blank."
                                    return@Button
                                }

                                shopViewModel.updateProfile(trimmedName, trimmedEmail)
                            },
                            enabled = updateState !is ProfileUpdateUiState.Loading,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = colors.primary,
                                contentColor = if (isDark) colors.canvas else WhiteSurface
                            ),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .weight(1f)
                                .height(44.dp)
                        ) {
                            if (updateState is ProfileUpdateUiState.Loading) {
                                CircularProgressIndicator(
                                    color = if (isDark) colors.canvas else WhiteSurface,
                                    strokeWidth = 2.dp,
                                    modifier = Modifier.size(18.dp)
                                )
                            } else {
                                Text("Save Changes", fontWeight = FontWeight.Bold, fontSize = 13.5.sp)
                            }
                        }

                        Button(
                            onClick = {
                                isEditing = false
                                fullNameError = null
                                emailError = null
                                shopViewModel.clearProfileUpdateState()
                            },
                            enabled = updateState !is ProfileUpdateUiState.Loading,
                            colors = ButtonDefaults.buttonColors(
                                containerColor = colors.surfaceElevated,
                                contentColor = colors.textSecondary
                            ),
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier.height(44.dp)
                        ) {
                            Text("Cancel", fontSize = 13.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ProfileFieldItem(
    label: String,
    value: String,
    icon: String,
    badge: String? = null,
    helperText: String? = null
) {
    val colors = MangalaTheme.colors

    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(text = icon, fontSize = 13.sp)
            Spacer(modifier = Modifier.width(6.dp))
            Text(
                text = label,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = colors.textMuted,
                letterSpacing = 0.8.sp
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(
                text = value,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                color = colors.textPrimary
            )

            if (badge != null) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(colors.inStockBg)
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = badge,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = colors.inStockGreen
                    )
                }
            }
        }

        if (helperText != null) {
            Spacer(modifier = Modifier.height(3.dp))
            Text(
                text = helperText,
                fontSize = 11.sp,
                color = colors.textMuted,
                lineHeight = 15.sp
            )
        }
    }
}

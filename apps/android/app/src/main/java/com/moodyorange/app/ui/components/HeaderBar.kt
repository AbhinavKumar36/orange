package com.moodyorange.app.ui.components

import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.ui.theme.EditorialSerif
import com.moodyorange.app.ui.theme.ForestGreen
import com.moodyorange.app.ui.theme.MangalaTheme
import com.moodyorange.app.ui.theme.MutedGold
import com.moodyorange.app.ui.theme.WhiteSurface

@Composable
fun HeaderBar(
    cartItemCount: Int = 0,
    onCartClick: () -> Unit = {},
    isLoggedIn: Boolean = false,
    customerName: String? = null,
    onProfileClick: () -> Unit = {},
    onThemeToggle: (() -> Unit)? = null,
    isDark: Boolean = MangalaTheme.colors.isDark,
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors
    val bgColor = colors.surface
    val textPrimary = colors.textPrimary
    val textSecondary = colors.textSecondary
    val borderCol = colors.border

    val badgeScale by animateFloatAsState(
        targetValue = if (cartItemCount > 0) 1f else 0.8f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "cartBadgeScale"
    )

    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(bgColor)
            .statusBarsPadding()
            .border(width = 0.5.dp, color = borderCol)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Logo & Brand Typography
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.weight(1f, fill = false)
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(9.dp))
                    .background(ForestGreen)
                    .border(1.dp, ForestGreen, RoundedCornerShape(9.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "M",
                    fontFamily = EditorialSerif,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = WhiteSurface
                )
            }

            Spacer(modifier = Modifier.width(10.dp))

            Column {
                Text(
                    text = "MANGALA ENTERPRISES",
                    fontFamily = EditorialSerif,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.1.sp,
                    color = textPrimary,
                    maxLines = 1
                )
                Text(
                    text = if (isLoggedIn && !customerName.isNullOrBlank()) {
                        "Welcome, $customerName"
                    } else {
                        "Artisanal Delicacies & Fresh Confections"
                    },
                    fontSize = 10.5.sp,
                    color = textSecondary,
                    maxLines = 1
                )
            }
        }

        Spacer(modifier = Modifier.width(8.dp))

        // Action shortcuts: Theme Toggle, Profile & Cart
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Theme toggle (Sun / Moon)
            if (onThemeToggle != null) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(CircleShape)
                        .border(1.dp, borderCol, CircleShape)
                        .background(colors.surfaceElevated)
                        .clickable(onClick = onThemeToggle)
                        .semantics {
                            contentDescription = if (isDark) "Switch to light theme" else "Switch to dark theme"
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = if (isDark) "☀️" else "🌙",
                        fontSize = 14.sp
                    )
                }
            }

            // Profile shortcut
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .border(1.dp, borderCol, CircleShape)
                    .background(if (isLoggedIn) colors.primaryContainer else colors.surfaceElevated)
                    .clickable(onClick = onProfileClick)
                    .semantics {
                        contentDescription = if (isLoggedIn) "Account profile" else "Sign in"
                    },
                contentAlignment = Alignment.Center
            ) {
                if (isLoggedIn) {
                    val initial = customerName?.firstOrNull()?.uppercaseChar()?.toString() ?: "✓"
                    Text(
                        text = initial,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.primary
                    )
                } else {
                    Text(
                        text = "👤",
                        fontSize = 14.sp
                    )
                }
            }

            // Shopping Bag with animated badge
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(9.dp))
                    .border(1.dp, borderCol, RoundedCornerShape(9.dp))
                    .background(if (cartItemCount > 0) colors.primaryContainer else colors.surfaceElevated)
                    .clickable(onClick = onCartClick)
                    .semantics {
                        contentDescription = "Shopping cart with $cartItemCount items"
                    },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "🛍️",
                    fontSize = 15.sp
                )

                if (cartItemCount > 0) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .offset(x = 4.dp, y = (-4).dp)
                            .size(18.dp)
                            .scale(badgeScale)
                            .clip(CircleShape)
                            .background(ForestGreen)
                            .border(1.5.dp, bgColor, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (cartItemCount > 99) "99+" else "$cartItemCount",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = WhiteSurface
                        )
                    }
                }
            }
        }
    }
}

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.ui.theme.BorderMuted
import com.moodyorange.app.ui.theme.CardBackground
import com.moodyorange.app.ui.theme.DarkBackground
import com.moodyorange.app.ui.theme.DarkBorder
import com.moodyorange.app.ui.theme.DarkTextPrimary
import com.moodyorange.app.ui.theme.DarkTextSecondary
import com.moodyorange.app.ui.theme.EditorialSerif
import com.moodyorange.app.ui.theme.GourmetGold
import com.moodyorange.app.ui.theme.OrangeLight
import com.moodyorange.app.ui.theme.OrangePrimary

@Composable
fun HeaderBar(
    cartItemCount: Int = 0,
    onCartClick: () -> Unit = {},
    isLoggedIn: Boolean = false,
    customerName: String? = null,
    onProfileClick: () -> Unit = {},
    isDark: Boolean = true,
    modifier: Modifier = Modifier
) {
    val bgColor = if (isDark) DarkBackground else CardBackground
    val textPrimary = if (isDark) DarkTextPrimary else Color(0xFF141210)
    val textSecondary = if (isDark) DarkTextSecondary else Color(0xFF756A63)
    val borderCol = if (isDark) DarkBorder else BorderMuted

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
            .padding(horizontal = 20.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Logo & Brand Typography
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(Color(0x33FF5500))
                    .border(1.dp, Color(0x66FF5500), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "🍊",
                    fontSize = 18.sp
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "MOODY ORANGE",
                        fontFamily = EditorialSerif,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        color = textPrimary
                    )
                }
                Text(
                    text = if (isLoggedIn && !customerName.isNullOrBlank()) "Welcome, $customerName" else "Artisanal Digital Patisserie",
                    fontSize = 11.sp,
                    color = textSecondary
                )
            }
        }

        // Action shortcuts: Profile & Cart
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            // Profile shortcut
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .border(1.dp, borderCol, CircleShape)
                    .background(if (isLoggedIn) Color(0x33FF5500) else Color(0x1AFFFFFF))
                    .clickable { onProfileClick() },
                contentAlignment = Alignment.Center
            ) {
                if (isLoggedIn) {
                    val initial = customerName?.firstOrNull()?.uppercaseChar()?.toString() ?: "✓"
                    Text(
                        text = initial,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = OrangePrimary
                    )
                } else {
                    Text(
                        text = "👤",
                        fontSize = 15.sp
                    )
                }
            }

            // Shopping Bag with animated badge
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .border(1.dp, borderCol, RoundedCornerShape(10.dp))
                    .background(if (cartItemCount > 0) Color(0x33FF5500) else Color(0x1AFFFFFF))
                    .clickable { onCartClick() },
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "🛍️",
                    fontSize = 16.sp
                )

                if (cartItemCount > 0) {
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .offset(x = 5.dp, y = (-5).dp)
                            .size(19.dp)
                            .scale(badgeScale)
                            .clip(CircleShape)
                            .background(OrangePrimary)
                            .border(1.5.dp, bgColor, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = if (cartItemCount > 99) "99+" else "$cartItemCount",
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                    }
                }
            }
        }
    }
}

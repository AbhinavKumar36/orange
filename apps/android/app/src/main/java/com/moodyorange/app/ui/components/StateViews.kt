package com.moodyorange.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.ui.theme.MangalaTheme
import com.moodyorange.app.ui.theme.WhiteSurface

@Composable
fun LoadingStateView(
    message: String = "Loading artisanal delicacies...",
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator(
            color = colors.primary,
            strokeWidth = 2.5.dp,
            modifier = Modifier.size(38.dp)
        )
        Spacer(modifier = Modifier.height(14.dp))
        Text(
            text = message,
            fontSize = 13.5.sp,
            color = colors.textSecondary,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
fun ErrorStateView(
    message: String,
    onRetry: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors
    val isDark = colors.isDark

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(24.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(colors.surface)
            .border(0.5.dp, colors.border, RoundedCornerShape(14.dp))
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(46.dp)
                .clip(CircleShape)
                .background(colors.surfaceElevated),
            contentAlignment = Alignment.Center
        ) {
            Text(text = "⚠️", fontSize = 20.sp)
        }

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = "Store Catalog Unavailable",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = colors.textPrimary
        )

        Spacer(modifier = Modifier.height(6.dp))

        Text(
            text = message,
            fontSize = 12.5.sp,
            color = colors.textSecondary,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(16.dp))

        Button(
            onClick = onRetry,
            colors = ButtonDefaults.buttonColors(
                containerColor = colors.primary,
                contentColor = if (isDark) colors.canvas else WhiteSurface
            ),
            shape = RoundedCornerShape(10.dp)
        ) {
            Text(
                text = "Try Again",
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp
            )
        }
    }
}

@Composable
fun EmptyStateView(
    title: String = "No Confections Found",
    message: String = "Try adjusting your search or explore other boutique categories.",
    onClear: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors
    val isDark = colors.isDark

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(52.dp)
                .clip(CircleShape)
                .background(colors.surfaceElevated),
            contentAlignment = Alignment.Center
        ) {
            Text(text = "🌿", fontSize = 24.sp)
        }

        Spacer(modifier = Modifier.height(12.dp))

        Text(
            text = title,
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = colors.textPrimary
        )

        Spacer(modifier = Modifier.height(6.dp))

        Text(
            text = message,
            fontSize = 12.5.sp,
            color = colors.textMuted,
            textAlign = TextAlign.Center
        )

        if (onClear != null) {
            Spacer(modifier = Modifier.height(16.dp))
            Button(
                onClick = onClear,
                colors = ButtonDefaults.buttonColors(
                    containerColor = colors.primary,
                    contentColor = if (isDark) colors.canvas else WhiteSurface
                ),
                shape = RoundedCornerShape(10.dp)
            ) {
                Text(
                    text = "Clear Filter",
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp
                )
            }
        }
    }
}

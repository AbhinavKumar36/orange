package com.moodyorange.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.moodyorange.app.ui.theme.BorderMuted
import com.moodyorange.app.ui.theme.CardBackground
import com.moodyorange.app.ui.theme.OrangeLight
import com.moodyorange.app.ui.theme.OrangePrimary
import com.moodyorange.app.ui.theme.TextPrimary
import com.moodyorange.app.ui.theme.TextSecondary

@Composable
fun HeaderBar(
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(CardBackground)
            .padding(horizontal = 20.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            // Orange brand icon circle
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(CircleShape)
                    .background(OrangePrimary),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "🍊",
                    fontSize = 18.sp
                )
            }

            Spacer(modifier = Modifier.width(12.dp))

            Column {
                Text(
                    text = "Moody Orange",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
                Text(
                    text = "Artisanal Boutique & Treats",
                    fontSize = 11.sp,
                    color = TextSecondary
                )
            }
        }

        // Cart Preview Icon (Phase 4: Non-functional preview, strictly respects cart restrictions)
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(10.dp))
                .border(1.dp, BorderMuted, RoundedCornerShape(10.dp))
                .background(OrangeLight),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "🛍️",
                fontSize = 16.sp
            )
        }
    }
}

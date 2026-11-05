package com.moodyorange.app.ui.components

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import com.moodyorange.app.ui.theme.EditorialSerif
import com.moodyorange.app.ui.theme.ForestGreen
import com.moodyorange.app.ui.theme.MangalaTheme
import com.moodyorange.app.ui.theme.WhiteSurface

data class ShowcaseItem(
    val categoryKey: String,
    val title: String,
    val subtitle: String,
    val price: String,
    val imageUrl: String,
    val tastingNote: String,
    val isVeg: Boolean
)

private val SHOWCASE_ITEMS = listOf(
    ShowcaseItem(
        categoryKey = "cake",
        title = "Dark Chocolate Truffle Cake",
        subtitle = "Boutique Patisserie Vitrine",
        price = "₹450",
        imageUrl = "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80",
        tastingNote = "Layered 70% dark Belgian ganache with cold-pressed natural fruit extract glaze. Prepared and chilled in vitrine.",
        isVeg = true
    ),
    ShowcaseItem(
        categoryKey = "juice",
        title = "Valencia Orange Cold-Pressed (300ml)",
        subtitle = "Chilled Nectar Vitrine",
        price = "₹180",
        imageUrl = "https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=800&q=80",
        tastingNote = "Pure sun-ripened cold-pressed fruit extract with natural floral notes. Sealed and ready in display counter.",
        isVeg = true
    ),
    ShowcaseItem(
        categoryKey = "chocolates",
        title = "Artisanal Praline Box (6 pcs)",
        subtitle = "Gourmet Chocolatier Collection",
        price = "₹350",
        imageUrl = "https://images.unsplash.com/photo-1549007994-cb92caebd54b?auto=format&fit=crop&w=800&q=80",
        tastingNote = "Single-origin cacao truffles dusted in roasted nibs and pure cocoa butter. Boxed for instant takeaway.",
        isVeg = true
    )
)

@Composable
fun ProductShowcaseSection(
    onExploreShop: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors
    var selectedIndex by remember { mutableStateOf(0) }
    val currentItem = SHOWCASE_ITEMS[selectedIndex]

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
    ) {
        // Section Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "IN-STORE VITRINE SHOWCASE",
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = ForestGreen,
                    letterSpacing = 1.sp
                )
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "Curated Boutique Confections",
                    fontFamily = EditorialSerif,
                    fontSize = 19.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.textPrimary
                )
            }
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Category Switcher Tabs
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            ShowcaseTab(
                label = "Boutique Cake",
                isSelected = selectedIndex == 0,
                onClick = { selectedIndex = 0 },
                modifier = Modifier.weight(1f)
            )
            ShowcaseTab(
                label = "Cold Nectar",
                isSelected = selectedIndex == 1,
                onClick = { selectedIndex = 1 },
                modifier = Modifier.weight(1f)
            )
            ShowcaseTab(
                label = "Fine Truffles",
                isSelected = selectedIndex == 2,
                onClick = { selectedIndex = 2 },
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Showcase Vitrine Card
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(colors.surface)
                .border(0.5.dp, colors.border, RoundedCornerShape(14.dp))
        ) {
            // High-Resolution Vitrine Image with Tag Overlays
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .background(colors.surfaceElevated)
            ) {
                SubcomposeAsyncImage(
                    model = currentItem.imageUrl,
                    contentDescription = currentItem.title,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxSize()
                )

                // Elegant gradient overlay for text readability
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(Color.Transparent, Color(0xB3040D12))
                            )
                        )
                )

                // In-Store Ready Stock Badge (Top End)
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(10.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color(0xCC040D12))
                        .border(0.5.dp, colors.gold, RoundedCornerShape(6.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "✨ IN-STORE DISPLAY • READY TO HANDOVER",
                        fontSize = 8.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.gold,
                        letterSpacing = 0.5.sp
                    )
                }

                // Dietary symbol (Top Start)
                Box(
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(10.dp)
                ) {
                    FoodClassificationIndicator(
                        isVeg = currentItem.isVeg,
                        size = 18.dp
                    )
                }

                // Title & Price Bar (Bottom of image)
                Row(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Bottom
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = currentItem.title,
                            fontFamily = EditorialSerif,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = currentItem.subtitle,
                            fontSize = 10.5.sp,
                            color = Color(0xFFDCE5DB)
                        )
                    }
                    Text(
                        text = currentItem.price,
                        fontFamily = EditorialSerif,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = colors.gold
                    )
                }
            }

            // Confection Details & Tasting Notes
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(text = "🌿", fontSize = 14.sp)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = "Tasting Note:",
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = ForestGreen
                    )
                }
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = currentItem.tastingNote,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = colors.textSecondary
                )

                Spacer(modifier = Modifier.height(12.dp))

                Button(
                    onClick = onExploreShop,
                    colors = ButtonDefaults.buttonColors(
                        containerColor = ForestGreen,
                        contentColor = WhiteSurface
                    ),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(40.dp)
                ) {
                    Text(
                        text = "Explore Confection Menu →",
                        fontSize = 12.5.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

@Composable
private fun ShowcaseTab(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = MangalaTheme.colors

    val bg = if (isSelected) ForestGreen else colors.surfaceElevated
    val textColor = if (isSelected) WhiteSurface else colors.textSecondary
    val borderColor = if (isSelected) ForestGreen else colors.border

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(bg)
            .border(0.5.dp, borderColor, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 7.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            fontSize = 11.5.sp,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            color = textColor
        )
    }
}

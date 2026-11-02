package com.moodyorange.app.ui.components

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import coil.compose.SubcomposeAsyncImage

/**
 * Image component that loads remote product images with Coil and gracefully falls back
 * to the artisanal vector-based ProductPlaceholder during loading, on error, or if imageUrl is absent.
 */
@Composable
fun ProductImage(
    imageUrl: String?,
    categorySlug: String,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop
) {
    if (!imageUrl.isNullOrBlank()) {
        SubcomposeAsyncImage(
            model = imageUrl,
            contentDescription = contentDescription,
            modifier = modifier,
            contentScale = contentScale,
            loading = {
                ProductPlaceholder(
                    categorySlug = categorySlug,
                    modifier = Modifier.fillMaxSize()
                )
            },
            error = {
                ProductPlaceholder(
                    categorySlug = categorySlug,
                    modifier = Modifier.fillMaxSize()
                )
            }
        )
    } else {
        ProductPlaceholder(
            categorySlug = categorySlug,
            modifier = modifier
        )
    }
}


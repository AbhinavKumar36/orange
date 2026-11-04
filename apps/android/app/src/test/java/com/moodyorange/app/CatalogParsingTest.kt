package com.moodyorange.app

import com.moodyorange.app.data.api.MoodyOrangeApiClient
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CatalogParsingTest {

    private val apiClient = MoodyOrangeApiClient("http://localhost:4000/api/v1")

    @Test
    fun testCategoryResponseParsing() {
        val json = """
            {
              "categories": [
                {
                  "id": "11111111-1111-1111-1111-111111111111",
                  "name": "Artisanal Cakes",
                  "slug": "artisanal-cakes",
                  "description": "Freshly baked boutique gourmet cakes",
                  "display_order": 1
                },
                {
                  "id": "22222222-2222-2222-2222-222222222222",
                  "name": "Cold-Pressed Juices",
                  "slug": "cold-pressed-juices",
                  "description": null,
                  "display_order": 2
                }
              ]
            }
        """.trimIndent()

        val categories = apiClient.parseCategories(json)
        assertEquals(2, categories.size)

        val first = categories[0]
        assertEquals("11111111-1111-1111-1111-111111111111", first.id)
        assertEquals("Artisanal Cakes", first.name)
        assertEquals("artisanal-cakes", first.slug)
        assertEquals("Freshly baked boutique gourmet cakes", first.description)
        assertEquals(1, first.displayOrder)

        val second = categories[1]
        assertEquals("22222222-2222-2222-2222-222222222222", second.id)
        assertEquals("Cold-Pressed Juices", second.name)
        assertNull(second.description)
        assertEquals(2, second.displayOrder)
    }

    @Test
    fun testEmptyCategoryListParsing() {
        val json = """{ "categories": [] }"""
        val categories = apiClient.parseCategories(json)
        assertTrue(categories.isEmpty())
    }

    @Test
    fun testProductListParsing() {
        val json = """
            {
              "products": [
                {
                  "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
                  "categoryId": "11111111-1111-1111-1111-111111111111",
                  "categoryName": "Artisanal Cakes",
                  "categorySlug": "artisanal-cakes",
                  "name": "Dark Chocolate Truffle Cake (500g)",
                  "slug": "dark-chocolate-truffle-cake-500g",
                  "description": "70% Belgian dark chocolate sponge with silky ganache",
                  "basePrice": 65000,
                  "taxRatePct": 5.0,
                  "isVeg": true,
                  "allergens": ["dairy", "gluten"],
                  "prepTimeMinutes": 20,
                  "imageUrl": null,
                  "isInStock": true
                }
              ]
            }
        """.trimIndent()

        val products = apiClient.parseProducts(json)
        assertEquals(1, products.size)

        val product = products[0]
        assertEquals("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", product.id)
        assertEquals("Dark Chocolate Truffle Cake (500g)", product.name)
        assertEquals(65000L, product.basePrice)
        assertEquals(2, product.allergens.size)
        assertTrue(product.allergens.contains("dairy"))
        assertTrue(product.allergens.contains("gluten"))
        assertEquals(true, product.isVeg)
        assertEquals(20, product.prepTimeMinutes)
        assertNull(product.imageUrl)
        assertTrue(product.isInStock)
        assertEquals("₹650.00", product.formattedPrice)
    }

    @Test
    fun testProductDetailParsing() {
        val json = """
            {
              "product": {
                "id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
                "categoryId": "22222222-2222-2222-2222-222222222222",
                "categoryName": "Cold-Pressed Juices",
                "categorySlug": "cold-pressed-juices",
                "name": "Valencia Orange Cold-Pressed (300ml)",
                "slug": "valencia-orange-cold-pressed-300ml",
                "description": "Pure Valencia orange juice",
                "basePrice": 18000,
                "taxRatePct": 5.0,
                "isVeg": true,
                "allergens": [],
                "prepTimeMinutes": 5,
                "imageUrl": "https://example.com/juice.png",
                "isInStock": true
              }
            }
        """.trimIndent()

        val product = apiClient.parseProductDetail(json)
        assertNotNull(product)
        assertEquals("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", product.id)
        assertEquals(18000L, product.basePrice)
        assertEquals("₹180.00", product.formattedPrice)
        assertEquals("https://example.com/juice.png", product.imageUrl)
        assertTrue(product.allergens.isEmpty())
        assertTrue(product.isInStock)
    }

    @Test
    fun testMissingAvailabilityDefaultsToUnavailable() {
        // Critical requirement: Missing availability must NEVER default to available
        val json = """
            {
              "products": [
                {
                  "id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
                  "categoryId": "33333333-3333-3333-3333-333333333333",
                  "categoryName": "Gourmet Chocolates",
                  "categorySlug": "gourmet-chocolates",
                  "name": "Artisanal Praline Box",
                  "slug": "artisanal-praline-box",
                  "basePrice": 35000,
                  "taxRatePct": 5.0,
                  "isVeg": true
                }
              ]
            }
        """.trimIndent()

        val products = apiClient.parseProducts(json)
        assertEquals(1, products.size)
        // Must be false since isInStock was omitted from JSON
        assertFalse("Missing isInStock must default to false", products[0].isInStock)
    }

    @Test
    fun testNullAvailabilityDefaultsToUnavailable() {
        val json = """
            {
              "products": [
                {
                  "id": "cccccccc-cccc-cccc-cccc-cccccccccccc",
                  "categoryId": "33333333-3333-3333-3333-333333333333",
                  "categoryName": "Gourmet Chocolates",
                  "categorySlug": "gourmet-chocolates",
                  "name": "Artisanal Praline Box",
                  "slug": "artisanal-praline-box",
                  "basePrice": 35000,
                  "taxRatePct": 5.0,
                  "isVeg": true,
                  "isInStock": null
                }
              ]
            }
        """.trimIndent()

        val products = apiClient.parseProducts(json)
        assertEquals(1, products.size)
        assertFalse("Null isInStock must default to false", products[0].isInStock)
    }

    @Test
    fun testEmptyProductsListParsing() {
        val json = """{ "products": [] }"""
        val products = apiClient.parseProducts(json)
        assertTrue(products.isEmpty())
    }

    @Test
    fun testFoodClassificationParsing() {
        val json = """
            {
              "products": [
                {
                  "id": "veg-01",
                  "categoryId": "cat-01",
                  "name": "Pistachio Cake",
                  "slug": "pistachio-cake",
                  "basePrice": 45000,
                  "isVeg": true,
                  "isInStock": true
                },
                {
                  "id": "non-veg-01",
                  "categoryId": "cat-01",
                  "name": "Classic Tiramisu with Gelatin",
                  "slug": "classic-tiramisu",
                  "basePrice": 52000,
                  "isVeg": false,
                  "isInStock": true
                },
                {
                  "id": "merch-01",
                  "categoryId": "cat-02",
                  "name": "Boutique Ceramic Mug",
                  "slug": "ceramic-mug",
                  "basePrice": 25000,
                  "isVeg": null,
                  "isInStock": true
                }
              ]
            }
        """.trimIndent()

        val products = apiClient.parseProducts(json)
        assertEquals(3, products.size)

        assertEquals(true, products[0].isVeg)
        assertEquals("vegetarian", products[0].foodClassification)

        assertEquals(false, products[1].isVeg)
        assertEquals("non_vegetarian", products[1].foodClassification)

        assertNull(products[2].isVeg)
        assertNull(products[2].foodClassification)
    }
}


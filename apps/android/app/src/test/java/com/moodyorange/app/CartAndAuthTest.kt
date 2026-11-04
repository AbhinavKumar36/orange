package com.moodyorange.app

import com.moodyorange.app.data.api.MoodyOrangeApiClient
import com.moodyorange.app.data.model.CartItem
import com.moodyorange.app.data.model.Product
import com.moodyorange.app.util.PhoneNumberUtil
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CartAndAuthTest {

    private val apiClient = MoodyOrangeApiClient()

    private val sampleProduct = Product(
        id = "prod_01",
        categoryId = "cat_01",
        categoryName = "Artisanal Cakes",
        categorySlug = "cakes",
        name = "Moody Blood Orange Gateau",
        slug = "blood-orange-gateau",
        description = "Dark chocolate and blood orange glaze",
        basePrice = 85000L, // ₹850.00
        taxRatePct = 5.0,
        isVeg = true,
        allergens = listOf("Gluten", "Dairy"),
        prepTimeMinutes = 20,
        imageUrl = "https://example.com/cake.jpg",
        isInStock = true
    )

    @Test
    fun testCartItemLineTotalCalculation() {
        val item1 = CartItem(productId = sampleProduct.id, product = sampleProduct, quantity = 1)
        assertEquals(85000L, item1.lineTotalPaise)

        val item3 = CartItem(productId = sampleProduct.id, product = sampleProduct, quantity = 3)
        assertEquals(255000L, item3.lineTotalPaise)
    }

    @Test
    fun testParseCartValidationResponse() {
        val json = """
        {
            "isValid": true,
            "items": [
                {
                    "productId": "prod_01",
                    "title": "Moody Blood Orange Gateau",
                    "unitPricePaise": 85000,
                    "requestedQuantity": 2,
                    "availableQuantity": 10,
                    "lineTotalPaise": 170000,
                    "isAvailable": true
                }
            ],
            "subtotalPaise": 170000,
            "taxPaise": 8500,
            "totalPaise": 178500,
            "currency": "INR",
            "errors": []
        }
        """.trimIndent()

        val parsed = apiClient.parseCartValidation(json)
        assertTrue(parsed.isValid)
        assertEquals(1, parsed.items.size)
        assertEquals(170000L, parsed.subtotalPaise)
        assertEquals(8500L, parsed.taxPaise)
        assertEquals(178500L, parsed.totalPaise)
        assertEquals("INR", parsed.currency)
        assertTrue(parsed.errors.isEmpty())
        assertEquals("Moody Blood Orange Gateau", parsed.items[0].title)
    }

    @Test
    fun testParseCheckoutResponse() {
        val json = """
        {
            "orderId": "ord_1001",
            "orderNumber": "MO-20261102-1001",
            "orderStatus": "confirmed",
            "paymentStatus": "unpaid",
            "fulfillmentType": "counter_pickup",
            "totalAmount": 178500,
            "currency": "INR",
            "expiresAt": null,
            "estimatedPickupAt": "2026-11-02T16:00:00.000Z"
        }
        """.trimIndent()

        val parsed = apiClient.parseCheckoutResponse(json)
        assertEquals("ord_1001", parsed.orderId)
        assertEquals("MO-20261102-1001", parsed.orderNumber)
        assertEquals("confirmed", parsed.orderStatus)
        assertEquals("unpaid", parsed.paymentStatus)
        assertEquals(178500L, parsed.totalAmount)
        assertNull(parsed.expiresAt)
        assertNotNull(parsed.estimatedPickupAt)
    }

    @Test
    fun testParseOrdersResponse() {
        val json = """
        {
            "orders": [
                {
                    "id": "ord_2001",
                    "orderNumber": "MO-20261102-2001",
                    "customerId": "cust_01",
                    "customerPhone": "+919876543210",
                    "customerName": "Customer A",
                    "fulfillmentType": "counter_pickup",
                    "scheduledPickupAt": null,
                    "estimatedPickupAt": "2026-11-02T18:00:00.000Z",
                    "orderStatus": "confirmed",
                    "paymentStatus": "unpaid",
                    "paymentMethod": "cash_at_pickup",
                    "subtotalAmount": 85000,
                    "taxAmount": 4250,
                    "packagingAmount": 0,
                    "totalAmount": 89250,
                    "specialNotes": "No contact pickup",
                    "expiresAt": null,
                    "createdAt": "2026-11-02T12:00:00.000Z",
                    "items": [
                        {
                            "id": "item_01",
                            "productId": "prod_01",
                            "productNameSnapshot": "Moody Blood Orange Gateau",
                            "unitPriceSnapshot": 85000,
                            "taxRateSnapshot": 5.0,
                            "quantity": 1,
                            "lineTotal": 85000
                        }
                    ]
                }
            ]
        }
        """.trimIndent()

        val orders = apiClient.parseOrdersResponse(json)
        assertEquals(1, orders.size)
        val order = orders[0]
        assertEquals("ord_2001", order.id)
        assertEquals("MO-20261102-2001", order.orderNumber)
        assertEquals(89250L, order.totalAmount)
        assertEquals("confirmed", order.orderStatus)
        assertEquals(1, order.items.size)
        assertEquals("Moody Blood Orange Gateau", order.items[0].productNameSnapshot)
    }

    @Test
    fun testParseProfileResponse() {
        val json = """
        {
            "profile": {
                "id": "usr_99",
                "phone": "+919876543210",
                "full_name": "Aarav Mehta",
                "email": "aarav.mehta@example.com",
                "created_at": "2026-11-02T10:00:00Z"
            }
        }
        """.trimIndent()

        val parsed = apiClient.parseProfileResponse(json)
        assertEquals("usr_99", parsed.id)
        assertEquals("+919876543210", parsed.phone)
        assertEquals("Aarav Mehta", parsed.fullName)
        assertEquals("aarav.mehta@example.com", parsed.email)
    }

    @Test
    fun testParseProfileResponseWithoutEmail() {
        val json = """
        {
            "profile": {
                "id": "usr_100",
                "phone": "+919876543211",
                "full_name": "Priya Sharma"
            }
        }
        """.trimIndent()

        val parsed = apiClient.parseProfileResponse(json)
        assertEquals("usr_100", parsed.id)
        assertEquals("+919876543211", parsed.phone)
        assertEquals("Priya Sharma", parsed.fullName)
        assertNull(parsed.email)
    }

    @Test
    fun testPhoneNumberFormattingAndValidation() {
        // Standard 10 digit Indian number
        val res1 = PhoneNumberUtil.normalize("9876543210")
        assertTrue(res1.isValid)
        assertEquals("+919876543210", res1.e164)
        assertEquals("9876543210", res1.nationalNumber)

        // Leading 0 domestic trunk
        val res2 = PhoneNumberUtil.normalize("09876543210")
        assertTrue(res2.isValid)
        assertEquals("+919876543210", res2.e164)

        // Existing +91 with spaces
        val res3 = PhoneNumberUtil.normalize("+91 98765 43210")
        assertTrue(res3.isValid)
        assertEquals("+919876543210", res3.e164)

        // Leading 91 without plus
        val res4 = PhoneNumberUtil.normalize("919876543210")
        assertTrue(res4.isValid)
        assertEquals("+919876543210", res4.e164)

        // Validations
        assertTrue(PhoneNumberUtil.isValid("+919876543210"))
        assertTrue(PhoneNumberUtil.isValid("9876543210"))
        assertTrue(PhoneNumberUtil.isValid("09876543210"))

        // Invalid: non-Indian code
        val resUs = PhoneNumberUtil.normalize("+14155552671")
        assertFalse(resUs.isValid)

        // Invalid: duplicate 91
        val resDup = PhoneNumberUtil.normalize("+91919876543210")
        assertFalse(resDup.isValid)

        // Invalid: starts with 1, 2, 3, etc.
        assertFalse(PhoneNumberUtil.isValid("1234567890"))
        assertFalse(PhoneNumberUtil.isValid(""))
    }
}

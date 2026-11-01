package com.moodyorange.app

import com.moodyorange.app.util.CurrencyFormatter
import org.junit.Assert.assertEquals
import org.junit.Test

class CurrencyFormatterTest {

    @Test
    fun testPaiseToInrFormattingStandard() {
        // 65000 paise = ₹650.00
        assertEquals("₹650.00", CurrencyFormatter.formatPaiseToInr(65000L))

        // 18000 paise = ₹180.00
        assertEquals("₹180.00", CurrencyFormatter.formatPaiseToInr(18000L))

        // 35000 paise = ₹350.00
        assertEquals("₹350.00", CurrencyFormatter.formatPaiseToInr(35000L))
    }

    @Test
    fun testPaiseToInrFormattingZero() {
        assertEquals("₹0.00", CurrencyFormatter.formatPaiseToInr(0L))
    }

    @Test
    fun testPaiseToInrFormattingSubRupee() {
        // 99 paise = ₹0.99
        assertEquals("₹0.99", CurrencyFormatter.formatPaiseToInr(99L))
        // 5 paise = ₹0.05
        assertEquals("₹0.05", CurrencyFormatter.formatPaiseToInr(5L))
    }

    @Test
    fun testPaiseToInrFormattingLargeAmounts() {
        // 105000 paise = ₹1,050.00 (Indian grouping)
        assertEquals("₹1,050.00", CurrencyFormatter.formatPaiseToInr(105000L))
    }

    @Test
    fun testPaiseToInrFormattingWithoutDecimals() {
        assertEquals("₹650", CurrencyFormatter.formatPaiseToInr(65000L, showDecimals = false))
        assertEquals("₹650.50", CurrencyFormatter.formatPaiseToInr(65050L, showDecimals = false))
    }
}


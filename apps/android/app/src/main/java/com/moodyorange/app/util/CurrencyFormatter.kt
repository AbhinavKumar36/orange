package com.moodyorange.app.util

import java.util.Locale

/**
 * Currency formatter for integer INR paise to Rupee display strings.
 * Example: 65000 paise -> "₹650.00"
 */
object CurrencyFormatter {
    fun formatPaiseToInr(paise: Long, showDecimals: Boolean = true): String {
        val rupees = paise / 100.0
        val locale = Locale("en", "IN")
        return if (showDecimals) {
            String.format(locale, "₹%,.2f", rupees)
        } else {
            if (paise % 100 == 0L) {
                String.format(locale, "₹%,d", paise / 100)
            } else {
                String.format(locale, "₹%,.2f", rupees)
            }
        }
    }
}

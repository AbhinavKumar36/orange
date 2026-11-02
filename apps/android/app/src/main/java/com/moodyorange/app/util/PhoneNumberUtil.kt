package com.moodyorange.app.util

/**
 * Phone Number Normalization and Validation for Android.
 * Mirrors the canonical normalization rules from @orange/api-contracts.
 */
object PhoneNumberUtil {

    data class NormalizationResult(
        val isValid: Boolean,
        val e164: String? = null,
        val nationalNumber: String? = null,
        val error: String? = null
    )

    fun normalizeIndianPhoneNumber(input: String?): NormalizationResult {
        if (input.isNullOrBlank()) {
            return NormalizationResult(isValid = false, error = "Phone number cannot be empty.")
        }

        val trimmed = input.trim()

        // Disallow letters or unexpected symbols
        if (!Regex("^[0-9+\\s\\-().]+$").matches(trimmed)) {
            return NormalizationResult(isValid = false, error = "Phone number contains invalid characters.")
        }

        // Reject duplicate plus signs
        if (trimmed.count { it == '+' } > 1) {
            return NormalizationResult(isValid = false, error = "Duplicate country prefix detected.")
        }

        val hasPlus = trimmed.startsWith("+")

        // Reject other country codes if international format used
        if (hasPlus && !trimmed.startsWith("+91")) {
            return NormalizationResult(isValid = false, error = "Only Indian mobile numbers (+91) are currently supported.")
        }

        val digitsOnly = trimmed.filter { it.isDigit() }
        if (digitsOnly.isEmpty()) {
            return NormalizationResult(isValid = false, error = "Phone number contains no digits.")
        }

        // Check for duplicate 91 prefixes, e.g. "91919876543210"
        if (digitsOnly.startsWith("9191") && digitsOnly.length == 14) {
            return NormalizationResult(isValid = false, error = "Duplicate country prefix detected.")
        }

        var subscriberDigits = digitsOnly

        if (hasPlus && subscriberDigits.startsWith("91")) {
            subscriberDigits = subscriberDigits.drop(2)
        } else if (!hasPlus && subscriberDigits.startsWith("91") && subscriberDigits.length == 12) {
            subscriberDigits = subscriberDigits.drop(2)
        }

        // Strip leading trunk zeroes "0"
        while (subscriberDigits.startsWith("0")) {
            subscriberDigits = subscriberDigits.drop(1)
        }

        if (subscriberDigits.length != 10) {
            return NormalizationResult(
                isValid = false,
                error = "Invalid phone number length (${subscriberDigits.length} digits). Indian mobile numbers must have exactly 10 digits."
            )
        }

        val firstDigit = subscriberDigits.first()
        if (firstDigit !in listOf('6', '7', '8', '9')) {
            return NormalizationResult(
                isValid = false,
                error = "Invalid Indian mobile number. Mobile numbers must begin with 6, 7, 8, or 9."
            )
        }

        val e164 = "+91$subscriberDigits"
        return NormalizationResult(
            isValid = true,
            e164 = e164,
            nationalNumber = subscriberDigits
        )
    }

    fun isValidIndianPhoneNumber(input: String?): Boolean {
        return normalizeIndianPhoneNumber(input).isValid
    }

    fun normalize(input: String?): NormalizationResult = normalizeIndianPhoneNumber(input)
    fun isValid(input: String?): Boolean = isValidIndianPhoneNumber(input)
}

package com.moodyorange.app.data.auth

import android.content.Context
import android.content.SharedPreferences
import com.moodyorange.app.BuildConfig
import com.moodyorange.app.data.api.MoodyOrangeApiClient
import com.moodyorange.app.data.model.CustomerProfile
import com.moodyorange.app.data.model.CustomerSession
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

class AuthManager(
    private val context: Context,
    private val apiClient: MoodyOrangeApiClient
) {
    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val _sessionState = MutableStateFlow<CustomerSession?>(null)
    val sessionState: StateFlow<CustomerSession?> = _sessionState.asStateFlow()

    init {
        restoreSession()
    }

    private fun restoreSession() {
        val token = prefs.getString(KEY_TOKEN, null)
        val customerId = prefs.getString(KEY_CUSTOMER_ID, null)
        val phone = prefs.getString(KEY_PHONE, null)
        val fullName = prefs.getString(KEY_FULL_NAME, null)
        val expiresAt = prefs.getLong(KEY_EXPIRES_AT, 0L)

        if (!token.isNullOrBlank() && !customerId.isNullOrBlank() && !phone.isNullOrBlank()) {
            if (expiresAt == 0L || expiresAt > System.currentTimeMillis()) {
                _sessionState.value = CustomerSession(
                    accessToken = token,
                    customerId = customerId,
                    phone = phone,
                    fullName = fullName,
                    expiresAt = expiresAt
                )
            } else {
                logout()
            }
        }
    }

    private fun persistSession(session: CustomerSession) {
        prefs.edit()
            .putString(KEY_TOKEN, session.accessToken)
            .putString(KEY_CUSTOMER_ID, session.customerId)
            .putString(KEY_PHONE, session.phone)
            .putString(KEY_FULL_NAME, session.fullName)
            .putLong(KEY_EXPIRES_AT, session.expiresAt)
            .apply()
        _sessionState.value = session
    }

    fun logout() {
        prefs.edit().clear().apply()
        _sessionState.value = null
    }

    fun formatPhoneNumber(raw: String): String {
        val res = com.moodyorange.app.util.PhoneNumberUtil.normalizeIndianPhoneNumber(raw)
        return res.e164 ?: raw
    }

    fun isValidPhoneNumber(phone: String): Boolean {
        return com.moodyorange.app.util.PhoneNumberUtil.isValidIndianPhoneNumber(phone)
    }

    suspend fun requestOtp(phoneInput: String): Result<Boolean> = withContext(Dispatchers.IO) {
        val norm = com.moodyorange.app.util.PhoneNumberUtil.normalizeIndianPhoneNumber(phoneInput)
        if (!norm.isValid || norm.e164 == null) {
            return@withContext Result.failure(IllegalArgumentException(norm.error ?: "Please enter a valid 10-digit mobile number."))
        }
        val formatted = norm.e164

        val supabaseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')
        val anonKey = BuildConfig.SUPABASE_ANON_KEY

        var connection: HttpURLConnection? = null
        try {
            val url = URL("$supabaseUrl/auth/v1/otp")
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 5_000
                readTimeout = 8_000
                setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                setRequestProperty("apikey", anonKey)
                doOutput = true
            }

            val body = JSONObject().apply {
                put("phone", formatted)
            }.toString()

            OutputStreamWriter(connection.outputStream, "UTF-8").use {
                it.write(body)
                it.flush()
            }

            val code = connection.responseCode
            if (code in 200..299) {
                Result.success(true)
            } else {
                // If local dev/mock Supabase instance doesn't have an SMS provider configured
                if (BuildConfig.DEBUG && (code == 400 || code == 422 || code == 500)) {
                    Result.success(true)
                } else {
                    val err = connection.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                    Result.failure(Exception("Failed to send OTP: $err"))
                }
            }
        } catch (e: Exception) {
            // In local debug/test fallback mode
            if (BuildConfig.DEBUG) {
                Result.success(true)
            } else {
                Result.failure(e)
            }
        } finally {
            connection?.disconnect()
        }
    }

    suspend fun verifyOtp(phoneInput: String, tokenInput: String): Result<CustomerSession> = withContext(Dispatchers.IO) {
        val formatted = formatPhoneNumber(phoneInput)
        val token = tokenInput.trim()

        val supabaseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')
        val anonKey = BuildConfig.SUPABASE_ANON_KEY

        var connection: HttpURLConnection? = null
        try {
            val url = URL("$supabaseUrl/auth/v1/verify")
            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 5_000
                readTimeout = 8_000
                setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                setRequestProperty("apikey", anonKey)
                doOutput = true
            }

            val body = JSONObject().apply {
                put("type", "sms")
                put("phone", formatted)
                put("token", token)
            }.toString()

            OutputStreamWriter(connection.outputStream, "UTF-8").use {
                it.write(body)
                it.flush()
            }

            val code = connection.responseCode
            if (code in 200..299) {
                val responseText = connection.inputStream.bufferedReader().use { it.readText() }
                val root = JSONObject(responseText)
                val accessToken = root.getString("access_token")
                val expiresAtSec = root.optLong("expires_at", 0L)
                val userObj = root.getJSONObject("user")
                val customerId = userObj.getString("id")
                val userPhone = userObj.optString("phone", formatted)
                val metaObj = userObj.optJSONObject("user_metadata")
                val fullName = metaObj?.optString("full_name")

                val session = CustomerSession(
                    accessToken = accessToken,
                    customerId = customerId,
                    phone = userPhone,
                    fullName = if (fullName.isNullOrBlank()) null else fullName,
                    expiresAt = if (expiresAtSec > 0) expiresAtSec * 1000 else System.currentTimeMillis() + 86400_000L
                )
                persistSession(session)
                Result.success(session)
            } else {
                // In local dev fallback for testing
                if (BuildConfig.DEBUG && token.length == 6) {
                    val mockCustomerId = "cust_${formatted.filter { it.isDigit() }.takeLast(6)}"
                    val session = CustomerSession(
                        accessToken = "mock_customer_:$mockCustomerId:$formatted:Customer",
                        customerId = mockCustomerId,
                        phone = formatted,
                        fullName = "Boutique Guest",
                        expiresAt = System.currentTimeMillis() + 7 * 86400_000L
                    )
                    persistSession(session)
                    Result.success(session)
                } else {
                    val err = connection.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                    Result.failure(Exception("Verification failed: $err"))
                }
            }
        } catch (e: Exception) {
            if (BuildConfig.DEBUG && token.length == 6) {
                val mockCustomerId = "cust_${formatted.filter { it.isDigit() }.takeLast(6)}"
                val session = CustomerSession(
                    accessToken = "mock_customer_:$mockCustomerId:$formatted:Customer",
                    customerId = mockCustomerId,
                    phone = formatted,
                    fullName = "Boutique Guest",
                    expiresAt = System.currentTimeMillis() + 7 * 86400_000L
                )
                persistSession(session)
                Result.success(session)
            } else {
                Result.failure(e)
            }
        } finally {
            connection?.disconnect()
        }
    }

    suspend fun updateFullName(name: String): Result<CustomerProfile> = withContext(Dispatchers.IO) {
        val currentSession = _sessionState.value
            ?: return@withContext Result.failure(IllegalStateException("No customer session found"))

        val result = apiClient.updateProfile(name, currentSession.accessToken)
        result.onSuccess { profile ->
            val updatedSession = currentSession.copy(fullName = profile.fullName)
            persistSession(updatedSession)
        }
        result
    }

    companion object {
        private const val PREFS_NAME = "moody_orange_auth_prefs"
        private const val KEY_TOKEN = "access_token"
        private const val KEY_CUSTOMER_ID = "customer_id"
        private const val KEY_PHONE = "customer_phone"
        private const val KEY_FULL_NAME = "customer_full_name"
        private const val KEY_EXPIRES_AT = "token_expires_at"
    }
}


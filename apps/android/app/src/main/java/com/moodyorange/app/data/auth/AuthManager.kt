package com.moodyorange.app.data.auth

import android.content.Context
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
import java.net.ConnectException
import java.net.HttpURLConnection
import java.net.SocketTimeoutException
import java.net.URL
import java.net.UnknownHostException

class AuthManager(
    private val context: Context,
    private val apiClient: MoodyOrangeApiClient,
    candidateHosts: List<String>? = null,
    private val isDebug: Boolean = BuildConfig.DEBUG,
    supabaseBaseUrl: String = BuildConfig.SUPABASE_URL,
    private val anonKey: String = BuildConfig.SUPABASE_ANON_KEY
) {
    companion object {
        fun isServiceRoleKey(token: String?): Boolean {
            if (token.isNullOrBlank()) return false
            val lower = token.lowercase()
            if (lower.contains("service_role") || lower.contains("service-role")) {
                return true
            }
            try {
                val parts = token.split(".")
                if (parts.size >= 2) {
                    val payloadBytes = java.util.Base64.getUrlDecoder().decode(parts[1])
                    val payload = String(payloadBytes, java.nio.charset.StandardCharsets.UTF_8).lowercase()
                    if (payload.contains("\"role\":\"service_role\"") ||
                        payload.contains("\"role\": \"service_role\"") ||
                        payload.contains("'role':'service_role'") ||
                        payload.contains("'role': 'service_role'") ||
                        payload.contains("\"iss\":\"supabase-admin\"") ||
                        payload.contains("\"sub\":\"supabase-admin\"")) {
                        return true
                    }
                }
            } catch (_: Exception) {}
            return false
        }
    }

    private val secureStore = SecureSessionStore(context)

    private val _sessionState = MutableStateFlow<CustomerSession?>(null)
    val sessionState: StateFlow<CustomerSession?> = _sessionState.asStateFlow()

    @Volatile
    var activeSupabaseUrl: String

    val debugCandidateHosts: List<String>

    init {
        check(!isServiceRoleKey(anonKey)) {
            "Security violation: Supabase service_role key must never be used in Android client application."
        }
        val trimmed = supabaseBaseUrl.trimEnd('/')
        if (!isDebug) {
            check(trimmed.isNotBlank()) {
                "Production release builds require a configured SUPABASE_URL."
            }
            check(trimmed.startsWith("https://")) {
                "Production release builds require HTTPS SUPABASE_URL. Found: $trimmed"
            }
            val lower = trimmed.lowercase()
            check(!lower.contains("localhost") && !lower.contains("127.0.0.1") && !lower.contains("10.0.2.2")
                && !lower.contains("0.0.0.0") && !lower.contains(".local")
                && !lower.matches(Regex(""".*//(?:192\.168\.|10\.|172\.(?:1[6-9]|2[0-9]|3[01])\.).*"""))) {
                "Production release builds cannot point to local development hosts. Found: $trimmed"
            }
        }
        activeSupabaseUrl = trimmed

        debugCandidateHosts = if (isDebug) {
            (candidateHosts ?: listOf(
                activeSupabaseUrl,
                "http://10.0.2.2:54321",
                "http://127.0.0.1:54321",
                "http://localhost:54321"
            )).map { it.trimEnd('/') }.distinct()
        } else {
            emptyList()
        }

        restoreSession()
    }

    fun getCandidateEndpoints(): List<String> {
        return if (isDebug) {
            listOf(activeSupabaseUrl).plus(debugCandidateHosts).distinct()
        } else {
            listOf(activeSupabaseUrl)
        }
    }

    private fun restoreSession() {
        val token = secureStore.getAccessToken()
        val customerId = secureStore.getCustomerId()
        val phone = secureStore.getPhone()
        val fullName = secureStore.getFullName()
        val expiresAt = secureStore.getExpiresAt()

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
        secureStore.saveSession(
            token = session.accessToken,
            customerId = session.customerId,
            phone = session.phone,
            fullName = session.fullName,
            expiresAt = session.expiresAt
        )
        _sessionState.value = session
    }

    fun logout() {
        secureStore.clear()
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
        val anonKey = this@AuthManager.anonKey

        val candidates = getCandidateEndpoints()

        var lastException: Exception? = null

        for (base in candidates) {
            var connection: HttpURLConnection? = null
            try {
                val url = URL("$base/auth/v1/otp")
                connection = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 3_000
                    readTimeout = 6_000
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
                    activeSupabaseUrl = base
                    return@withContext Result.success(true)
                } else {
                    val err = connection.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                    val message = extractSupabaseErrorMessage(err, "Failed to send OTP (HTTP $code)")
                    return@withContext Result.failure(Exception(message))
                }
            } catch (e: Exception) {
                lastException = e
                val isNetworkError = e is ConnectException || e is SocketTimeoutException || e is UnknownHostException
                if (!isDebug || !isNetworkError) {
                    return@withContext Result.failure(e)
                }
            } finally {
                connection?.disconnect()
            }
        }

        Result.failure(lastException ?: Exception("Network error connecting to authentication service."))
    }

    suspend fun verifyOtp(phoneInput: String, tokenInput: String): Result<CustomerSession> = withContext(Dispatchers.IO) {
        val norm = com.moodyorange.app.util.PhoneNumberUtil.normalizeIndianPhoneNumber(phoneInput)
        if (!norm.isValid || norm.e164 == null) {
            return@withContext Result.failure(IllegalArgumentException(norm.error ?: "Please enter a valid 10-digit mobile number."))
        }
        val formatted = norm.e164
        val token = tokenInput.trim()
        val anonKey = this@AuthManager.anonKey

        val candidates = getCandidateEndpoints()

        var lastException: Exception? = null

        for (base in candidates) {
            var connection: HttpURLConnection? = null
            try {
                val url = URL("$base/auth/v1/verify")
                connection = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 3_000
                    readTimeout = 6_000
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
                    activeSupabaseUrl = base
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
                    return@withContext Result.success(session)
                } else {
                    val err = connection.errorStream?.bufferedReader()?.use { it.readText() } ?: ""
                    val message = extractSupabaseErrorMessage(err, "Invalid or expired OTP code.")
                    return@withContext Result.failure(Exception(message))
                }
            } catch (e: Exception) {
                lastException = e
                val isNetworkError = e is ConnectException || e is SocketTimeoutException || e is UnknownHostException
                if (!isDebug || !isNetworkError) {
                    return@withContext Result.failure(e)
                }
            } finally {
                connection?.disconnect()
            }
        }

        Result.failure(lastException ?: Exception("Network error verifying OTP code."))
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

    private fun extractSupabaseErrorMessage(json: String, fallback: String): String {
        return try {
            val obj = JSONObject(json)
            obj.optString("msg")
                .takeIf { it.isNotBlank() }
                ?: obj.optString("error_description")
                    .takeIf { it.isNotBlank() }
                ?: obj.optString("message")
                    .takeIf { it.isNotBlank() }
                ?: fallback
        } catch (_: Exception) {
            fallback
        }
    }
}

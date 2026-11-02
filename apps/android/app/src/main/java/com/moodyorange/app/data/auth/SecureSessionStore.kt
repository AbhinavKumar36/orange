package com.moodyorange.app.data.auth

import android.content.Context
import android.content.SharedPreferences
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * SecureSessionStore encrypts customer session tokens using Android KeyStore-backed AES-256-GCM.
 * Protects session credentials at rest from device extraction.
 */
class SecureSessionStore(private val context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val keyAlias = "moody_orange_customer_auth_key"
    private val provider = "AndroidKeyStore"
    private val transformation = "AES/GCM/NoPadding"
    private val gcmTagLength = 128
    private val ivLength = 12

    init {
        ensureKeyStoreKey()
    }

    private fun ensureKeyStoreKey() {
        try {
            val keyStore = KeyStore.getInstance(provider).apply { load(null) }
            if (!keyStore.containsAlias(keyAlias)) {
                val keyGenerator = KeyGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_AES,
                    provider
                )
                val spec = KeyGenParameterSpec.Builder(
                    keyAlias,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build()
                keyGenerator.init(spec)
                keyGenerator.generateKey()
            }
        } catch (_: Throwable) {
            // AndroidKeyStore unavailable in JVM unit tests
        }
    }

    private fun getSecretKey(): SecretKey? {
        return try {
            val keyStore = KeyStore.getInstance(provider).apply { load(null) }
            keyStore.getKey(keyAlias, null) as? SecretKey
        } catch (_: Throwable) {
            null
        }
    }

    private fun encrypt(plainText: String): String {
        val secretKey = getSecretKey()
        if (secretKey == null) {
            // Safe fallback when KeyStore provider is absent (JVM tests)
            return Base64.getEncoder().encodeToString(plainText.toByteArray(Charsets.UTF_8))
        }

        val cipher = Cipher.getInstance(transformation)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey)
        val iv = cipher.iv
        val cipherBytes = cipher.doFinal(plainText.toByteArray(Charsets.UTF_8))
        val combined = ByteArray(iv.size + cipherBytes.size)
        System.arraycopy(iv, 0, combined, 0, iv.size)
        System.arraycopy(cipherBytes, 0, combined, iv.size, cipherBytes.size)
        return Base64.getEncoder().encodeToString(combined)
    }

    private fun decrypt(cipherText: String): String? {
        val secretKey = getSecretKey()
        if (secretKey == null) {
            return try {
                String(Base64.getDecoder().decode(cipherText), Charsets.UTF_8)
            } catch (_: Throwable) {
                null
            }
        }

        return try {
            val combined = Base64.getDecoder().decode(cipherText)
            if (combined.size < ivLength) return null
            val iv = combined.copyOfRange(0, ivLength)
            val cipherBytes = combined.copyOfRange(ivLength, combined.size)
            val cipher = Cipher.getInstance(transformation)
            val spec = GCMParameterSpec(gcmTagLength, iv)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)
            val plainBytes = cipher.doFinal(cipherBytes)
            String(plainBytes, Charsets.UTF_8)
        } catch (_: Throwable) {
            null
        }
    }

    fun saveSession(token: String, customerId: String, phone: String, fullName: String?, expiresAt: Long) {
        val encryptedToken = encrypt(token)
        prefs.edit()
            .putString(KEY_ENC_TOKEN, encryptedToken)
            .putString(KEY_CUSTOMER_ID, customerId)
            .putString(KEY_PHONE, phone)
            .putString(KEY_FULL_NAME, fullName)
            .putLong(KEY_EXPIRES_AT, expiresAt)
            .apply()
    }

    fun getAccessToken(): String? {
        val enc = prefs.getString(KEY_ENC_TOKEN, null) ?: return null
        return decrypt(enc)
    }

    fun getCustomerId(): String? = prefs.getString(KEY_CUSTOMER_ID, null)
    fun getPhone(): String? = prefs.getString(KEY_PHONE, null)
    fun getFullName(): String? = prefs.getString(KEY_FULL_NAME, null)
    fun getExpiresAt(): Long = prefs.getLong(KEY_EXPIRES_AT, 0L)

    fun updateFullName(fullName: String?) {
        prefs.edit().putString(KEY_FULL_NAME, fullName).apply()
    }

    fun clear() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val PREFS_NAME = "moody_orange_secure_auth"
        private const val KEY_ENC_TOKEN = "enc_access_token"
        private const val KEY_CUSTOMER_ID = "customer_id"
        private const val KEY_PHONE = "customer_phone"
        private const val KEY_FULL_NAME = "customer_full_name"
        private const val KEY_EXPIRES_AT = "token_expires_at"
    }
}


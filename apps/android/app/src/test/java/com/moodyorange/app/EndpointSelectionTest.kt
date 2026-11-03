package com.moodyorange.app

import com.moodyorange.app.data.api.MoodyOrangeApiClient
import com.moodyorange.app.data.auth.AuthManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class EndpointSelectionTest {

    @Test
    fun testDebugDefaultCandidateEndpointsIncludeEmulatorAndLocalhost() {
        val client = MoodyOrangeApiClient(
            baseUrl = "http://10.0.2.2:4000/api/v1",
            isDebug = true
        )
        val endpoints = client.getCandidateEndpoints()
        assertTrue("Must include Android emulator loopback 10.0.2.2", endpoints.contains("http://10.0.2.2:4000/api/v1"))
        assertTrue("Must include USB reverse / local host 127.0.0.1", endpoints.contains("http://127.0.0.1:4000/api/v1"))
        assertTrue("Must include localhost", endpoints.contains("http://localhost:4000/api/v1"))
    }

    @Test
    fun testExplicitLanIpInDebugCandidates() {
        val explicitLan = "http://192.168.1.150:4000/api/v1"
        val client = MoodyOrangeApiClient(
            baseUrl = explicitLan,
            isDebug = true
        )
        val endpoints = client.getCandidateEndpoints()
        assertEquals(explicitLan, endpoints.first())
        assertTrue("Must include explicit LAN host", endpoints.contains(explicitLan))
        assertTrue("Must still provide fallback to 10.0.2.2", endpoints.contains("http://10.0.2.2:4000/api/v1"))
        assertTrue("Must still provide fallback to 127.0.0.1 for USB reverse", endpoints.contains("http://127.0.0.1:4000/api/v1"))
    }

    @Test
    fun testHardcodedLanIpIsNotForcedInDefaultCandidates() {
        val client = MoodyOrangeApiClient(
            baseUrl = "http://10.0.2.2:4000/api/v1",
            isDebug = true
        )
        val endpoints = client.getCandidateEndpoints()
        assertFalse("Old developer hardcoded IP must not be present", endpoints.contains("http://192.168.29.197:4000/api/v1"))
    }

    @Test
    fun testReleaseModeNeverIncludesDevFallbacks() {
        val prodUrl = "https://api.orange-app.example/api/v1"
        val client = MoodyOrangeApiClient(
            baseUrl = prodUrl,
            isDebug = false
        )
        val endpoints = client.getCandidateEndpoints()
        assertEquals("Release mode must strictly have exactly 1 endpoint", 1, endpoints.size)
        assertEquals(prodUrl, endpoints[0])
        assertFalse("Must never include 10.0.2.2 in release", endpoints.contains("http://10.0.2.2:4000/api/v1"))
        assertFalse("Must never include 127.0.0.1 in release", endpoints.contains("http://127.0.0.1:4000/api/v1"))
        assertFalse("Must never include localhost in release", endpoints.contains("http://localhost:4000/api/v1"))
    }

    @Test
    fun testReleaseModeRejectsLocalhostAndInsecureEndpoints() {
        try {
            MoodyOrangeApiClient(baseUrl = "http://localhost:4000/api/v1", isDebug = false)
            fail("Expected exception for non-HTTPS URL in release mode")
        } catch (e: IllegalStateException) {
            assertTrue(e.message?.contains("HTTPS") == true)
        }

        try {
            MoodyOrangeApiClient(baseUrl = "https://10.0.2.2:4000/api/v1", isDebug = false)
            fail("Expected exception for local dev host in release mode")
        } catch (e: IllegalStateException) {
            assertTrue(e.message?.contains("local development hosts") == true)
        }

        try {
            MoodyOrangeApiClient(baseUrl = "https://127.0.0.1:4000/api/v1", isDebug = false)
            fail("Expected exception for 127.0.0.1 in release mode")
        } catch (e: IllegalStateException) {
            assertTrue(e.message?.contains("local development hosts") == true)
        }

        try {
            MoodyOrangeApiClient(baseUrl = "https://192.168.1.100:4000/api/v1", isDebug = false)
            fail("Expected exception for LAN IP in release mode")
        } catch (e: IllegalStateException) {
            assertTrue(e.message?.contains("local development hosts") == true)
        }

        try {
            MoodyOrangeApiClient(baseUrl = "https://backend.local:4000/api/v1", isDebug = false)
            fail("Expected exception for .local host in release mode")
        } catch (e: IllegalStateException) {
            assertTrue(e.message?.contains("local development hosts") == true)
        }

        try {
            MoodyOrangeApiClient(baseUrl = "", isDebug = false)
            fail("Expected exception for empty URL in release mode")
        } catch (e: IllegalStateException) {
            assertTrue(e.message?.contains("require a configured API base URL") == true)
        }
    }

    @Test
    fun testServiceRoleKeyDetection() {
        val rawServiceRole = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature"
        val anonToken = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.signature"

        assertTrue("Must detect service_role in JWT payload", AuthManager.isServiceRoleKey(rawServiceRole))
        assertTrue("Must detect plain service_role substring", AuthManager.isServiceRoleKey("supabase_service_role_key_secret"))
        assertFalse("Must allow anon key", AuthManager.isServiceRoleKey(anonToken))
    }

    @Test
    fun testSupabaseUrlRejectsLocalhostAndPort54321() {
        val prohibited = listOf(
            "http://10.0.2.2:54321",
            "http://localhost:54321",
            "http://127.0.0.1:54321",
            "https://10.0.2.2:54321",
            "https://localhost:54321",
            "https://127.0.0.1:54321",
            "https://192.168.1.100:54321"
        )
        for (url in prohibited) {
            try {
                AuthManager.validateSupabaseUrl(url)
                fail("Expected failure for local Supabase URL: $url")
            } catch (e: IllegalStateException) {
                assertTrue(e.message?.contains("prohibited") == true || e.message?.contains("HTTPS") == true)
            }
        }
    }

    @Test
    fun testSupabaseUrlRejectsNonHttps() {
        try {
            AuthManager.validateSupabaseUrl("http://myproject.supabase.co")
            fail("Expected failure for non-HTTPS hosted Supabase URL")
        } catch (e: IllegalStateException) {
            assertTrue(e.message?.contains("must use HTTPS") == true)
        }
    }

    @Test
    fun testSupabaseUrlAcceptsValidHostedHttps() {
        val valid = "https://abcxyzproject.supabase.co"
        val resolved = AuthManager.validateSupabaseUrl(valid)
        assertEquals(valid, resolved)
    }

    @Test
    fun testAnonKeyRejectsPlaceholderAndServiceRole() {
        val prohibitedKeys = listOf(
            "",
            "   ",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example_anon_key",
            "dummy_anon_key",
            "placeholder_key",
            "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature"
        )
        for (key in prohibitedKeys) {
            try {
                AuthManager.validateAnonKey(key)
                fail("Expected failure for prohibited anon key: $key")
            } catch (e: IllegalStateException) {
                assertTrue(e.message?.contains("required") == true ||
                    e.message?.contains("placeholder") == true ||
                    e.message?.contains("service_role") == true)
            }
        }
    }

    @Test
    fun testAnonKeyAcceptsValidKey() {
        val validKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIn0.valid_signature"
        AuthManager.validateAnonKey(validKey)
    }
}

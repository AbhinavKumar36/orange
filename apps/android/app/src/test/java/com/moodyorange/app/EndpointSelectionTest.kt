package com.moodyorange.app

import com.moodyorange.app.data.api.MoodyOrangeApiClient
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
    }
}

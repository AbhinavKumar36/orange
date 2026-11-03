import java.util.Properties
import java.io.FileInputStream
import java.net.NetworkInterface
import java.net.Inet4Address
import java.util.Base64
import java.nio.charset.StandardCharsets

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Safely load local development properties if present
val localProperties = Properties()
val localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    FileInputStream(localPropertiesFile).use { localProperties.load(it) }
}

// Dynamically resolve local host IP for development
// Prioritizes explicit DEV_HOST_IP / DEV_LAN_IP configuration for physical devices,
// and defaults to 10.0.2.2 for Android emulator out-of-the-box.
fun resolveDevHostIp(): String {
    val explicitHost = localProperties.getProperty("DEV_HOST_IP")
        ?: System.getenv("DEV_HOST_IP")
        ?: localProperties.getProperty("DEV_LAN_IP")
        ?: System.getenv("DEV_LAN_IP")
    if (!explicitHost.isNullOrBlank()) {
        return explicitHost.trim()
    }
    return "10.0.2.2"
}

val detectedHostIp = resolveDevHostIp()

// Local development settings (DEBUG builds only)
val debugApiBaseUrl: String = localProperties.getProperty("API_BASE_URL")
    ?: System.getenv("API_BASE_URL")
    ?: "http://$detectedHostIp:4000/api/v1/"

val debugSupabaseUrl: String = localProperties.getProperty("DEV_SUPABASE_URL")
    ?: localProperties.getProperty("SUPABASE_URL")
    ?: System.getenv("DEV_SUPABASE_URL")
    ?: System.getenv("SUPABASE_URL")
    ?: ""

val debugSupabaseAnonKey: String = localProperties.getProperty("DEV_SUPABASE_ANON_KEY")
    ?: localProperties.getProperty("SUPABASE_ANON_KEY")
    ?: System.getenv("DEV_SUPABASE_ANON_KEY")
    ?: System.getenv("SUPABASE_ANON_KEY")
    ?: ""

fun isServiceRoleKey(token: String?): Boolean {
    if (token.isNullOrBlank()) return false
    val lower = token.lowercase()
    if (lower.contains("service_role") || lower.contains("service-role")) {
        return true
    }
    try {
        val parts = token.split(".")
        if (parts.size >= 2) {
            val payloadBytes = Base64.getUrlDecoder().decode(parts[1])
            val payload = String(payloadBytes, StandardCharsets.UTF_8).lowercase()
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

fun validateDevConfig(supabaseUrl: String, anonKey: String) {
    val errors = mutableListOf<String>()
    if (supabaseUrl.isBlank()) {
        errors.add("Hosted development Supabase URL is required. Set DEV_SUPABASE_URL (or SUPABASE_URL) in local.properties or environment variable.")
    } else {
        if (!supabaseUrl.startsWith("https://")) {
            errors.add("Hosted development Supabase URL must use HTTPS. Found: '$supabaseUrl'")
        }
        val lower = supabaseUrl.lowercase()
        if (lower.contains("localhost") || lower.contains("127.0.0.1") || lower.contains("10.0.2.2") || lower.contains(":54321")) {
            errors.add("Local Supabase endpoints (localhost, 10.0.2.2, port 54321) are prohibited. Development must use a hosted Supabase project URL (https://<project-ref>.supabase.co). Found: '$supabaseUrl'")
        }
    }
    if (anonKey.isBlank()) {
        errors.add("Hosted development Supabase anon key is required. Set DEV_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY) in local.properties or environment variable.")
    } else {
        if (anonKey.contains("example_anon_key") || anonKey.contains("dummy") || anonKey.contains("placeholder")) {
            errors.add("Dummy or placeholder Supabase keys are prohibited. Configure a valid hosted development public anon key.")
        }
        if (isServiceRoleKey(anonKey)) {
            errors.add("SECURITY VIOLATION: DEV_SUPABASE_ANON_KEY is a Supabase service_role key! Never use service-role keys in Android app.")
        }
    }
    if (errors.isNotEmpty()) {
        throw GradleException("Hosted development configuration validation failed:\n" + errors.joinToString("\n") { "  - $it" })
    }
}

if (isServiceRoleKey(debugSupabaseAnonKey)) {
    throw GradleException("SECURITY VIOLATION: DEV_SUPABASE_ANON_KEY is a Supabase service_role key! Never use service-role keys in Android app.")
}

// Production release settings - MUST be explicitly configured and non-placeholder
val prodApiBaseUrl: String? = localProperties.getProperty("PROD_API_BASE_URL")
    ?: System.getenv("PROD_API_BASE_URL")

val prodSupabaseUrl: String? = localProperties.getProperty("PROD_SUPABASE_URL")
    ?: System.getenv("PROD_SUPABASE_URL")

val prodSupabaseAnonKey: String? = localProperties.getProperty("PROD_SUPABASE_ANON_KEY")
    ?: System.getenv("PROD_SUPABASE_ANON_KEY")

fun validateProductionConfig(apiUrl: String?, supabaseUrl: String?, anonKey: String?) {
    val errors = mutableListOf<String>()
    val placeholders = listOf("example", "placeholder", "mock", "dummy", "moodyorange.com", "prod_supabase_anon_key", "change_me", "todo")

    fun isPlaceholder(v: String): Boolean {
        val lower = v.lowercase()
        return placeholders.any { lower.contains(it) }
    }

    fun isLocalHost(v: String): Boolean {
        val lower = v.lowercase()
        return lower.contains("localhost") || lower.contains("127.0.0.1") || lower.contains("10.0.2.2") ||
            lower.contains("0.0.0.0") || lower.contains(".local") || lower.contains("192.168.") ||
            lower.contains("10.") || lower.contains("172.")
    }

    if (apiUrl.isNullOrBlank()) {
        errors.add("PROD_API_BASE_URL is required for release builds (set in local.properties or PROD_API_BASE_URL env var).")
    } else if (!apiUrl.startsWith("https://")) {
        errors.add("PROD_API_BASE_URL must use HTTPS. Found: '$apiUrl'")
    } else if (isLocalHost(apiUrl)) {
        errors.add("PROD_API_BASE_URL cannot point to a local development host. Found: '$apiUrl'")
    } else if (isPlaceholder(apiUrl)) {
        errors.add("PROD_API_BASE_URL cannot be a placeholder or invented domain. Found: '$apiUrl'")
    }

    if (supabaseUrl.isNullOrBlank()) {
        errors.add("PROD_SUPABASE_URL is required for release builds (set in local.properties or PROD_SUPABASE_URL env var).")
    } else if (!supabaseUrl.startsWith("https://")) {
        errors.add("PROD_SUPABASE_URL must use HTTPS. Found: '$supabaseUrl'")
    } else if (isLocalHost(supabaseUrl)) {
        errors.add("PROD_SUPABASE_URL cannot point to a local development host. Found: '$supabaseUrl'")
    } else if (isPlaceholder(supabaseUrl)) {
        errors.add("PROD_SUPABASE_URL cannot be a placeholder or invented domain. Found: '$supabaseUrl'")
    }

    if (anonKey.isNullOrBlank()) {
        errors.add("PROD_SUPABASE_ANON_KEY is required for release builds (set in local.properties or PROD_SUPABASE_ANON_KEY env var).")
    } else if (isServiceRoleKey(anonKey)) {
        errors.add("SECURITY VIOLATION: PROD_SUPABASE_ANON_KEY is a Supabase service_role key. Service-role keys bypass Row-Level Security and must NEVER be embedded or distributed in client applications. Supply the public anon key only.")
    } else if (isPlaceholder(anonKey) || anonKey.length < 30 || !anonKey.contains(".")) {
        errors.add("PROD_SUPABASE_ANON_KEY must be a valid production client key (received placeholder or invalid string).")
    }

    if (errors.isNotEmpty()) {
        throw GradleException(
            "Release configuration validation failed:\n" + errors.joinToString("\n") { "  - $it" }
        )
    }
}

// Standalone verification tasks
tasks.register("validateDevConfig") {
    group = "verification"
    description = "Validates that hosted development Supabase URL and anon key are explicitly configured and not local or placeholder."
    doLast {
        validateDevConfig(debugSupabaseUrl, debugSupabaseAnonKey)
        logger.lifecycle("Hosted development configuration validation passed.")
    }
}

tasks.register("validateReleaseConfig") {
    group = "verification"
    description = "Validates that all production release URLs and keys are explicitly configured and not placeholders."
    doLast {
        validateProductionConfig(prodApiBaseUrl, prodSupabaseUrl, prodSupabaseAnonKey)
        logger.lifecycle("Production release configuration validation passed.")
    }
}

// Enforce debug validation during debug compilation and packaging
tasks.matching {
    it.name.startsWith("generateDebugBuildConfig") ||
    it.name.startsWith("assembleDebug")
}.configureEach {
    doFirst {
        validateDevConfig(debugSupabaseUrl, debugSupabaseAnonKey)
    }
}

// Enforce release validation during release compilation and packaging
tasks.matching {
    it.name.startsWith("generateReleaseBuildConfig") ||
    it.name.startsWith("assembleRelease") ||
    it.name.startsWith("bundleRelease") ||
    it.name.startsWith("packageRelease")
}.configureEach {
    doFirst {
        validateProductionConfig(prodApiBaseUrl, prodSupabaseUrl, prodSupabaseAnonKey)
    }
}

// Enforce release validation during release builds
gradle.taskGraph.whenReady {
    val isReleaseBuildRequested = allTasks.any { task ->
        val n = task.name
        n.startsWith("assembleRelease") || n.startsWith("bundleRelease") || n.startsWith("packageRelease")
    }
    if (isReleaseBuildRequested) {
        validateProductionConfig(prodApiBaseUrl, prodSupabaseUrl, prodSupabaseAnonKey)
    }
}

android {
    namespace = "com.moodyorange.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.moodyorange.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", "\"$debugApiBaseUrl\"")
            buildConfigField("String", "SUPABASE_URL", "\"$debugSupabaseUrl\"")
            buildConfigField("String", "SUPABASE_ANON_KEY", "\"$debugSupabaseAnonKey\"")
        }
        release {
            buildConfigField("String", "API_BASE_URL", "\"${prodApiBaseUrl ?: ""}\"")
            buildConfigField("String", "SUPABASE_URL", "\"${prodSupabaseUrl ?: ""}\"")
            buildConfigField("String", "SUPABASE_ANON_KEY", "\"${prodSupabaseAnonKey ?: ""}\"")
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    lint {
        abortOnError = true
        checkReleaseBuilds = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.coil.compose)
    debugImplementation(libs.androidx.ui.tooling)

    testImplementation(libs.junit)
    testImplementation(libs.json)
}

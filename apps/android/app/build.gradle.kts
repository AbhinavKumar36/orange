import java.util.Properties
import java.io.FileInputStream
import java.net.NetworkInterface
import java.net.Inet4Address

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

// Dynamically resolve local host LAN IP (for physical Android devices on the same Wi-Fi)
// Supports explicit DEV_HOST_IP / DEV_LAN_IP configuration, automatic LAN detection, and emulator 10.0.2.2 fallback
fun resolveDevHostIp(): String {
    val explicitHost = localProperties.getProperty("DEV_HOST_IP")
        ?: System.getenv("DEV_HOST_IP")
        ?: localProperties.getProperty("DEV_LAN_IP")
        ?: System.getenv("DEV_LAN_IP")
    if (!explicitHost.isNullOrBlank()) {
        return explicitHost.trim()
    }

    try {
        val interfaces = NetworkInterface.getNetworkInterfaces()
        while (interfaces != null && interfaces.hasMoreElements()) {
            val iface = interfaces.nextElement()
            if (iface.isLoopback || !iface.isUp) continue
            val addresses = iface.inetAddresses
            while (addresses.hasMoreElements()) {
                val addr = addresses.nextElement()
                if (addr is Inet4Address && !addr.isLoopbackAddress) {
                    val host = addr.hostAddress
                    if (host != null && (host.startsWith("192.168.") || host.startsWith("10.") || host.startsWith("172."))) {
                        return host
                    }
                }
            }
        }
    } catch (_: Exception) {}
    return "10.0.2.2"
}

val detectedHostIp = resolveDevHostIp()

// Local development settings (DEBUG builds only)
val debugApiBaseUrl: String = localProperties.getProperty("API_BASE_URL")
    ?: System.getenv("API_BASE_URL")
    ?: "http://$detectedHostIp:4000/api/v1/"

val debugSupabaseUrl: String = localProperties.getProperty("SUPABASE_URL")
    ?: System.getenv("SUPABASE_URL")
    ?: "http://$detectedHostIp:54321"

val debugSupabaseAnonKey: String = localProperties.getProperty("SUPABASE_ANON_KEY")
    ?: System.getenv("SUPABASE_ANON_KEY")
    ?: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example_anon_key"

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
        return lower.contains("localhost") || lower.contains("127.0.0.1") || lower.contains("10.0.2.2")
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
    } else if (isPlaceholder(anonKey) || anonKey.length < 30) {
        errors.add("PROD_SUPABASE_ANON_KEY must be a valid production client key (received placeholder or invalid string).")
    }

    if (errors.isNotEmpty()) {
        throw GradleException(
            "Release configuration validation failed:\n" + errors.joinToString("\n") { "  - $it" }
        )
    }
}

// Standalone verification task
tasks.register("validateReleaseConfig") {
    group = "verification"
    description = "Validates that all production release URLs and keys are explicitly configured and not placeholders."
    doLast {
        validateProductionConfig(prodApiBaseUrl, prodSupabaseUrl, prodSupabaseAnonKey)
        logger.lifecycle("Production release configuration validation passed.")
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

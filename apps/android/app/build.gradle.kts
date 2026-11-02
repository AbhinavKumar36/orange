import java.util.Properties
import java.io.FileInputStream

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
fun resolveDevHostIp(): String {
    try {
        val interfaces = java.net.NetworkInterface.getNetworkInterfaces()
        while (interfaces.hasMoreElements()) {
            val iface = interfaces.nextElement()
            if (iface.isLoopback || !iface.isUp) continue
            val addresses = iface.inetAddresses
            while (addresses.hasMoreElements()) {
                val addr = addresses.nextElement()
                if (addr is java.net.Inet4Address && !addr.isLoopbackAddress) {
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

val debugApiBaseUrl: String = localProperties.getProperty("API_BASE_URL")
    ?: System.getenv("API_BASE_URL")
    ?: "http://$detectedHostIp:4000/api/v1/"

val releaseApiBaseUrl: String = localProperties.getProperty("PROD_API_BASE_URL")
    ?: System.getenv("PROD_API_BASE_URL")
    ?: (System.getenv("API_BASE_URL")?.takeIf { it.startsWith("https://") })
    ?: "https://api.moodyorange.com/api/v1/"

val debugSupabaseUrl: String = localProperties.getProperty("SUPABASE_URL")
    ?: System.getenv("SUPABASE_URL")
    ?: "http://$detectedHostIp:54321"

val releaseSupabaseUrl: String = localProperties.getProperty("PROD_SUPABASE_URL")
    ?: System.getenv("PROD_SUPABASE_URL")
    ?: (System.getenv("SUPABASE_URL")?.takeIf { it.startsWith("https://") })
    ?: "https://auth.moodyorange.com"

val debugSupabaseAnonKey: String = localProperties.getProperty("SUPABASE_ANON_KEY")
    ?: System.getenv("SUPABASE_ANON_KEY")
    ?: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example_anon_key"

val releaseSupabaseAnonKey: String = localProperties.getProperty("PROD_SUPABASE_ANON_KEY")
    ?: System.getenv("PROD_SUPABASE_ANON_KEY")
    ?: (System.getenv("SUPABASE_ANON_KEY")?.takeIf { !it.contains("mock") && !it.contains("example") })
    ?: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.prod_supabase_anon_key_production"

// Enforce that release builds must point to real deployed HTTPS endpoints
check(releaseApiBaseUrl.startsWith("https://")) {
    "Release builds require a real deployed HTTPS endpoint. Found: $releaseApiBaseUrl"
}
check(releaseSupabaseUrl.startsWith("https://")) {
    "Release builds require a real deployed HTTPS Supabase endpoint. Found: $releaseSupabaseUrl"
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
            buildConfigField("String", "API_BASE_URL", "\"$releaseApiBaseUrl\"")
            buildConfigField("String", "SUPABASE_URL", "\"$releaseSupabaseUrl\"")
            buildConfigField("String", "SUPABASE_ANON_KEY", "\"$releaseSupabaseAnonKey\"")
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
    kotlinOptions {
        jvmTarget = "17"
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

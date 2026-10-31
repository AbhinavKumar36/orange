# Moody Orange — Native Android Application

100% native Android application built with Kotlin and Jetpack Compose.

## Prerequisites
- Android Studio Ladybug (2024.2.1+) or newer
- JDK 17
- Android SDK 35 (compileSdk), minSdk 26

## Setup & Configuration
1. **SDK Path**:
   Android Studio automatically populates `sdk.dir` in `local.properties` based on your machine's installation. Do not commit machine-specific SDK paths to Git.
2. **API & Supabase Configuration**:
   Copy `local.properties.example` to `local.properties`:
   ```bash
   cp local.properties.example local.properties
   ```
   The Gradle build will automatically read `API_BASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `RAZORPAY_KEY_ID` from `local.properties` (or from environment variables in CI).
3. **Open in Android Studio**:
   Open `apps/android` directly in Android Studio. Gradle will sync automatically and prepare build targets.
   *(Note: Android emulator maps `10.0.2.2` to the host machine `localhost`).*

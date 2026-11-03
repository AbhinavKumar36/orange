# Moody Orange — Native Android Application

100% native Android application built with Kotlin and Jetpack Compose.

## Prerequisites
- Android Studio Ladybug (2024.2.1+) or newer
- JDK 17
- Android SDK 35 (compileSdk), minSdk 26

## Setup & Configuration
1. **SDK Path**:
   Android Studio automatically populates `sdk.dir` in `local.properties` based on your machine's installation. Do not commit machine-specific SDK paths to Git.
2. **Development Configuration**:
   Copy `local.properties.example` to `local.properties`:
   ```bash
   cp local.properties.example local.properties
   ```
   The Gradle build reads `API_BASE_URL`, `DEV_SUPABASE_URL`, and `DEV_SUPABASE_ANON_KEY` from `local.properties` (or from environment variables in CI).
   
   > [!IMPORTANT]
   > - Supabase is strictly hosted online (`https://<project-ref>.supabase.co`). Local Supabase (port 54321) is prohibited.
   > - The public client `anon` key must be used. NEVER place a `service_role` key in Android configuration.

3. **Backend API Networking (When Running API Server Locally)**:
   - **Android Emulator**: Set `API_BASE_URL=http://10.0.2.2:4000/api/v1/`.
   - **Physical Device via USB Reverse Tethering**: Run `npm run adb:reverse` (`adb reverse tcp:4000 tcp:4000`). The debug client automatically connects to `http://127.0.0.1:4000/api/v1/`.
   - **Physical Device over Local Wi-Fi**: Set `DEV_LAN_IP=<YOUR_PC_LAN_IP>` or `API_BASE_URL=http://<YOUR_PC_LAN_IP>:4000/api/v1/` in `local.properties`.

## Production Release Configuration Procedure (Fail-Closed)
Production release builds (`assembleRelease`, `bundleRelease`, `packageRelease`) enforce strict fail-closed validation:
1. **Required Release Variables**:
   - `PROD_API_BASE_URL`: Must be an authorized, HTTPS production API gateway (e.g., `https://api.moodyorange.com/api/v1/`).
   - `PROD_SUPABASE_URL`: Must be an authorized, HTTPS Supabase production URL (e.g., `https://<project-ref>.supabase.co`).
   - `PROD_SUPABASE_ANON_KEY`: Must be the project's **public anon key** (configured via Project Settings -> API).
2. **Critical Security Boundary**:
   - **Never include a Supabase `service_role` key in the Android app**. The build system rejects any key containing `service_role` or a JWT with role `service_role`.
   - Release builds reject non-HTTPS URLs, local development hosts (`localhost`, `127.0.0.1`, `10.0.2.2`), `.local` domains, and private RFC-1918 LAN IPs.
3. **Verification**:
   Run `./gradlew validateReleaseConfig` to verify production release settings without deploying.

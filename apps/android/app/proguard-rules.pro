# Moody Orange Android Proguard & R8 Optimization Rules

# 1. Preserve Application & Entry Points
-keep class com.moodyorange.app.MainActivity { *; }
-keep class com.moodyorange.app.BuildConfig { *; }

# 2. Preserve Data Models & JSON Serialization
-keep class com.moodyorange.app.data.model.** { *; }
-keepclassmembers class com.moodyorange.app.data.model.** {
    <fields>;
    <methods>;
}

# 3. Preserve ViewModels and State Interfaces
-keep class com.moodyorange.app.ui.viewmodel.** { *; }
-keepclassmembers class com.moodyorange.app.ui.viewmodel.** { *; }

# 4. Jetpack Compose Rules
-keepattributes *Annotation*,InnerClasses,EnclosingMethod
-dontwarn androidx.compose.**
-keepclassmembers class androidx.compose.** { *; }

# 5. Coil Image Loader Rules
-keep class coil.** { *; }
-dontwarn coil.**
-keep class okio.** { *; }
-dontwarn okio.**

# 6. Kotlin Coroutines Rules
-keepclassmembers class kotlinx.coroutines.** { *; }
-dontwarn kotlinx.coroutines.**

# 7. Keep standard Kotlin metadata and annotations
-keepattributes Signature
-keepattributes Exceptions
-keepclassmembers class * {
    @org.jetbrains.annotations.* <fields>;
}

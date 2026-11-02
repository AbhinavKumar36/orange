# Moody Orange Android Proguard Rules

# Preserve Kotlin data classes used for JSON serialization and reflection
-keepclassmembers class * {
    @org.jetbrains.annotations.* <fields>;
}

-keep class com.moodyorange.app.data.model.** { *; }
-keep class com.moodyorange.app.BuildConfig { *; }


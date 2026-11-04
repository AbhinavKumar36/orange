package com.moodyorange.app.data.theme

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

enum class ThemeMode(val title: String) {
    LIGHT("Light"),
    DARK("Dark"),
    SYSTEM("System")
}

/**
 * Manages customer theme preferences for Mangala Enterprises.
 * Synchronously loads initial preference from SharedPreferences on startup
 * to guarantee zero theme flash.
 */
class ThemeManager private constructor(context: Context) {

    private val prefs: SharedPreferences = context.applicationContext.getSharedPreferences(
        PREFS_NAME,
        Context.MODE_PRIVATE
    )

    private val _themeMode: MutableStateFlow<ThemeMode>

    init {
        val savedName = prefs.getString(KEY_THEME_MODE, ThemeMode.SYSTEM.name)
        val initialMode = try {
            ThemeMode.valueOf(savedName ?: ThemeMode.SYSTEM.name)
        } catch (_: Exception) {
            ThemeMode.SYSTEM
        }
        _themeMode = MutableStateFlow(initialMode)
    }

    val themeMode: StateFlow<ThemeMode> = _themeMode.asStateFlow()

    fun setThemeMode(mode: ThemeMode) {
        _themeMode.value = mode
        prefs.edit().putString(KEY_THEME_MODE, mode.name).apply()
    }

    fun toggleTheme(isCurrentlyDark: Boolean) {
        val nextMode = if (isCurrentlyDark) ThemeMode.LIGHT else ThemeMode.DARK
        setThemeMode(nextMode)
    }

    companion object {
        private const val PREFS_NAME = "mangala_theme_prefs"
        private const val KEY_THEME_MODE = "theme_mode"

        @Volatile
        private var instance: ThemeManager? = null

        fun getInstance(context: Context): ThemeManager {
            return instance ?: synchronized(this) {
                instance ?: ThemeManager(context).also { instance = it }
            }
        }
    }
}

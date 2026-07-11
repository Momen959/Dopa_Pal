import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { THEMES, applyTheme, getActiveThemeId } from '../themes';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    return getActiveThemeId();
  });

  // Keep track of the active theme object
  const activeTheme = THEMES.find(t => t.id === themeId) || THEMES[0];

  // Apply theme initially and when themeId changes
  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  // Fetch settings from backend on mount to sync theme
  useEffect(() => {
    api.getUserSettings()
      .then(data => {
        if (data?.theme) {
          setThemeId(data.theme);
          localStorage.setItem('dopapal_active_theme_v3', data.theme);
        }
      })
      .catch(() => {
        // Fallback silently
      });
  }, []);

  const changeTheme = useCallback(async (newThemeId) => {
    setThemeId(newThemeId);
    localStorage.setItem('dopapal_active_theme_v3', newThemeId);
    applyTheme(newThemeId);
    try {
      await api.updateUserSettings({ theme: newThemeId });
    } catch (e) {
      console.warn('Could not persist theme to backend:', e);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    changeTheme(themeId === 'default' ? 'calmed-light' : 'default');
  }, [themeId, changeTheme]);

  return (
    <ThemeContext.Provider value={{ theme: activeTheme, changeTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

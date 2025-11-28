
import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppTheme, ThemeId } from '../types';
import { themes } from '../lib/themes';

interface ThemeContextType {
    theme: AppTheme;
    setThemeId: (id: ThemeId) => void;
    availableThemes: AppTheme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [themeId, setThemeId] = useState<ThemeId>('cyberpunk');

    useEffect(() => {
        const saved = localStorage.getItem('genesis_theme');
        if (saved && themes[saved]) {
            setThemeId(saved as ThemeId);
        }
    }, []);

    const handleSetTheme = (id: ThemeId) => {
        setThemeId(id);
        localStorage.setItem('genesis_theme', id);
    };

    const value = {
        theme: themes[themeId],
        setThemeId: handleSetTheme,
        availableThemes: Object.values(themes)
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

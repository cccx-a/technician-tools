import { createSignal, createEffect } from 'solid-js';

export type Theme = 'light' | 'dark' | 'gruvbox' | 'orange';

const getInitialTheme = (): Theme => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme && ['light', 'dark', 'gruvbox', 'orange'].includes(savedTheme)) {
        return savedTheme;
    }
    // Default to orange theme (Toyota/Liftngo style)
    return 'orange';
};

const [theme, setTheme] = createSignal<Theme>(getInitialTheme());

createEffect(() => {
    const currentTheme = theme();
    localStorage.setItem('theme', currentTheme);

    // Remove all theme classes first
    document.documentElement.classList.remove('light', 'dark', 'gruvbox', 'orange');
    // Add current theme class
    document.documentElement.classList.add(currentTheme);
});

export const useTheme = () => {
    const toggleTheme = () => {
        setTheme(prev => {
            if (prev === 'light') return 'dark';
            if (prev === 'dark') return 'gruvbox';
            if (prev === 'gruvbox') return 'orange';
            return 'light';
        });
    };

    return { theme, toggleTheme };
};

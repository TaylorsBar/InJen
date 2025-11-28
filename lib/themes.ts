
import { AppTheme } from "../types";

export const themes: Record<string, AppTheme> = {
    cyberpunk: {
        id: 'cyberpunk',
        name: 'Genesis Cyan',
        colors: {
            primary: 'text-cyan-400',
            secondary: 'text-slate-400',
            accent: 'text-cyan-300',
            border: 'border-cyan-500/30',
            bg: 'bg-slate-900/80',
            glow: 'box-glow-cyan',
            button: 'bg-cyan-600',
            buttonHover: 'hover:bg-cyan-500',
            icon: 'text-cyan-400'
        },
        backgroundStyle: { type: 'nebula' }
    },
    rosso: {
        id: 'rosso',
        name: 'Maranello Red',
        colors: {
            primary: 'text-red-500',
            secondary: 'text-zinc-400',
            accent: 'text-red-400',
            border: 'border-red-600/40',
            bg: 'bg-zinc-900/90',
            glow: 'box-glow-red',
            button: 'bg-red-700',
            buttonHover: 'hover:bg-red-600',
            icon: 'text-red-500'
        },
        backgroundStyle: { type: 'carbon' }
    },
    trackday: {
        id: 'trackday',
        name: 'Track Day Amber',
        colors: {
            primary: 'text-amber-400',
            secondary: 'text-slate-400',
            accent: 'text-amber-300',
            border: 'border-amber-500/40',
            bg: 'bg-slate-950/80',
            glow: 'shadow-[0_0_15px_rgba(251,191,36,0.3)]',
            button: 'bg-amber-600',
            buttonHover: 'hover:bg-amber-500',
            icon: 'text-amber-400'
        },
        backgroundStyle: { type: 'carbon' }
    },
    synthwave: {
        id: 'synthwave',
        name: 'Miami Vice',
        colors: {
            primary: 'text-fuchsia-400',
            secondary: 'text-violet-300',
            accent: 'text-pink-400',
            border: 'border-fuchsia-500/50',
            bg: 'bg-purple-950/70',
            glow: 'shadow-[0_0_20px_rgba(232,121,249,0.5)]',
            button: 'bg-fuchsia-600',
            buttonHover: 'hover:bg-fuchsia-500',
            icon: 'text-fuchsia-400'
        },
        backgroundStyle: { type: 'grid' }
    },
    stealth: {
        id: 'stealth',
        name: 'Stealth Ops',
        colors: {
            primary: 'text-emerald-500',
            secondary: 'text-gray-500',
            accent: 'text-emerald-400',
            border: 'border-emerald-900/50',
            bg: 'bg-black/90',
            glow: 'shadow-[0_0_10px_rgba(16,185,129,0.2)]',
            button: 'bg-emerald-800',
            buttonHover: 'hover:bg-emerald-700',
            icon: 'text-emerald-600'
        },
        backgroundStyle: { type: 'solid' }
    }
};

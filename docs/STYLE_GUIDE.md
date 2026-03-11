# Euchre App Style Guide & Theme System

This application uses a centralized Theme System built on Tailwind CSS and CSS Variables. This allows for easy reskinning (e.g. from "Whiteboard" to "Dark Mode" or "Vintage").

## Core Tokens

The theme is defined by semantic names rather than specific color values.

### Colors

| Token | CSS Variable | Description | Current Value (Whiteboard) |
|Filter|---|---|---|
| `bg-paper` | `--color-paper` | Main Application Background | White (`#ffffff`) |
| `bg-paper-dim` | `--color-paper-dim` | Secondary Backgrounds / Hovers | Slate-50 (`#f8fafc`) |
| `text-ink` | `--color-ink` | Primary Text & Borders | Slate-800 (`#1e293b`) |
| `text-ink-dim` | `--color-ink-dim` | Secondary Text | Slate-400 (`#94a3b8`) |
| `brand-primary` | `--color-brand` | Primary Action / Highlight | Emerald-500 (`#10b981`) |
| `brand-secondary`| `--color-brand-dim` | Hover states / lighter accents | Emerald-400 (`#34d399`) |
| `brand-accent` | `--color-accent` | Special Highlights (e.g. Trump) | Cyan-400 / Purple-400 |

### Fonts

| Token | Description | Value |
|---|---|---|
| `font-hand` | Main handwriting font | "Architects Daughter", cursive |

### Shadows (Sketchy Style)

The application uses "hard" offsets for shadows to mimic a hand-drawn look.

- `shadow-sketch-ink`: `4px 4px 0px 0px var(--color-ink)`
- `shadow-sketch-brand`: `4px 4px 0px 0px var(--color-brand-dim)`

## How to Reskin

1. Open `src/index.css`.
2. Modify the RGB values in the `:root` block.
3. The application will instantly reflect the new palette.

## Usage in Code

Always use semantic names:
- ✅ `bg-paper`
- ❌ `bg-white`

- ✅ `border-ink`
- ❌ `border-slate-800`

- ✅ `text-brand`
- ❌ `text-emerald-500`

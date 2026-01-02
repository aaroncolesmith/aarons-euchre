/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                paper: {
                    DEFAULT: 'rgb(var(--color-paper) / <alpha-value>)',
                    dim: 'rgb(var(--color-paper-dim) / <alpha-value>)',
                },
                ink: {
                    DEFAULT: 'rgb(var(--color-ink) / <alpha-value>)',
                    dim: 'rgb(var(--color-ink-dim) / <alpha-value>)',
                },
                brand: {
                    DEFAULT: 'rgb(var(--color-brand) / <alpha-value>)',
                    dim: 'rgb(var(--color-brand-dim) / <alpha-value>)',
                    dark: 'rgb(var(--color-brand-dark) / <alpha-value>)',
                },
                accent: 'rgb(var(--color-accent) / <alpha-value>)',
            },
            fontFamily: {
                hand: ['"Architects Daughter"', 'cursive'],
            },
            boxShadow: {
                'sketch-ink': '4px 4px 0px 0px rgb(var(--color-ink))',
                'sketch-ink-lg': '6px 6px 0px 0px rgb(var(--color-ink))',
                'sketch-brand': '4px 4px 0px 0px rgb(var(--color-brand) / 0.2)',
                'sketch-brand-strong': '6px 6px 0px 0px rgb(var(--color-brand))',
            }
        },
    },
    plugins: [],
}

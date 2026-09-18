/** Tailwind v4 loads this shared configuration via @config in app/globals.css. */
module.exports = {
  darkMode: ['class'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Arial', 'sans-serif'],
        serif: ['var(--font-editorial)', 'Georgia', 'serif'],
        display: ['var(--font-editorial)', 'Georgia', 'serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      colors: {
        canvas: '#ffffff',
        ink: '#171717',
        line: '#e5e5e5',
        editorial: {
          canvas: '#ffffff',
          ink: '#171717',
          muted: '#737373',
          line: '#e5e5e5',
          soft: '#fafafa',
          orange: '#f26935',
        },
        brand: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        status: {
          review: { DEFAULT: '#f4f0e5', foreground: '#79612e' },
          interview: { DEFAULT: '#eeedf5', foreground: '#625681' },
          accepted: { DEFAULT: '#edf4ee', foreground: '#426b51' },
          rejected: { DEFAULT: '#f8edef', foreground: '#914b55' },
          booked: { DEFAULT: '#f0f3f5', foreground: '#536575' },
        },
      },
      borderRadius: { xl: '0.625rem', '2xl': '0.75rem' },
      boxShadow: {
        card: 'none',
        popover: 'none',
        modal: 'none',
      },
    },
  },
}

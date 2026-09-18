/** Tailwind v4 loads this shared configuration via @config in app/globals.css. */
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Arial', 'sans-serif'],
        display: ['var(--font-editorial)', 'Georgia', 'serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      colors: {
        canvas: 'var(--background)',
        ink: 'var(--foreground)',
        line: 'var(--border)',
        brand: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        status: {
          review: { DEFAULT: '#f4f0e5', foreground: '#79612e' },
          interview: { DEFAULT: '#eeedf5', foreground: '#625681' },
          accepted: { DEFAULT: '#edf4ee', foreground: '#426b51' },
          rejected: { DEFAULT: '#f8edef', foreground: '#914b55' },
          booked: { DEFAULT: '#f0f3f5', foreground: '#536575' },
        },
      },
      borderRadius: { xl: '0.75rem', '2xl': '1rem' },
    },
  },
}

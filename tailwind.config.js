const defaultTheme = require("tailwindcss/defaultTheme")

/** Tailwind v4 loads this shared configuration via @config in app/globals.css. */
module.exports = {
  darkMode: ['class'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      colors: {
        canvas: 'var(--card)',
        ink: 'var(--foreground)',
        line: 'var(--border)',
        editorial: {
          canvas: 'var(--card)',
          ink: 'var(--foreground)',
          muted: 'var(--muted-foreground)',
          line: 'var(--border)',
          soft: 'var(--muted)',
          orange: 'var(--brand-orange)',
        },
        brand: { DEFAULT: 'var(--primary)', foreground: 'var(--primary-foreground)' },
        status: {
          review: { DEFAULT: 'var(--warning-subtle)', foreground: 'var(--warning)' },
          interview: { DEFAULT: 'var(--interview-subtle)', foreground: 'var(--interview)' },
          accepted: { DEFAULT: 'var(--success-subtle)', foreground: 'var(--success)' },
          rejected: { DEFAULT: 'var(--error-subtle)', foreground: 'var(--destructive)' },
          booked: { DEFAULT: 'var(--info-subtle)', foreground: 'var(--info)' },
        },
      },
      borderRadius: { xl: 'var(--oc-radius-lg)', '2xl': 'var(--oc-radius-xl)' },
      boxShadow: {
        card: 'var(--oc-shadow-surface)',
        popover: 'var(--oc-shadow-popover)',
        modal: 'var(--oc-shadow-modal)',
      },
    },
  },
}

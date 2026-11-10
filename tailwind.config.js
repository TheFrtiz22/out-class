/** Tailwind v4 loads this shared configuration via @config in app/globals.css. */
module.exports = {
  darkMode: ['class'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--oc-font-sans)'],
        mono: ['var(--oc-font-sans)'],
        serif: ['var(--oc-font-display)'],
        display: ['var(--oc-font-display)'],
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
      boxShadow: {
        card: 'var(--oc-elevation-surface)',
        popover: 'var(--oc-elevation-popover)',
        modal: 'var(--oc-elevation-modal)',
      },
    },
  },
}

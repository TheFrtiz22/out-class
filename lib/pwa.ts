// Installable-app colors (S1-7), mirrored from styles/tokens.css because the web app manifest and the
// theme-color meta tag cannot read CSS variables: --school-primary (UVA Blue) and the light canvas
// --background. tests/installable-app.test.cjs fails if they drift from the tokens.
export const PWA_THEME_COLOR = "#232d4b"
export const PWA_BACKGROUND_COLOR = "#f6f5f1"

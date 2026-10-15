/** Compatibility entry point for the observational, autoplay journey suite. */
const { verify } = require('./verify-autoplay-demos.cjs')
verify().catch(error => { console.error(error); process.exitCode = 1 })

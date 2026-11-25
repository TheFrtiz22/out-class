const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs')

test('the club header draws one rule between its figures and its actions',()=>{
  const css=fs.readFileSync('styles/product-components.css','utf8')
  assert.match(css,/\[data-product-shell\] \.oc-marketing-profile dl \+ \.oc-club-hero-actions \{ border-top: 0;/)
})

test('on a phone the club link icons are centred under the actions',()=>{
  const css=fs.readFileSync('components/clubs/profile-presentation.css','utf8')
  assert.match(css,/@media \(max-width:639px\) \{[^}]*\}\s*\.oc-club-hero-actions > ul \{ justify-content:center; \} \}/)
})

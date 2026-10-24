const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./helpers/voting-harness.cjs'),{clubLogoSource}=load('lib/club-assets.ts');
test('missing club artwork has no guessed URL; each inferred legacy source exists',()=>{
 assert.equal(clubLogoSource(null,'12345678-1234-1234-1234-123456789abc','CC'),'');assert.equal(clubLogoSource('  ',undefined,'Unknown'),'');for(const key of ['__proto__','constructor','toString'])assert.equal(clubLogoSource(null,key,'CC'),'');
 for(const id of ['vvf','mii','180-degrees','180-degrees-globe','enactus','enactus-wordmark'])assert.ok(fs.existsSync('public'+clubLogoSource(null,id,'CC')));
 assert.equal(clubLogoSource(null,undefined,'VVF'),'/logos/vvf.webp');assert.equal(clubLogoSource('/explicit/logo.png','vvf','VVF'),'/explicit/logo.png');
 const reference='club-assets/12345678-1234-1234-1234-123456789abc/12345678-1234-1234-1234-123456789abd.png';assert.equal(clubLogoSource(reference,'vvf','VVF',true),'/api/club-assets?reference='+encodeURIComponent(reference)+'&preview=1');
});
test('a club without artwork renders the existing accessible monogram without an image',()=>{
 const {ClubLogo}=require('./helpers/component-module.cjs').loadComponent('components/club-logo.tsx');const html=renderToStaticMarkup(React.createElement(ClubLogo,{clubId:'unknown-club',text:'CC',color:'#123456',alt:'Campus Club',size:'lg'}));assert.doesNotMatch(html,/<img|\/logos\//);assert.match(html,/role="img"/);assert.match(html,/aria-label="Campus Club"/);assert.match(html,/size-16/);assert.match(html,/>CC</);
});

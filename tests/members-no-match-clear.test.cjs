// A search that matches nobody leaves "No members match." with a way back to the full list.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','tests','organization-members-ui.test.cjs'),'utf8');
// Reuse the members UI harness exactly as its own tests build it.
const setup=src.slice(0,src.indexOf("\ntest("));
const {harness,nodes,button,fixture,setupWindow}=new Function('require','__dirname',setup+';return {harness,nodes,button,fixture,setupWindow}')(require,__dirname);

test('a search with no matches offers to clear it, and clearing brings the members back',async()=>{
 const restore=setupWindow();try{
  const h=harness({getOrganizationMemberManagement:async()=>fixture()});h.render();await h.flush();
  const search=nodes(h.render()).find(n=>n.type==='SearchField');
  search.props.onChange({target:{value:'nobody-by-this-name'}});
  let tree=h.render();
  assert.ok(JSON.stringify(tree).includes('No members match.'));
  const clear=button(tree,'Clear search and filters');
  assert.ok(clear,'the empty state offers a way back');
  clear.props.onClick();
  tree=h.render();
  assert.equal(JSON.stringify(tree).includes('No members match.'),false);
  assert.ok(button(tree,'Member details'));
 }finally{restore()}
});

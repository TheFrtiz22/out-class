// Match static UI strings to built feature chunks, independent of content hashes.
// These are public program assets; no request args or application data are read.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const markers={settings:'Make your club stand out.',meetings:'Agendas, resources, and attendance for your club.',scheduledDecisions:'No scheduled decisions.',rounds:'Previously viewed information cannot be recalled'};
function featureChunks(dist){const root=path.join(dist,'static/chunks'),files=fs.readdirSync(root,{recursive:true}).filter(f=>f.endsWith('.js')),map={};for(const[k,marker]of Object.entries(markers)){map[k]=files.filter(file=>fs.readFileSync(path.join(root,file),'utf8').includes(marker)).map(file=>'/_next/static/chunks/'+file.replaceAll(path.sep,'/'));assert.ok(map[k].length,k+' feature marker must exist in the built program')}return map}
module.exports={featureChunks};

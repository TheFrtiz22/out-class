// Own only the registered disposable server; never infer ownership from an empty
// platform-specific port inventory. Port availability is independently verified.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const alive=pid=>{try{process.kill(pid,0);return true}catch(e){if(e.code==='ESRCH')return false;throw e}};
function owned(pid,allowed){assert.ok(alive(pid),'Registered server is not alive');const cwd=process.platform==='linux'?fs.realpathSync('/proc/'+pid+'/cwd'):execFileSync('lsof',['-a','-p',String(pid),'-d','cwd','-Fn'],{encoding:'utf8'}).split('\n').find(x=>x.startsWith('n'))?.slice(1);assert.ok(cwd&&allowed.filter(p=>fs.existsSync(p)).map(p=>fs.realpathSync(p)).includes(fs.realpathSync(cwd)),'Refusing to stop a process outside owned runtime checkouts');return true;}
function available(port){return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',e=>e.code==='EADDRINUSE'?resolve(false):reject(e));server.listen(port,'127.0.0.1',()=>server.close(e=>e?reject(e):resolve(true)));});}
async function stop({port,pidFile,allowed}){
 if(!fs.existsSync(pidFile)){assert.ok(await available(port),'Occupied disposable port has no registered owner');return;}
 const pid=Number(fs.readFileSync(pidFile,'utf8'));assert.ok(Number.isInteger(pid)&&pid>1);
 if(!alive(pid)){assert.ok(await available(port),'Occupied disposable port has no live registered owner');fs.rmSync(pidFile);return;}
 owned(pid,allowed);process.kill(pid,'SIGTERM');
 for(let i=0;i<100;i++){if(!alive(pid)&&await available(port)){fs.rmSync(pidFile,{force:true});return;}await new Promise(r=>setTimeout(r,50));}
 if(alive(pid)){owned(pid,allowed);process.kill(pid,'SIGKILL');}
 for(let i=0;i<40;i++){if(!alive(pid)&&await available(port)){fs.rmSync(pidFile,{force:true});return;}await new Promise(r=>setTimeout(r,50));}
 throw Error('Owned server did not release its process and port');
}
module.exports={alive,owned,available,stop};

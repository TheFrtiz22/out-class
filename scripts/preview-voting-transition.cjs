// Synthetic, loopback-only review preview. Never connects to Auth/hosted data.
const {fixture}=require('../tests/helpers/voting-room-ui-fixture.cjs');
(async()=>{const f=await fixture();await f.h.create();await f.h.command('START');await f.h.command('OPEN_VOTING');await f.h.command('CLOSE_VOTING');console.log(`Synthetic leader preview: ${f.url}/voting/rooms/${f.h.scope.sessionId}?clubId=${f.clubId}&view=leader&actor=leader`);for(const event of ['SIGINT','SIGTERM'])process.once(event,async()=>{await f.close();process.exit(0)});})().catch(e=>{console.error(e);process.exitCode=1});

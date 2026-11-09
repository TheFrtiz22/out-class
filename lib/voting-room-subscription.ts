/** Existing voting transport is authorized polling, not a public broadcast topic.
 * A failed read clears sensitive state. No overlapping or out-of-order snapshots.
 * A read that has not settled after `stallAfter` ms is abandoned (its late result is discarded) and
 * reported as unavailable, so one hung request neither freezes the room nor silently shows stale data.
 * Consecutive failures or abandonments back the poll off (interval, 2x, 4x … capped at `maxInterval`);
 * a successful read resets it. Explicit refreshes (focus, after a command) are never delayed. */
/** Browser events that fire together (focus + visibilitychange on tab switch, online) trigger one refresh. */
export function coalescedRefresh(refresh:()=>unknown,windowMs=1000){let last=-Infinity;return ()=>{const now=Date.now();if(now-last<windowMs)return;last=now;void refresh();};}
export const votingRoomUnavailable="Voting room unavailable. Reconnect or retry; your last command may already be saved.";
export function votingRoomSubscription<T>(read:()=>Promise<T>,deliver:(value:T|null,error:string|null)=>void,interval=5000,stallAfter=Math.max(15000,interval*3),maxInterval=Math.max(30000,interval)) {
  let stopped=false,busy=false,again=false,generation=0,startedAt=0,failures=0,timer:ReturnType<typeof setTimeout>|undefined,watchdog:ReturnType<typeof setTimeout>|undefined;
  const delay=()=>failures?Math.min(maxInterval,interval*2**failures):interval;
  function schedule(){if(stopped)return;if(again){again=false;void refresh();}else timer=setTimeout(()=>void refresh(),delay());}
  function fail(){failures++;deliver(null,votingRoomUnavailable);}
  function abandon(){generation++;busy=false;clearTimeout(watchdog);fail();}
  async function refresh(){
    if(stopped)return;
    if(busy){
      if(Date.now()-startedAt<stallAfter){again=true;return;}
      abandon();
    }
    clearTimeout(timer);clearTimeout(watchdog);busy=true;startedAt=Date.now();const mine=++generation;
    watchdog=setTimeout(()=>{if(stopped||mine!==generation)return;abandon();schedule();},stallAfter);
    try { const value=await read();if(!stopped&&mine===generation){failures=0;deliver(value,null);} }
    catch { if(!stopped&&mine===generation)fail(); }
    finally { if(mine===generation){clearTimeout(watchdog);busy=false;schedule();} }
  }
  void refresh();
  return {refresh,close(){stopped=true;clearTimeout(timer);clearTimeout(watchdog);}};
}

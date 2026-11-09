/** Existing voting transport is authorized polling, not a public broadcast topic.
 * A failed read clears sensitive state. No overlapping or out-of-order snapshots.
 * A read that has not settled after `stallAfter` ms is abandoned (its late result is
 * discarded) so one hung request cannot freeze the room until a page reload. */
export function votingRoomSubscription<T>(read:()=>Promise<T>,deliver:(value:T|null,error:string|null)=>void,interval=5000,stallAfter=Math.max(15000,interval*3)) {
  let stopped=false,busy=false,again=false,generation=0,startedAt=0,timer:ReturnType<typeof setTimeout>|undefined,watchdog:ReturnType<typeof setTimeout>|undefined;
  function schedule(){if(stopped)return;if(again){again=false;void refresh();}else timer=setTimeout(()=>void refresh(),interval);}
  async function refresh(){
    if(stopped)return;
    if(busy){
      // A hung read is abandoned instead of blocking every later refresh.
      if(Date.now()-startedAt<stallAfter){again=true;return;}
      generation++;busy=false;
    }
    clearTimeout(timer);clearTimeout(watchdog);busy=true;startedAt=Date.now();const mine=++generation;
    watchdog=setTimeout(()=>{if(stopped||mine!==generation)return;generation++;busy=false;schedule();},stallAfter);
    try { const value=await read();if(!stopped&&mine===generation)deliver(value,null); }
    catch { if(!stopped&&mine===generation)deliver(null,"Voting room unavailable. Reconnect or retry; your last command may already be saved."); }
    finally { if(mine===generation){clearTimeout(watchdog);busy=false;schedule();} }
  }
  void refresh();
  return {refresh,close(){stopped=true;clearTimeout(timer);clearTimeout(watchdog);}};
}

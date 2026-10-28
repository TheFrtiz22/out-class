/** Existing voting transport is authorized polling, not a public broadcast topic.
 * A failed read clears sensitive state. No overlapping or out-of-order snapshots. */
export function votingRoomSubscription<T>(read:()=>Promise<T>,deliver:(value:T|null,error:string|null)=>void,interval=5000) {
  let stopped=false,busy=false,again=false,timer:ReturnType<typeof setTimeout>|undefined;
  async function refresh(){
    if(stopped)return;
    if(busy){again=true;return;}
    clearTimeout(timer);busy=true;
    try { const value=await read();if(!stopped)deliver(value,null); }
    catch { if(!stopped)deliver(null,"Voting room unavailable. Reconnect or retry; your last command may already be saved."); }
    finally { busy=false;if(!stopped){if(again){again=false;void refresh();}else timer=setTimeout(()=>void refresh(),interval);} }
  }
  void refresh();
  return {refresh,close(){stopped=true;clearTimeout(timer);}};
}

"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { respondToOffer } from "@/lib/workspace-api"
import { useAuth } from "@/contexts/auth-context"
import type { StudentApplication } from "./application-form"
export function RecruitmentOffer({application:app,onChanged,onMyClubs}:{application:StudentApplication;onChanged:()=>void;onMyClubs:()=>void}){
 const {refreshUser}=useAuth(),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const offer=app.recruitmentOffer;
 const status=offer?.status==="PENDING"&&new Date(offer.expiresAt)<=new Date()?"EXPIRED":offer?.status;
 async function respond(response:"ACCEPT"|"DECLINE"){
  if(busy)return;setBusy(true);setMessage("");
  try{const result=await respondToOffer(app.id,response);if(result.status==="INACTIVE_MEMBERSHIP"){setMessage("Your membership is inactive. Contact an organization owner about reinstatement; this offer cannot restore access.");return;}await refreshUser();onChanged();}
  catch{setMessage("Your response could not be saved. Refresh your status and try again.");}
  finally{setBusy(false);}
 }
 return <section className="mt-4 rounded-lg border bg-background p-4" aria-label="Club offer">
  {status==="PENDING"&&app.status==="ACCEPTED"?<><h3 className="font-semibold">Congratulations! Join {app.club.name}</h3><p className="mt-2 text-sm text-muted-foreground">Accept your offer to become a club member. Respond by {new Date(offer!.expiresAt).toLocaleDateString()}.</p><div className="mt-4 flex flex-wrap gap-2"><Button disabled={busy} onClick={()=>void respond("ACCEPT")}>Accept Offer</Button><Button variant="outline" disabled={busy} onClick={()=>void respond("DECLINE")}>Decline Offer</Button></div></>:status==="ACCEPTED"?<><p>Your offer was accepted. Your club membership is recorded.</p><Button className="mt-3" variant="outline" onClick={onMyClubs}>Open My Clubs</Button><p className="mt-2 text-xs text-muted-foreground">Current membership access is managed by the club.</p></>:<p className="text-sm text-muted-foreground">{status==="DECLINED"?"You declined this offer. Your accepted recruitment decision remains recorded.":status==="REVOKED"?"This offer has been rescinded. Contact the club with questions.":status==="EXPIRED"?"This offer has expired. Contact the club with questions.":"The club has not issued an offer on OutClass. Contact the club for joining instructions."}</p>}
  {message&&<p role="alert" className="mt-3 text-sm">{message}</p>}
 </section>
}

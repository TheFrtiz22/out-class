"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { decisionsHref } from "@/lib/voting-navigation";
import { hasPermission,type ClubAccess } from "@/lib/permissions";
import { canLeaveWorkspace } from "@/lib/product-navigation";
import { handleClubLink } from "@/lib/workspace-navigation";
import { SectionTabs } from "@/components/ui/section-tabs";

export function DecisionsNavigation({clubId,member}:{clubId:string;member:ClubAccess}){
  const voting=hasPermission(member,"applications.review")&&(["decisions.start","decisions.vote","decisions.view"] as const).some(p=>hasPermission(member,p));
  const params=useSearchParams(),tab=params.get("decisionTab")||(voting?"voting":"letters");
  // Decisions has two homes: the Voting room and Decision letters. Decision status filters live on Applicants.
  const items=[...(voting?[{id:"voting",label:"Voting room"}]:[]),...(hasPermission(member,"recruitment.manage")||hasPermission(member,"decisions.manage")?[{id:"letters",label:"Decision letters"}]:[])];
  return <SectionTabs label="Decisions navigation" className="mb-5" current={tab} items={items.map(item=>({id:item.id,label:item.label,href:decisionsHref(clubId,item.id as "voting"|"letters",params.toString())}))}
    onNavigate={(e,href)=>{if(!canLeaveWorkspace()){e.preventDefault();return;}handleClubLink(e,href);}}/>;
}

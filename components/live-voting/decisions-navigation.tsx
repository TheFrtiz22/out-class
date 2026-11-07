"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { decisionsHref } from "@/lib/voting-navigation";
import { hasPermission,type ClubAccess } from "@/lib/permissions";
import { canLeaveWorkspace } from "@/lib/product-navigation";
import { handleClubLink } from "@/lib/workspace-navigation";

export function DecisionsNavigation({clubId,member}:{clubId:string;member:ClubAccess}){
  const voting=hasPermission(member,"applications.review")&&(["decisions.start","decisions.vote","decisions.view"] as const).some(p=>hasPermission(member,p));
  const params=useSearchParams(),tab=params.get("decisionTab")||(voting?"voting":"letters");
  // Decisions has two homes: the Voting room and Decision letters. Decision status filters live on Applicants.
  const items=[...(voting?[{id:"voting",label:"Voting room"}]:[]),...(hasPermission(member,"recruitment.manage")||hasPermission(member,"decisions.manage")?[{id:"letters",label:"Decision letters"}]:[])];
  return <nav aria-label="Decisions navigation" className="mb-5 flex max-w-full gap-1 overflow-x-auto border-b pb-2">{items.map(item=><Link key={item.id} aria-current={tab===item.id?"page":undefined} className={`inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring ${tab===item.id?"bg-secondary font-medium text-primary":"text-muted-foreground hover:bg-secondary/60"}`} href={decisionsHref(clubId,item.id as "voting"|"letters",params.toString())} onClick={e=>{if(!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey&&e.button===0&&!canLeaveWorkspace()){e.preventDefault();return;}handleClubLink(e,decisionsHref(clubId,item.id as "voting"|"letters",params.toString()));}}>{item.label}</Link>)}</nav>;
}

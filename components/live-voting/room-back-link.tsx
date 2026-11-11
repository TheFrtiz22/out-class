"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { decisionsHref } from "@/lib/voting-navigation";
export function VotingBackLink({clubId,cycleId,roundId}:{clubId:string;cycleId?:string;roundId?:string}){
 const params=useSearchParams(),search=new URLSearchParams(params.toString());if(cycleId)search.set("cycleId",cycleId);if(roundId)search.set("roundId",roundId);
 return <Link className="vr-link inline-flex min-h-11 items-center text-sm" href={decisionsHref(clubId,"voting",search.toString())}>Back to Voting room</Link>;
}

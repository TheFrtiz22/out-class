"use client";
import * as room from "@/actions/voting-room";
import * as setup from "@/actions/voting-room-setup";
// Demo implementations load only while Demo Mode is active.
const demo = () => import("@/lib/demo/voting-room").catch((cause) => { throw new DemoUnavailableError(undefined, { cause }); });
import { demoGate } from "@/lib/demo/loader";
import { DemoUnavailableError } from "@/lib/demo/activation";
import * as finalization from "@/actions/voting-room-finalization";
import * as plans from '@/actions/voting-session-setup';
import * as targetSummary from "@/actions/voting-target-summary";
function planAction<K extends keyof typeof plans>(key:K){return (async(input:Parameters<(typeof plans)[K]>[0])=>(await demoGate())?(await demo()).sessionSetup(key,input):plans[key](input)) as (input:Parameters<(typeof plans)[K]>[0])=>ReturnType<(typeof plans)[K]>;}
export const listVotingSetupDrafts=planAction('listVotingSetupDrafts'),discardVotingSetupDraft=planAction('discardVotingSetupDraft'),getVotingSessionSetup=planAction('getVotingSessionSetup'),updateVotingSessionSetup=planAction('updateVotingSessionSetup'),cancelVotingSession=planAction('cancelVotingSession'),previewVotingSetup=planAction('previewVotingSetup');
function finalAction<K extends keyof typeof finalization>(key:K){return (async(input:Parameters<(typeof finalization)[K]>[0])=>{
 if((await demoGate()))return (await demo()).meeting(key,input);
 return finalization[key](input);
}) as (input:Parameters<(typeof finalization)[K]>[0])=>ReturnType<(typeof finalization)[K]>;}
export const getLiveVotingSummary=finalAction("getLiveVotingSummary"),previewLiveVotingFinalization=finalAction("previewLiveVotingFinalization"),finalizeLiveVotingRoom=finalAction("finalizeLiveVotingRoom"),sendLiveVotingNotifications=finalAction("sendLiveVotingNotifications");
function adapt<K extends keyof typeof room>(key:K){return (async(input:Parameters<(typeof room)[K]>[0],member?:string)=>{
  if((await demoGate()))return (await demo()).call(key,input,member);
  if(member)throw Error("Demo identity is unavailable in production.");
  return room[key](input);
}) as (input:Parameters<(typeof room)[K]>[0],member?:string)=>ReturnType<(typeof room)[K]>;}
export const getLiveVotingRoom=adapt("getLiveVotingRoom"),createLiveVotingRoom=adapt("createLiveVotingRoom"),listLiveVotingRooms=adapt("listLiveVotingRooms"),castLiveVotingBallot=adapt("castLiveVotingBallot"),commandLiveVotingRoom=adapt("commandLiveVotingRoom"),getLiveVotingPresentation=adapt("getLiveVotingPresentation");
export const getLiveVotingSetup=async(input:unknown)=>(await demoGate())?(await demo()).getSetup(input):setup.getLiveVotingSetup(input);
export const getVotingHighlightOptions=async(input:unknown)=>(await demoGate())?(await demo()).getHighlights(input):setup.getVotingHighlightOptions(input);
export const getLiveVotingJoinInfo=async(input:unknown,member?:string)=>{
  if((await demoGate()))return (await demo()).joinInfo(input,member);
  if(member)throw Error("Demo identity is unavailable in production.");return setup.getLiveVotingJoinInfo(input);
};
export const joinLiveVotingRoom=async(input:unknown,member?:string)=>{
  if((await demoGate()))return (await demo()).join(input,member);
  if(member)throw Error("Demo identity is unavailable in production.");return setup.joinLiveVotingRoom(input);
};

export const resolveLiveVotingSelection=async(input:unknown)=>(await demoGate())?(await demo()).resolveSelection(input):setup.resolveLiveVotingSelection(input);

/** Entire-round target and decision counts (counts only), Demo or live. */
export const getRoundTargetSummary=async(input:Parameters<typeof targetSummary.getRoundTargetSummary>[0])=>(await demoGate())?(await demo()).roundTargetSummary(input):targetSummary.getRoundTargetSummary(input);

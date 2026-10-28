"use client";
import * as room from "@/actions/voting-room";
import * as setup from "@/actions/voting-room-setup";
import * as demo from "@/lib/demo/voting-room";
import { demoStore } from "@/lib/demo/store";
import * as finalization from "@/actions/voting-room-finalization";
function finalAction<K extends keyof typeof finalization>(key:K){return (async(input:Parameters<(typeof finalization)[K]>[0])=>{
 if(demoStore.active())return demo.meeting(key,input);
 return finalization[key](input);
}) as (input:Parameters<(typeof finalization)[K]>[0])=>ReturnType<(typeof finalization)[K]>;}
export const getLiveVotingSummary=finalAction("getLiveVotingSummary"),previewLiveVotingFinalization=finalAction("previewLiveVotingFinalization"),finalizeLiveVotingRoom=finalAction("finalizeLiveVotingRoom"),sendLiveVotingNotifications=finalAction("sendLiveVotingNotifications");
function adapt<K extends keyof typeof room>(key:K){return (async(input:Parameters<(typeof room)[K]>[0],member?:string)=>{
  if(demoStore.active())return demo.call(key,input,member);
  if(member)throw Error("Demo identity is unavailable in production.");
  return room[key](input);
}) as (input:Parameters<(typeof room)[K]>[0],member?:string)=>ReturnType<(typeof room)[K]>;}
export const getLiveVotingRoom=adapt("getLiveVotingRoom"),createLiveVotingRoom=adapt("createLiveVotingRoom"),listLiveVotingRooms=adapt("listLiveVotingRooms"),castLiveVotingBallot=adapt("castLiveVotingBallot"),commandLiveVotingRoom=adapt("commandLiveVotingRoom"),getLiveVotingPresentation=adapt("getLiveVotingPresentation");
export const getLiveVotingSetup=async(input:unknown)=>demoStore.active()?demo.getSetup(input):setup.getLiveVotingSetup(input);
export const getVotingHighlightOptions=async(input:unknown)=>demoStore.active()?demo.getHighlights(input):setup.getVotingHighlightOptions(input);
export const getLiveVotingJoinInfo=async(input:unknown,member?:string)=>{
  if(demoStore.active())return demo.joinInfo(input,member);
  if(member)throw Error("Demo identity is unavailable in production.");return setup.getLiveVotingJoinInfo(input);
};
export const joinLiveVotingRoom=async(input:unknown,member?:string)=>{
  if(demoStore.active())return demo.join(input,member);
  if(member)throw Error("Demo identity is unavailable in production.");return setup.joinLiveVotingRoom(input);
};

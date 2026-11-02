import type {DemoState} from './seed';
export type VotingNotice={id:string;eventKey:string;userId:string;clubId:string;title:string;body:string;href:string;createdAt:Date};
export type VotingNotices={votingSessionNotices?:VotingNotice[]};
/** Local-only notification intent; never calls Auth, email or production actions. */
export function stageVotingNotices(state:DemoState,room:{id:string;clubId:string},requestId:string,userIds:string[],kind:'scheduled'|'updated'|'cancelled',name:string){
 const extra=state as VotingNotices;extra.votingSessionNotices??=[];const eventKey=`voting.session:${room.id}:${requestId}:${kind}`;
 for(const userId of new Set(userIds))if(!extra.votingSessionNotices.some(n=>n.eventKey===eventKey&&n.userId===userId))extra.votingSessionNotices.push({id:crypto.randomUUID(),eventKey,userId,clubId:room.clubId,title:kind==='cancelled'?'Voting session cancelled':kind==='updated'?'Voting session updated':'Voting session invitation',body:`${name}. Open the session for its current details.`,href:`/voting/rooms/${room.id}?clubId=${room.clubId}&view=member&demo=1`,createdAt:new Date()});
}

import {createHash} from "node:crypto";
/** Optimistic-concurrency token, never an authorization credential. Keeps
 * decision/version metadata out of anonymous-review projections. */
export function decisionPublicationGuard(app:{id:string;roundId:string;status:string;decisionVersion:number;decisionStateRevision:number}){
 return createHash("sha256").update(JSON.stringify([app.id,app.roundId,app.status,app.decisionVersion,app.decisionStateRevision])).digest("hex");
}

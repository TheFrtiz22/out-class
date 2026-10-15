import { timingSafeEqual } from "node:crypto";
import { processScheduledCommunications } from "@/utils/scheduled-communications";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request) {
 const secret=process.env.CRON_SECRET;
 const supplied=Buffer.from(request.headers.get("authorization")||"");
 const expected=Buffer.from(`Bearer ${secret}`);
 if(!secret||supplied.length!==expected.length||!timingSafeEqual(supplied,expected)) return Response.json({error:"Unauthorized"},{status:401});
 try {const result=await processScheduledCommunications();return Response.json(result,{status:result.claimErrors?503:200,headers:{"Cache-Control":"no-store"}});}
 catch {return Response.json({error:"Scheduled publication unavailable. Work is retained."},{status:503});}
}
export const GET=POST;

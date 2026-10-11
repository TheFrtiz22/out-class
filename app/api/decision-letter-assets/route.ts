import { NextRequest,NextResponse } from 'next/server';
import { getDecisionLetter } from '@/actions/communications';
import { clubAssetReference } from '@/lib/club-assets';
import { privateClubAssetStorage } from '@/utils/club-asset-storage';
export async function GET(request:NextRequest){
 const missing=()=>new NextResponse(null,{status:404,headers:{'Cache-Control':'private, no-store'}});
 try{
  const p=request.nextUrl.searchParams;if([...p.keys()].some(k=>!['applicationId','letterId'].includes(k))||p.getAll('applicationId').length!==1||p.getAll('letterId').length!==1)return missing();
  const read=()=>getDecisionLetter(p.get('applicationId')!,p.get('letterId')!);
  const letter=await read(),reference=letter?.letter.content.logoReference;
  if(!reference||!clubAssetReference.safeParse(reference).success||reference.split('/')[1]!==letter.clubId)return missing();
  const {data,error}=await(await privateClubAssetStorage()).download(reference.slice(12));
  if(error||!data||(await read())?.letter.content.logoReference!==reference)return missing();
  return new NextResponse(await data.arrayBuffer(),{headers:{'Content-Type':reference.endsWith('.jpg')?'image/jpeg':reference.endsWith('.png')?'image/png':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }catch{return missing();}
}

import { DecisionLetterView } from '@/components/communications/decision-letter';
export default async function Page({params}:{params:Promise<{applicationId:string}>}){const {applicationId}=await params;return <DecisionLetterView applicationId={applicationId}/>;}

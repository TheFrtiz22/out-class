import { z } from "zod";
export const decisionTypes = ['ACCEPTED', 'WAITLISTED', 'REJECTED'] as const;
export type LetterDecision = typeof decisionTypes[number];
export const letterVariables = ['student.firstName','student.fullName','club.name','decision.date','offer.expiresAt'] as const;
const text = (max: number) => z.string().trim().max(max).superRefine((value, ctx) => {
  const remaining = value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (token, key) => {
    if (!(letterVariables as readonly string[]).includes(key)) ctx.addIssue({ code:'custom', message:`Unknown variable: ${key}` });
    return '';
  });
  if (/[{}]/.test(remaining)) ctx.addIssue({code:'custom',message:'Use only the documented {{variable}} placeholders.'});
});
/** Celebration a club picks for acceptance letters. Snapshotted into each published letter. */
export const celebrationKinds = ['confetti','fireworks','sparkles','none'] as const;
export type CelebrationKind = typeof celebrationKinds[number];
export const defaultCelebration: CelebrationKind = 'confetti';
export const celebrationLabels: Record<CelebrationKind,string> = { confetti:'Confetti', fireworks:'Fireworks', sparkles:'Sparkles', none:'None' };
export const letterTemplateSchema = z.object({ title:text(160).pipe(z.string().min(1)), body:text(6000).pipe(z.string().min(1)), closing:text(300), signer:text(160), footer:text(1000), celebration:z.enum(celebrationKinds).optional() }).strict();
export type LetterTemplate = z.infer<typeof letterTemplateSchema>;
export const letterTemplatesSchema = z.object({ ACCEPTED:letterTemplateSchema.optional(), WAITLISTED:letterTemplateSchema.optional(), REJECTED:letterTemplateSchema.optional() }).strict();
export const defaultLetters: Record<LetterDecision,LetterTemplate> = {
 ACCEPTED:{title:'Congratulations, and welcome to {{club.name}}',body:'On behalf of everyone at {{club.name}}, it is our great pleasure to offer you membership. Congratulations!\n\nYour application, and the care and thought you brought to every stage of recruitment, stood out to us. We are genuinely excited about the perspective, curiosity, and energy you will bring to our community.\n\nPlease review your offer below and respond by {{offer.expiresAt}}. We very much hope you will say yes, and we look forward to welcoming you.',closing:'With warm congratulations,',signer:'{{club.name}}',footer:'',celebration:'confetti'},
 WAITLISTED:{title:'Your recruitment decision',body:'Thank you for your interest in {{club.name}} and for the time you devoted to your application.\n\nWe are writing to let you know that you have been placed on our waitlist. We appreciate the opportunity to learn about you. A place on the waitlist does not guarantee a future offer of membership.\n\nIf your decision changes, we will share an update through OutClass. Thank you for your patience and continued interest.',closing:'Sincerely,',signer:'{{club.name}}',footer:''},
 REJECTED:{title:'Your recruitment decision',body:'Thank you for your interest in {{club.name}} and for sharing your time and experiences with us.\n\nAfter careful consideration, we are unable to offer you membership through this recruitment process. We recognize the effort that goes into applying and appreciate the opportunity to learn about you.\n\nWe wish you every success in finding communities and opportunities that inspire you.',closing:'Sincerely,',signer:'{{club.name}}',footer:''},
};
export type LetterContent = Omit<LetterTemplate,'celebration'> & { celebration?:CelebrationKind; studentName:string; clubName:string; logoReference:string|null; accent:string; date:string };
export function resolveLetter(decision:LetterDecision, templates:unknown, values:{firstName:string;fullName:string;clubName:string;date:Date;expiresAt:Date|null;logoReference:string|null;accent:string}):LetterContent {
 const parsed=letterTemplatesSchema.safeParse(templates ?? {});
 const template=parsed.success ? parsed.data[decision] ?? defaultLetters[decision] : defaultLetters[decision];
 const date=values.date.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'});
 const variables:Record<string,string>={'student.firstName':values.firstName,'student.fullName':values.fullName,'club.name':values.clubName,'decision.date':date,'offer.expiresAt':values.expiresAt?.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}) ?? 'the deadline shown with your offer'};
 const render=(value:string)=>value.replace(/\{\{\s*([\w.]+)\s*\}\}/g,(_,key)=>variables[key] ?? '');
 const {celebration,...copy}=template;
 return {...Object.fromEntries(Object.entries(copy).map(([key,value])=>[key,render(value)])) as Omit<LetterTemplate,'celebration'>,...(decision==='ACCEPTED'?{celebration:celebration ?? defaultCelebration}:{}),studentName:values.fullName,clubName:values.clubName,logoReference:values.logoReference,accent:/^#[\da-f]{6}$/i.test(values.accent)?values.accent:'#142d4e',date};
}
export const decisionDestination=(id:string,letterId?:string)=>`/applications/${encodeURIComponent(id)}/decision${letterId ? "?letterId="+encodeURIComponent(letterId) : ""}`;
/** Published letters before celebrations existed have no field: acceptances fall back to the default. */
export function letterCelebration(decision:string|undefined,content:Pick<LetterContent,'celebration'>):CelebrationKind {
 if (decision!=='ACCEPTED') return 'none';
 return (celebrationKinds as readonly string[]).includes(content.celebration ?? '') ? content.celebration! : defaultCelebration;
}

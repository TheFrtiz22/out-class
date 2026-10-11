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
export const letterTemplateSchema = z.object({ title:text(160).pipe(z.string().min(1)), body:text(6000).pipe(z.string().min(1)), closing:text(300), signer:text(160), footer:text(1000) }).strict();
export type LetterTemplate = z.infer<typeof letterTemplateSchema>;
export const letterTemplatesSchema = z.object({ ACCEPTED:letterTemplateSchema.optional(), WAITLISTED:letterTemplateSchema.optional(), REJECTED:letterTemplateSchema.optional() }).strict();
export const defaultLetters: Record<LetterDecision,LetterTemplate> = {
 ACCEPTED:{title:'An invitation to join {{club.name}}',body:'It is our pleasure to offer you membership in {{club.name}}. Thank you for the care and thought you brought to the recruitment process.\n\nWe look forward to the perspective, curiosity, and energy you will bring to our community. Please review your offer below and respond by {{offer.expiresAt}}.\n\nWe hope you will join us.',closing:'Sincerely,',signer:'{{club.name}}',footer:''},
 WAITLISTED:{title:'Your recruitment decision',body:'Thank you for your interest in {{club.name}} and for the time you devoted to your application.\n\nWe are writing to let you know that you have been placed on our waitlist. We appreciate the opportunity to learn about you. A place on the waitlist does not guarantee a future offer of membership.\n\nIf your decision changes, we will share an update through OutClass. Thank you for your patience and continued interest.',closing:'Sincerely,',signer:'{{club.name}}',footer:''},
 REJECTED:{title:'Your recruitment decision',body:'Thank you for your interest in {{club.name}} and for sharing your time and experiences with us.\n\nAfter careful consideration, we are unable to offer you membership through this recruitment process. We recognize the effort that goes into applying and appreciate the opportunity to learn about you.\n\nWe wish you every success in finding communities and opportunities that inspire you.',closing:'Sincerely,',signer:'{{club.name}}',footer:''},
};
export type LetterContent = LetterTemplate & { studentName:string; clubName:string; logoReference:string|null; accent:string; date:string };
export function resolveLetter(decision:LetterDecision, templates:unknown, values:{firstName:string;fullName:string;clubName:string;date:Date;expiresAt:Date|null;logoReference:string|null;accent:string}):LetterContent {
 const parsed=letterTemplatesSchema.safeParse(templates ?? {});
 const template=parsed.success ? parsed.data[decision] ?? defaultLetters[decision] : defaultLetters[decision];
 const date=values.date.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'});
 const variables:Record<string,string>={'student.firstName':values.firstName,'student.fullName':values.fullName,'club.name':values.clubName,'decision.date':date,'offer.expiresAt':values.expiresAt?.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric',timeZone:'UTC'}) ?? 'the deadline shown with your offer'};
 const render=(value:string)=>value.replace(/\{\{\s*([\w.]+)\s*\}\}/g,(_,key)=>variables[key] ?? '');
 return {...Object.fromEntries(Object.entries(template).map(([key,value])=>[key,render(value)])) as LetterTemplate,studentName:values.fullName,clubName:values.clubName,logoReference:values.logoReference,accent:/^#[\da-f]{6}$/i.test(values.accent)?values.accent:'#142d4e',date};
}
export const decisionDestination=(id:string,letterId?:string)=>`/applications/${encodeURIComponent(id)}/decision${letterId ? "?letterId="+encodeURIComponent(letterId) : ""}`;

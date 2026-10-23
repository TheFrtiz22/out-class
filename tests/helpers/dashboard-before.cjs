// Visual comparison only: previous committed components, same live local fixture
// data and current shell. No mocked mutation is exercised or claimed as E2E.
const {execFileSync}=require('node:child_process'),ts=require('typescript'),path=require('path'),{bundle}=require('./browser-bundle.cjs')
const ref='2c43f47'
async function captureBefore(page,data,kind,out){
 const source=file=>execFileSync('git',['show',`${ref}:${file}`],{encoding:'utf8'})
 const files=['components/manager-overview.tsx','components/recruiting-overview.tsx','components/product/dashboard-priority-queue.tsx','lib/dashboard-actions.ts']
 const mocks=Object.fromEntries(files.map(file=>['@/'+file.replace(/\.tsx?$/,''),ts.transpileModule(source(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText]))
 Object.assign(mocks,{'@/components/product/dashboard-priority-queue.css':'','@/components/member-overview':`exports.memberDate=value=>new Date(value).toLocaleString([],{month:'short',day:'numeric',weekday:'short',hour:'numeric',minute:'2-digit'});exports.RecentRecaps=()=>null;`,'next/link':`exports.__esModule=true;exports.default=({children,...props})=>require('react').createElement('a',props,children);`})
 const script=bundle(`import React from 'react';import {createRoot} from 'react-dom/client';import {ManagerOverview} from '@/components/manager-overview';import {RecruitingOverview} from '@/components/recruiting-overview';import {PageHeader} from '@/components/product/page-header';const data=${JSON.stringify(data)};const target=document.getElementById('workspace-content');[...target.children].forEach(child=>child.style.display='none');const root=document.createElement('div');root.id='dashboard-before';target.appendChild(root);createRoot(root).render(<><PageHeader eyebrow={data.club.name} title="${kind==='recruiting'?'Recruitment':'Overview'}"/>${kind==='recruiting'?'<RecruitingOverview data={data}/>':'<ManagerOverview data={data} showRecaps={false}/>'}</>);`,mocks)
 await page.addStyleTag({content:['components/product/dashboard-priority-queue.css','components/clubs/recruiting-overview.css','components/clubs/manager-overview.css'].map(source).join('\n')})
 await page.addScriptTag({content:script});await page.locator('#dashboard-before').getByRole('heading').first().waitFor()
 for(const width of [1440,1024,768,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:path.join(out,`before-${kind}-${width}.png`),fullPage:true})}
 await page.reload()
}
module.exports={captureBefore}

"use client";
import type {ReactNode} from "react";
import {PageHeader} from "@/components/ui/page-header";
import {projectorThemeAttribute,useProjectorTheme} from "./projector-theme";

/** The projector while the room loads: the same frame, theme and header, so nothing shifts when the slide arrives. */
export function AudienceSkeleton({sessionId,children}:{sessionId:string;children:ReactNode}){
 const [theme]=useProjectorTheme(sessionId);
 return <div className="vr-aud" data-theme={projectorThemeAttribute(theme)}>
  <div className="vr-aud-slide" aria-busy="true">
   <header className="vr-aud-header"><PageHeader title="Live voting" className="vr-aud-title"/></header>
   <div className="vr-aud-tracker"><div className="vr-tracker"><div className="vr-tracker-head"><span className="vr-tracker-meta">&nbsp;</span></div><div className="vr-tracker-bar" aria-hidden="true"/></div></div>
   <div className="vr-aud-stage">{children}</div>
   <footer className="vr-aud-footer"><div className="vr-vote-status" data-variant="slide"><p className="vr-vote-state">&nbsp;</p></div></footer>
  </div>
 </div>;
}

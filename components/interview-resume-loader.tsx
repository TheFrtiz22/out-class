"use client";
import { Component, useMemo, useState, type ReactNode, type ComponentProps } from "react";
import dynamic from "next/dynamic";
import type InterviewResumeViewer from "@/components/interview-resume-viewer";
import { Button } from "@/components/ui/button";
import "./interview-resume-viewer.css";

class ViewerBoundary extends Component<{ children: ReactNode; retry: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <div role="alert" className="space-y-3"><p>The résumé viewer could not load. Your question draft is preserved.</p><Button type="button" variant="outline" onClick={this.props.retry}>Retry viewer</Button></div> : this.props.children;
  }
}
let loadedViewer: typeof InterviewResumeViewer | undefined;
/** A fresh lazy component on retry can reload a failed chunk without reloading the workspace. */
export function InterviewResumeLoader({ fallback, ...props }: ComponentProps<typeof InterviewResumeViewer> & { fallback?: ReactNode }) {
  const [attempt, setAttempt] = useState(0);
  const Viewer = useMemo(() => {
    void attempt;
    // Keep the literal import inside the SSR-disabled boundary so browser PDF code is not traced into serverless functions.
    return loadedViewer || dynamic(() => import("@/components/interview-resume-viewer").then(module => { loadedViewer = module.default; return module; }), { ssr: false, loading: () => <>{fallback || <p role="status">Loading viewer…</p>}</> });
  }, [attempt, fallback]);
  return <ViewerBoundary key={attempt} retry={() => setAttempt(v => v + 1)}><Viewer {...props} /></ViewerBoundary>;
}

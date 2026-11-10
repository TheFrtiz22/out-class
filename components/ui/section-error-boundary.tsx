"use client"
import { Component, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

/**
 * Keeps one failing panel from taking down the surface around it. A render failure shows one line,
 * "Couldn't load <label> · Retry"; Retry remounts the panel so it reads again.
 */
export class SectionErrorBoundary extends Component<{ label: string; children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(error: unknown) { console.error(`[OutClass] ${this.props.label} failed to render`, error) }
  render() {
    if (this.state.failed) return <p role="alert" className="text-sm text-muted-foreground">Couldn’t load {this.props.label} · <Button type="button" variant="ghost" size="sm" className="h-auto px-1 py-0" onClick={() => this.setState(state => ({ failed: false, attempt: state.attempt + 1 }))}>Retry</Button></p>
    return <div key={this.state.attempt} className="contents">{this.props.children}</div>
  }
}

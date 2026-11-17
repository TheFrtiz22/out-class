"use client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { authEntryWithReturn } from "@/lib/follow-intent"
import "./join-prompt-dialog.css"

/**
 * Asked instead of jumping to the sign-in form when a signed-out visitor follows or applies to a
 * club (often a student who just scanned the club's QR code). New students are the likelier case,
 * so creating an account comes first; both paths return to `returnPath` afterwards.
 */
export function JoinPromptDialog({ open, onOpenChange, title, description, returnPath }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** Same-site path to come back to, e.g. "/club/abc?follow=abc". */
  returnPath: string
}) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="oc-join-prompt">
      <div className="oc-join-prompt-head">
        <DialogTitle className="oc-join-prompt-title">{title}</DialogTitle>
        <DialogDescription className="oc-join-prompt-description">{description}</DialogDescription>
      </div>
      <div className="oc-join-prompt-actions">
        <Button asChild className="w-full"><a href={authEntryWithReturn("/signup", returnPath)}>Create your account</a></Button>
        <Button asChild variant="outline" className="w-full"><a href={authEntryWithReturn("/login", returnPath)}>I already have an account</a></Button>
      </div>
      <p className="oc-join-prompt-note">Free for UVA students. Use your @virginia.edu email.</p>
    </DialogContent>
  </Dialog>
}

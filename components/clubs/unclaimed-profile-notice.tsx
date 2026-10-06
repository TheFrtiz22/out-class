"use client";
import Link from "next/link";
import { Info } from "lucide-react";
import type { DirectoryClub } from "@/lib/club-directory";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
export function UnclaimedProfileNotice({ club }: { club: DirectoryClub }) {
  return (
    <div className="oc-claim-notice my-5 flex flex-wrap items-center justify-between gap-4 rounded-md bg-muted/50 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-sm bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
            {club.claimed ? "Club-managed profile" : "Unclaimed profile"}
          </span>
          {club.directorySource &&
            /^https?:\/\//i.test(club.directorySource) && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="About this directory profile"
                  >
                    <Info size={15} />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="space-y-3 text-sm" align="start">
                  <p>
                    OutClass includes public university directory information to
                    help students discover this organization.
                  </p>
                  <a
                    className="oc-profile-link"
                    href={club.directorySource}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View university directory source ↗
                  </a>
                </PopoverContent>
              </Popover>
            )}
        </div>
        {!club.claimed && (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This organization hasn’t claimed its OutClass page yet.
          </p>
        )}
      </div>
      {!club.claimed && (
        <Button variant="outline" size="sm" asChild>
          <Link href={`/club-claims/${club.id}`}>Claim this club</Link>
        </Button>
      )}
    </div>
  );
}

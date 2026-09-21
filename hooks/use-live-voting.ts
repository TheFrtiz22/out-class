"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export type VotingState = {
  isActive: boolean;
  currentCandidateId: string | null;
  timerStartedAt: number | null;
  duration: number; // in seconds
};

export type Vote = "YES" | "NO" | "ABSTAIN";

export function useLiveVoting(clubId: string, memberId: string) {
  const [votingState, setVotingState] = useState<VotingState>({
    isActive: false,
    currentCandidateId: null,
    timerStartedAt: null,
    duration: 60,
  });
  const [tally, setTally] = useState<Record<string, Vote>>({});
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase.channel(`voting_room_${clubId}`);

    channel
      .on("broadcast", { event: "sync-state" }, (payload) => {
        setVotingState(payload.payload.state);
      })
      .on("broadcast", { event: "cast-vote" }, (payload) => {
        setTally((prev) => ({
          ...prev,
          [payload.payload.memberId]: payload.payload.vote
        }));
      })
      .on("broadcast", { event: "clear-tally" }, () => {
        setTally({});
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clubId, supabase]);

  // For the Proctor (President) to manage the session
  const setLiveCandidate = (candidateId: string, duration: number) => {
    const newState = { isActive: true, currentCandidateId: candidateId, timerStartedAt: Date.now(), duration };
    setVotingState(newState);
    setTally({}); // Clear old votes

    supabase.channel(`voting_room_${clubId}`).send({ type: "broadcast", event: "clear-tally" });
    supabase.channel(`voting_room_${clubId}`).send({ type: "broadcast", event: "sync-state", payload: { state: newState } });
  };

  const endVoting = () => {
    const newState = { ...votingState, isActive: false };
    setVotingState(newState);
    supabase.channel(`voting_room_${clubId}`).send({ type: "broadcast", event: "sync-state", payload: { state: newState } });
  };

  // For the Members to cast votes
  const castVote = (vote: Vote) => {
    if (!votingState.isActive) return;
    
    // Optimistic local update
    setTally((prev) => ({ ...prev, [memberId]: vote }));
    
    supabase.channel(`voting_room_${clubId}`).send({
      type: "broadcast",
      event: "cast-vote",
      payload: { memberId, vote }
    });
  };

  return { votingState, tally, setLiveCandidate, endVoting, castVote };
}


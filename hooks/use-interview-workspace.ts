"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type CursorPosition = { x: number; y: number; name: string };
type RealtimePayload = { event: string; type: string; payload: any };

export function useInterviewWorkspace(applicationId: string, interviewerName: string) {
  const [cursors, setCursors] = useState<Record<string, CursorPosition>>({});
  const [sharedNotes, setSharedNotes] = useState("");
  const supabase = createClient();

  useEffect(() => {
    // 1. Join the Realtime Channel for this specific interview
    const channel = supabase.channel(`interview_${applicationId}`, {
      config: {
        broadcast: { self: false },
        presence: { key: interviewerName }
      }
    });

    channel
      .on("broadcast", { event: "cursor-move" }, (payload) => {
        setCursors((prev) => ({
          ...prev,
          [payload.payload.interviewer]: payload.payload.position
        }));
      })
      .on("broadcast", { event: "notes-update" }, (payload) => {
        setSharedNotes(payload.payload.text);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`Joined interview workspace: ${applicationId}`);
        }
      });

    // Cleanup when component unmounts
    return () => {
      supabase.removeChannel(channel);
    };
  }, [applicationId, interviewerName, supabase]);

  // Methods to broadcast changes
  const broadcastCursor = (x: number, y: number) => {
    supabase.channel(`interview_${applicationId}`).send({
      type: "broadcast",
      event: "cursor-move",
      payload: { interviewer: interviewerName, position: { x, y, name: interviewerName } }
    });
  };

  const broadcastNotes = (text: string) => {
    setSharedNotes(text); // Optimistic UI update
    supabase.channel(`interview_${applicationId}`).send({
      type: "broadcast",
      event: "notes-update",
      payload: { text }
    });
  };

  return { cursors, sharedNotes, broadcastCursor, broadcastNotes };
}


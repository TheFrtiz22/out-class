"use client";

import { hasWorkspace } from "@/lib/permissions";
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, StudentProfile, Application, Club, ClubMember } from '@prisma/client';

export type ExtendedApplication = Omit<Application, "anonymousReviewText"> & { club: Club };
export type ExtendedMembership = ClubMember & { club: Club };

export type PopulatedUser = User & {
  impersonating?: boolean;
  profile: StudentProfile | null;
  applications: ExtendedApplication[];
  memberships: ExtendedMembership[];
  adminRoles: ExtendedMembership[];
};

interface AuthContextType {
  isImpersonating: boolean;
  user: PopulatedUser | null;
  loading: boolean;
  /** Known server session awaiting its initial /api/users/me identity. */
  sessionPending: boolean;
  mutateUser: (newUser: PopulatedUser) => void;
  refreshUser: () => Promise<void>;
  activeClubId: string;
  selectClub: (clubId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { demoUser } from "@/lib/demo/store";
import { useDemoMode } from "@/contexts/demo-context";

export function AuthProvider({ children, initialUser = null, isImpersonating = false, hasSession = true }: { children: React.ReactNode; initialUser?: PopulatedUser | null; isImpersonating?: boolean; hasSession?: boolean }) {
  const [user, setUser] = useState<PopulatedUser | null>(initialUser);
  const [loading, setLoading] = useState(!initialUser && hasSession);
  const { isDemoEnabled, state, viewAs } = useDemoMode();
  const [selectedClubId, setSelectedClubId] = useState("");
  const generation = React.useRef(0), bootstrap = React.useRef({ user: initialUser, demo: isDemoEnabled });
  const pending = React.useRef<{ generation: number; promise: Promise<void> } | null>(null);
  const bootstrapChanged = bootstrap.current.user !== initialUser || bootstrap.current.demo !== isDemoEnabled;
  if (bootstrapChanged) { bootstrap.current = { user: initialUser, demo: isDemoEnabled }; generation.current++; }

  const fetchUser = React.useCallback(() => {
    const owner = generation.current;
    if (pending.current?.generation === owner) return pending.current.promise;
    const promise = (async () => {
    try {
      const res = await fetch('/api/users/me');
      if (res.ok) {
        const data: PopulatedUser = await res.json();
        if (generation.current === owner) setUser(data);
      } else {
        if (generation.current === owner) setUser(null);
      }
    } catch (error) {
      console.error("Failed to fetch user", error);
      if (generation.current === owner) setUser(null);
    } finally {
      if (generation.current === owner) setLoading(false);
    }
    })();
    pending.current = { generation: owner, promise };
    void promise.then(() => { if (pending.current?.promise === promise) pending.current = null; });
    return promise;
  }, []);

  useEffect(() => {
    if (isDemoEnabled) return;
    if (initialUser) { setUser(initialUser); setLoading(false); }
    else if (hasSession) { setUser(null); setLoading(true); void fetchUser(); }
    else { setUser(null); setLoading(false); }
  }, [fetchUser, isDemoEnabled, hasSession, initialUser]);

  const mutateUser = (newUser: PopulatedUser) => {
    setUser(newUser);
  };

  const identity = isDemoEnabled && state ? demoUser() as unknown as PopulatedUser : !hasSession ? null : bootstrapChanged ? initialUser : user;
  const workspaces = identity?.memberships.filter(hasWorkspace) || [];
  const activeClubId = workspaces.find(m => m.clubId === (isDemoEnabled ? state?.perspective.clubId : selectedClubId))?.clubId || workspaces[0]?.clubId || "";
  const selectClub = (clubId: string) => {
    if (!workspaces.some(m => m.clubId === clubId)) return;
    if (isDemoEnabled) viewAs("leader", clubId);
    else setSelectedClubId(clubId);
  };
  return (
    <AuthContext.Provider value={{ isImpersonating, user: identity, activeClubId, selectClub, loading: isDemoEnabled ? !state : bootstrapChanged ? !initialUser && hasSession : loading, sessionPending: hasSession && !isDemoEnabled && loading && !identity, mutateUser, refreshUser: isDemoEnabled ? async () => {} : fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

"use client";

import { hasWorkspace } from "@/lib/permissions";
import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, StudentProfile, Application, Club, ClubMember } from '@prisma/client';

export type ExtendedApplication = Application & { club: Club };
export type ExtendedMembership = ClubMember & { club: Club };

export type PopulatedUser = User & {
  profile: StudentProfile | null;
  applications: ExtendedApplication[];
  memberships: ExtendedMembership[];
  adminRoles: ExtendedMembership[];
};

interface AuthContextType {
  user: PopulatedUser | null;
  loading: boolean;
  mutateUser: (newUser: PopulatedUser) => void;
  refreshUser: () => Promise<void>;
  activeClubId: string;
  selectClub: (clubId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { demoUser } from "@/lib/demo/store";
import { useDemoMode } from "@/contexts/demo-context";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PopulatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { isDemoEnabled, state, viewAs } = useDemoMode();
  const [selectedClubId, setSelectedClubId] = useState("");

  const fetchUser = React.useCallback(async () => {

    try {
      const res = await fetch('/api/users/me');
      if (res.ok) {
        const data: PopulatedUser = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to fetch user", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [isDemoEnabled]);

  useEffect(() => {
    if (!isDemoEnabled) void fetchUser();
  }, [fetchUser, isDemoEnabled]);

  const mutateUser = (newUser: PopulatedUser) => {
    setUser(newUser);
  };

  const identity = isDemoEnabled && state ? demoUser() as unknown as PopulatedUser : user;
  const workspaces = identity?.memberships.filter(hasWorkspace) || [];
  const activeClubId = workspaces.find(m => m.clubId === (isDemoEnabled ? state?.perspective.clubId : selectedClubId))?.clubId || workspaces[0]?.clubId || "";
  const selectClub = (clubId: string) => {
    if (!workspaces.some(m => m.clubId === clubId)) return;
    if (isDemoEnabled) viewAs("leader", clubId);
    else setSelectedClubId(clubId);
  };
  return (
    <AuthContext.Provider value={{ user: identity, activeClubId, selectClub, loading: isDemoEnabled ? !state : loading, mutateUser, refreshUser: isDemoEnabled ? async () => {} : fetchUser }}>
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


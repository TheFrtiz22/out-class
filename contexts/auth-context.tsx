"use client";

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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PopulatedUser | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const mutateUser = (newUser: PopulatedUser) => {
    setUser(newUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, mutateUser, refreshUser: fetchUser }}>
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


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

import { useDemoMode } from "@/contexts/demo-context";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PopulatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { isDemoEnabled } = useDemoMode();

  const fetchUser = React.useCallback(async () => {
    if (isDemoEnabled) {
      setUser({
        id: "demo-user-id",
        email: "demo.leader@virginia.edu",
        role: "STUDENT",
        profile: {
          id: "demo-profile-id",
          userId: "demo-user-id",
          firstName: "Jordan",
          lastName: "Avery",
          major: "Economics & Computer Science",
          classYear: "Class of 2028",
          linkedin: "linkedin.com/in/jordanavery",
          bio: "Demo user with admin access.",
        },
        applications: [],
        memberships: [],
        adminRoles: [{
          id: "demo-admin-role",
          userId: "demo-user-id",
          clubId: "vvf",
          role: "ADMIN",
          title: "Recruitment Chair",
          club: {
            id: "vvf",
            name: "Virginia Venture Fund",
          }
        }]
      } as unknown as PopulatedUser);
      setLoading(false);
      return;
    }

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


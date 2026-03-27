import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { apiFetch } from "../lib/api";
import { useAuth } from "./AuthContext";

export type StreakStatus = "active" | "at_risk" | "freeze_used" | "streak_lost";

export type WeeklyProgressDay = {
  label: string;
  date: string;
  completed: boolean;
  isToday?: boolean;
  status: "done" | "today" | "missed" | "locked" | "freeze";
};

export type BadgeItem = {
  badgeId: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string | Date;
  seen: boolean;
};

export type GamificationSnapshot = {
  xp: number;
  level: number;
  streakDays: number;
  streakFreezes: number;
  maxStreakFreezes: number;
  badges: string[];
  weeklyProgress: WeeklyProgressDay[];
  streakStatus?: StreakStatus;
  streakMessage?: string;
  unseenBadgeCount?: number;
  nextLessonTitle?: string | null;
};

export type StreakCheckResult = {
  streak: number;
  freezes: number;
  maxFreezes: number;
  status: StreakStatus;
  lessonCompletedToday: boolean;
  showSadEmoji: boolean;
  gamification?: GamificationSnapshot;
};

type GamificationContextValue = {
  gamification: GamificationSnapshot | null;
  streakCheck: StreakCheckResult | null;
  currentBadge: BadgeItem | null;
  refreshDailyState: () => Promise<void>;
  applyGamificationSnapshot: (snapshot: GamificationSnapshot | null | undefined) => void;
  queueBadges: (badges: BadgeItem[] | null | undefined) => void;
  markCurrentBadgeSeen: () => Promise<void>;
};

const GamificationContext = createContext<GamificationContextValue | undefined>(undefined);

export function GamificationProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  const [gamification, setGamification] = useState<GamificationSnapshot | null>(null);
  const [streakCheck, setStreakCheck] = useState<StreakCheckResult | null>(null);
  const [pendingBadges, setPendingBadges] = useState<BadgeItem[]>([]);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  const currentBadge = pendingBadges[0] ?? null;

  const queueBadges = useCallback((badges: BadgeItem[] | null | undefined) => {
    if (!Array.isArray(badges) || badges.length === 0) {
      return;
    }

    setPendingBadges((prev) => {
      const seenIds = new Set(prev.map((badge) => badge.badgeId));
      const additions = badges.filter(
        (badge) => badge?.badgeId && !seenIds.has(badge.badgeId),
      );
      return additions.length > 0 ? [...prev, ...additions] : prev;
    });
  }, []);

  const applyGamificationSnapshot = useCallback((snapshot: GamificationSnapshot | null | undefined) => {
    if (!snapshot) {
      return;
    }

    setGamification(snapshot);
    setStreakCheck((prev) =>
      prev
        ? {
            ...prev,
            streak: typeof snapshot.streakDays === "number" ? snapshot.streakDays : prev.streak,
            freezes:
              typeof snapshot.streakFreezes === "number" ? snapshot.streakFreezes : prev.freezes,
            maxFreezes:
              typeof snapshot.maxStreakFreezes === "number"
                ? snapshot.maxStreakFreezes
                : prev.maxFreezes,
            status: snapshot.streakStatus ?? prev.status,
          }
        : prev,
    );
  }, []);

  const refreshDailyState = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    if (refreshPromiseRef.current) {
      await refreshPromiseRef.current;
      return;
    }

    // These endpoints sync and save overlapping user state, so keep refreshes serialized.
    const run = (async () => {
      try {
        const streak = await apiFetch<StreakCheckResult>("/progress/check-streak", {}, accessToken);
        setStreakCheck(streak);
        applyGamificationSnapshot(streak.gamification ?? null);

        const badges = await apiFetch<BadgeItem[]>("/progress/badges/check", {}, accessToken);
        queueBadges(badges);

        const summary = await apiFetch<GamificationSnapshot>("/progress/gamification", {}, accessToken);
        applyGamificationSnapshot(summary);
      } catch (error) {
        console.warn("Unable to refresh daily gamification state", error);
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = run;
    await run;
  }, [accessToken, applyGamificationSnapshot, queueBadges]);

  const markCurrentBadgeSeen = useCallback(async () => {
    if (!accessToken || !currentBadge) {
      return;
    }

    try {
      await apiFetch(
        `/progress/badges/${encodeURIComponent(currentBadge.badgeId)}/seen`,
        { method: "POST" },
        accessToken,
      );
    } catch (error) {
      console.warn("Unable to mark badge as seen", error);
    } finally {
      setPendingBadges((prev) => prev.slice(1));
    }
  }, [accessToken, currentBadge]);

  useEffect(() => {
    if (!accessToken) {
      setGamification(null);
      setStreakCheck(null);
      setPendingBadges([]);
      refreshPromiseRef.current = null;
      return;
    }

    void refreshDailyState();

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void refreshDailyState();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [accessToken, refreshDailyState]);

  const value = useMemo<GamificationContextValue>(
    () => ({
      gamification,
      streakCheck,
      currentBadge,
      refreshDailyState,
      applyGamificationSnapshot,
      queueBadges,
      markCurrentBadgeSeen,
    }),
    [
      applyGamificationSnapshot,
      currentBadge,
      gamification,
      markCurrentBadgeSeen,
      queueBadges,
      refreshDailyState,
      streakCheck,
    ],
  );

  return <GamificationContext.Provider value={value}>{children}</GamificationContext.Provider>;
}

export function useGamification() {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error("useGamification must be used within GamificationProvider");
  }
  return context;
}

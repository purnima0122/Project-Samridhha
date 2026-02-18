/**
 * DataServerContext - React Context for real-time Data-Server connection.
 *
 * Provides live stock ticks, market status, alert events,
 * in-app notifications, watchlist state, and helper functions.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
    connectSocket,
    disconnectSocket,
    getSocket,
    subscribeStock,
    unsubscribeStock,
    setThreshold,
    fetchStocks,
    fetchMarketStatus,
    searchStocks as searchStocksApi,
    type TickData,
    type AlertData,
    type MarketStatusData,
} from "../lib/dataServer";

type StockTick = {
    symbol: string;
    name?: string;
    current_price: number;
    change_pct: number;
    volume: number;
    sector?: string;
    [key: string]: any;
};

type ThresholdConfig = {
    symbol: string;
    price_threshold_pct?: number;
    volume_threshold_multiplier?: number;
    enabled?: boolean;
};

type NotificationType =
    | "volume"
    | "price"
    | "trend"
    | "system"
    | "learning"
    | "coaching"
    | "milestone"
    | "weekly";

type AppNotification = {
    id: string;
    type: NotificationType;
    symbol?: string;
    title: string;
    message: string;
    lesson: string;
    tip: string;
    createdAt: string;
    read: boolean;
};

type NotificationSettings = {
    inApp: boolean;
    push: boolean;
    email: boolean;
    volume: boolean;
    price: boolean;
    trend: boolean;
    system: boolean;
    learning: boolean;
    coaching: boolean;
    milestone: boolean;
    weekly: boolean;
};

type DataServerContextType = {
    isConnected: boolean;
    ticks: Record<string, StockTick>;
    marketStatus: MarketStatusData | null;
    alerts: AlertData[];
    thresholds: ThresholdConfig[];
    notifications: AppNotification[];
    unreadNotificationCount: number;
    notificationSettings: NotificationSettings;
    watchlistSymbols: string[];
    stocks: any[];
    loadingStocks: boolean;
    subscribe: (symbols: string[]) => void;
    unsubscribe: (symbols: string[]) => void;
    setAlertThreshold: (data: {
        user_id: string;
        symbol: string;
        price_threshold_pct?: number;
        volume_threshold_multiplier?: number;
    }) => void;
    addAlertEvent: (data: AlertData) => void;
    loadSubscriptions: (userId: string) => void;
    markNotificationRead: (id: string) => void;
    markAllNotificationsRead: () => void;
    removeNotification: (id: string) => void;
    clearNotifications: () => void;
    updateNotificationSettings: (update: Partial<NotificationSettings>) => void;
    addWatchlistSymbols: (symbols: string[]) => void;
    removeWatchlistSymbol: (symbol: string) => void;
    clearWatchlist: () => void;
    searchStocks: (query: string) => Promise<any[]>;
    refreshStocks: () => Promise<void>;
};

const defaultNotificationSettings: NotificationSettings = {
    inApp: true,
    push: true,
    email: false,
    volume: true,
    price: true,
    trend: true,
    system: true,
    learning: true,
    coaching: true,
    milestone: true,
    weekly: true,
};

const DataServerContext = createContext<DataServerContextType>({
    isConnected: false,
    ticks: {},
    marketStatus: null,
    alerts: [],
    thresholds: [],
    notifications: [],
    unreadNotificationCount: 0,
    notificationSettings: defaultNotificationSettings,
    watchlistSymbols: [],
    stocks: [],
    loadingStocks: false,
    subscribe: () => { },
    unsubscribe: () => { },
    setAlertThreshold: () => { },
    addAlertEvent: () => { },
    loadSubscriptions: () => { },
    markNotificationRead: () => { },
    markAllNotificationsRead: () => { },
    removeNotification: () => { },
    clearNotifications: () => { },
    updateNotificationSettings: () => { },
    addWatchlistSymbols: () => { },
    removeWatchlistSymbol: () => { },
    clearWatchlist: () => { },
    searchStocks: async () => [],
    refreshStocks: async () => { },
});

export function useDataServer() {
    return useContext(DataServerContext);
}

function normalizeSymbol(value: unknown): string {
    return String(value ?? "").trim().toUpperCase();
}

function dedupeSymbols(symbols: string[]): string[] {
    const seen = new Set<string>();
    const output: string[] = [];
    for (const raw of symbols) {
        const symbol = normalizeSymbol(raw);
        if (!symbol || seen.has(symbol)) {
            continue;
        }
        seen.add(symbol);
        output.push(symbol);
    }
    return output;
}

function normalizeThreshold(input: ThresholdConfig): ThresholdConfig {
    return {
        symbol: normalizeSymbol(input.symbol),
        price_threshold_pct: input.price_threshold_pct,
        volume_threshold_multiplier: input.volume_threshold_multiplier,
        enabled: input.enabled ?? true,
    };
}

function upsertThreshold(
    prev: ThresholdConfig[],
    incoming: ThresholdConfig,
): ThresholdConfig[] {
    const normalized = normalizeThreshold(incoming);
    if (!normalized.symbol) {
        return prev;
    }
    const filtered = prev.filter((item) => item.symbol !== normalized.symbol);
    return [normalized, ...filtered];
}

function buildAlertContext(alertData: AlertData): {
    type: NotificationType;
    title: string;
    message: string;
    lesson: string;
    tip: string;
    symbol?: string;
} {
    const alertType = String(alertData.alert?.alert_type ?? "alert").toLowerCase();
    const direction = String(alertData.alert?.direction ?? "").toLowerCase();
    const symbol = normalizeSymbol(alertData.alert?.symbol);
    const magnitude = Number(alertData.alert?.magnitude ?? 0);

    if (alertType === "volume") {
        return {
            type: "volume",
            title: `${symbol || "Market"}: Volume spike detected`,
            message: alertData.alert?.message || `${symbol} traded on unusually high volume.`,
            lesson: "High volume means attention is high. Confirm whether price action supports a sustainable move.",
            tip: "Avoid instant entries; wait for confirmation on the next candles before increasing risk.",
            symbol,
        };
    }

    if (alertType === "price") {
        const isDrop = direction === "down";
        return {
            type: "price",
            title: `${symbol || "Market"}: Price ${isDrop ? "drop" : "move"} alert`,
            message:
                alertData.alert?.message ||
                `${symbol} moved ${isDrop ? "down" : "up"} ${Math.abs(magnitude).toFixed(2)}%.`,
            lesson: isDrop
                ? "Short-term corrections are common in volatile assets; not every drop is a trend reversal."
                : "Rapid upside moves can be momentum continuation or short-lived breakouts.",
            tip: isDrop
                ? "Do not panic sell. Re-check support zones, position size, and stop-loss discipline."
                : "Avoid chasing green candles; use planned entries and risk limits.",
            symbol,
        };
    }

    return {
        type: "trend",
        title: `${symbol || "Market"}: Trend change signal`,
        message: alertData.alert?.message || `${symbol} shows possible trend transition.`,
        lesson: "Trend shifts are noisy. Multiple confirmations reduce false signals.",
        tip: "Reduce position size until direction is confirmed by follow-through sessions.",
        symbol,
    };
}

export function DataServerProvider({ children }: { children: React.ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [ticks, setTicks] = useState<Record<string, StockTick>>({});
    const [marketStatus, setMarketStatus] = useState<MarketStatusData | null>(null);
    const [alerts, setAlerts] = useState<AlertData[]>([]);
    const [thresholds, setThresholds] = useState<ThresholdConfig[]>([]);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(
        defaultNotificationSettings,
    );
    const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);
    const [stocks, setStocks] = useState<any[]>([]);
    const [loadingStocks, setLoadingStocks] = useState(false);
    const mountedRef = useRef(true);
    const notificationSettingsRef = useRef(notificationSettings);
    const notificationCounterRef = useRef(0);

    useEffect(() => {
        notificationSettingsRef.current = notificationSettings;
    }, [notificationSettings]);

    const unreadNotificationCount = notifications.reduce(
        (count, item) => (item.read ? count : count + 1),
        0,
    );

    const appendNotification = useCallback(
        (data: Omit<AppNotification, "id" | "createdAt" | "read">) => {
            const settings = notificationSettingsRef.current;
            if (!settings.inApp || !settings[data.type]) {
                return;
            }

            const notification: AppNotification = {
                id: `${Date.now()}-${notificationCounterRef.current++}-${Math.random().toString(36).slice(2, 8)}`,
                createdAt: new Date().toISOString(),
                read: false,
                ...data,
            };
            setNotifications((prev) => [notification, ...prev].slice(0, 100));
        },
        [],
    );

    const setAlertThresholdWithState = useCallback(
        (data: {
            user_id: string;
            symbol: string;
            price_threshold_pct?: number;
            volume_threshold_multiplier?: number;
        }) => {
            setThreshold(data);
            const normalizedSymbol = normalizeSymbol(data.symbol);
            setThresholds((prev) =>
                upsertThreshold(prev, {
                    symbol: normalizedSymbol,
                    price_threshold_pct: data.price_threshold_pct,
                    volume_threshold_multiplier: data.volume_threshold_multiplier,
                    enabled: true,
                }),
            );

            appendNotification({
                type: "coaching",
                symbol: normalizedSymbol,
                title: `${normalizedSymbol}: Alert added`,
                message: "You will receive alerts when this threshold is crossed.",
                lesson: "Better thresholds are based on realistic volatility, not emotion.",
                tip: "Review this alert weekly and adjust based on latest market behavior.",
            });
        },
        [appendNotification],
    );

    const addAlertEvent = useCallback(
        (data: AlertData) => {
            setAlerts((prev) => [data, ...prev].slice(0, 50));
            const context = buildAlertContext(data);
            appendNotification(context);
        },
        [appendNotification],
    );

    const loadSubscriptions = useCallback((userId: string) => {
        const socket = getSocket();
        if (!socket.connected || !userId) {
            return;
        }
        socket.emit("get:subscriptions", { user_id: userId });
    }, []);

    const addWatchlistSymbols = useCallback(
        (symbols: string[]) => {
            const normalizedIncoming = dedupeSymbols(symbols);
            if (normalizedIncoming.length === 0) {
                return;
            }

            setWatchlistSymbols((prev) => {
                const next = dedupeSymbols([...prev, ...normalizedIncoming]);
                if (next.length > prev.length) {
                    appendNotification({
                        type: "learning",
                        symbol: normalizedIncoming[0],
                        title: `${normalizedIncoming[0]} added to watchlist`,
                        message: "Dashboard will now prioritize this market in your watchlist view.",
                        lesson: "Focused watchlists reduce noise and improve decision quality.",
                        tip: "Keep watchlist small and intentional for better monitoring.",
                    });

                    if (next.length >= 5 && prev.length < 5) {
                        appendNotification({
                            type: "milestone",
                            title: "Watchlist milestone reached",
                            message: "You are now tracking 5 markets.",
                            lesson: "Diversified tracking improves context, but too many symbols can reduce focus.",
                            tip: "Prioritize top 3 symbols you can actively review each day.",
                        });
                    }
                }
                return next;
            });
        },
        [appendNotification],
    );

    const removeWatchlistSymbol = useCallback((symbol: string) => {
        const normalized = normalizeSymbol(symbol);
        if (!normalized) {
            return;
        }
        setWatchlistSymbols((prev) => prev.filter((item) => item !== normalized));
    }, []);

    const clearWatchlist = useCallback(() => {
        setWatchlistSymbols([]);
    }, []);

    const markNotificationRead = useCallback((id: string) => {
        setNotifications((prev) =>
            prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
        );
    }, []);

    const markAllNotificationsRead = useCallback(() => {
        setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    }, []);

    const removeNotification = useCallback((id: string) => {
        setNotifications((prev) => prev.filter((item) => item.id !== id));
    }, []);

    const clearNotifications = useCallback(() => {
        setNotifications([]);
    }, []);

    const updateNotificationSettings = useCallback((update: Partial<NotificationSettings>) => {
        setNotificationSettings((prev) => ({ ...prev, ...update }));
    }, []);

    const refreshStocks = useCallback(async () => {
        try {
            setLoadingStocks(true);
            const [stockList, status] = await Promise.all([
                fetchStocks(),
                fetchMarketStatus(),
            ]);
            if (mountedRef.current) {
                setStocks(stockList);
                setMarketStatus(status);
            }
        } catch (err) {
            console.warn("[DataServer] Failed to fetch initial data:", err);
        } finally {
            if (mountedRef.current) setLoadingStocks(false);
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;

        refreshStocks();

        const socket = connectSocket();

        socket.on("connect", () => {
            if (!mountedRef.current) return;
            setIsConnected(true);
            appendNotification({
                type: "system",
                title: "Realtime feed connected",
                message: "Market data stream is active.",
                lesson: "Live feed helps you react faster, but decisions should still follow your plan.",
                tip: "Use alerts for confirmation, not impulse entries.",
            });
        });

        socket.on("disconnect", () => {
            if (!mountedRef.current) return;
            setIsConnected(false);
        });

        socket.on("tick:update", (data: { ticks?: Record<string, TickData>; tick?: TickData }) => {
            if (!mountedRef.current) return;
            if (data.ticks) {
                setTicks((prev) => ({ ...prev, ...(data.ticks as Record<string, StockTick>) }));
            } else if (data.tick) {
                const singleTick = data.tick as StockTick;
                setTicks((prev) => ({
                    ...prev,
                    [singleTick.symbol]: singleTick,
                }));
            }
        });

        socket.on("alert:triggered", (data: AlertData) => {
            if (!mountedRef.current) return;
            setAlerts((prev) => [data, ...prev].slice(0, 50));
            const context = buildAlertContext(data);
            appendNotification(context);
        });

        socket.on("threshold:set", (data: ThresholdConfig) => {
            if (!mountedRef.current) return;
            setThresholds((prev) => upsertThreshold(prev, data));
        });

        socket.on("subscriptions:list", (data: { subscriptions?: ThresholdConfig[] }) => {
            if (!mountedRef.current) return;
            const incoming = Array.isArray(data?.subscriptions) ? data.subscriptions : [];
            setThresholds(
                incoming
                    .map((item) => normalizeThreshold(item))
                    .filter((item) => Boolean(item.symbol)),
            );
        });

        socket.on("market:status", (data: MarketStatusData) => {
            if (!mountedRef.current) return;
            setMarketStatus(data);
        });

        return () => {
            mountedRef.current = false;
            disconnectSocket();
        };
    }, [appendNotification, refreshStocks]);

    const contextValue: DataServerContextType = {
        isConnected,
        ticks,
        marketStatus,
        alerts,
        thresholds,
        notifications,
        unreadNotificationCount,
        notificationSettings,
        watchlistSymbols,
        stocks,
        loadingStocks,
        subscribe: subscribeStock,
        unsubscribe: unsubscribeStock,
        setAlertThreshold: setAlertThresholdWithState,
        addAlertEvent,
        loadSubscriptions,
        markNotificationRead,
        markAllNotificationsRead,
        removeNotification,
        clearNotifications,
        updateNotificationSettings,
        addWatchlistSymbols,
        removeWatchlistSymbol,
        clearWatchlist,
        searchStocks: searchStocksApi,
        refreshStocks,
    };

    return (
        <DataServerContext.Provider value={contextValue}>
            {children}
        </DataServerContext.Provider>
    );
}

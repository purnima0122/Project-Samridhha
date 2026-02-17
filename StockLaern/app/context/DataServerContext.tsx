/**
 * DataServerContext — React Context for real-time Data-Server connection.
 *
 * Provides live stock ticks, market status, alert events,
 * and helper functions to all child components.
 */
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
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

// ─── Types ───────────────────────────────────────────────────────────────────

type StockTick = {
    symbol: string;
    name?: string;
    current_price: number;
    change_pct: number;
    volume: number;
    sector?: string;
    [key: string]: any;
};

type DataServerContextType = {
    /** Whether Socket.IO is connected */
    isConnected: boolean;
    /** Map of symbol → latest tick data */
    ticks: Record<string, StockTick>;
    /** Current market status */
    marketStatus: MarketStatusData | null;
    /** Recent triggered alerts */
    alerts: AlertData[];
    /** Initial list of tracked stocks (from REST) */
    stocks: any[];
    /** Loading state for initial stock fetch */
    loadingStocks: boolean;
    /** Subscribe to stock ticks by symbol */
    subscribe: (symbols: string[]) => void;
    /** Unsubscribe from stock ticks */
    unsubscribe: (symbols: string[]) => void;
    /** Set alert threshold via WebSocket */
    setAlertThreshold: (data: {
        user_id: string;
        symbol: string;
        price_threshold_pct?: number;
        volume_threshold_multiplier?: number;
    }) => void;
    /** Search stocks via REST */
    searchStocks: (query: string) => Promise<any[]>;
    /** Refresh the stock list */
    refreshStocks: () => Promise<void>;
};

const DataServerContext = createContext<DataServerContextType>({
    isConnected: false,
    ticks: {},
    marketStatus: null,
    alerts: [],
    stocks: [],
    loadingStocks: false,
    subscribe: () => { },
    unsubscribe: () => { },
    setAlertThreshold: () => { },
    searchStocks: async () => [],
    refreshStocks: async () => { },
});

export function useDataServer() {
    return useContext(DataServerContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function DataServerProvider({ children }: { children: React.ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [ticks, setTicks] = useState<Record<string, StockTick>>({});
    const [marketStatus, setMarketStatus] = useState<MarketStatusData | null>(null);
    const [alerts, setAlerts] = useState<AlertData[]>([]);
    const [stocks, setStocks] = useState<any[]>([]);
    const [loadingStocks, setLoadingStocks] = useState(false);
    const mountedRef = useRef(true);

    // Load initial stocks + market status
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

        // Fetch initial data
        refreshStocks();

        // Connect Socket.IO
        const socket = connectSocket();

        socket.on("connect", () => {
            if (mountedRef.current) setIsConnected(true);
        });

        socket.on("disconnect", () => {
            if (mountedRef.current) setIsConnected(false);
        });

        // Listen for tick updates
        socket.on("tick:update", (data: { ticks?: Record<string, TickData>; tick?: TickData }) => {
            if (!mountedRef.current) return;
            if (data.ticks) {
                setTicks((prev) => ({ ...prev, ...data.ticks }));
            } else if (data.tick) {
                setTicks((prev) => ({
                    ...prev,
                    [data.tick!.symbol]: data.tick!,
                }));
            }
        });

        // Listen for alerts
        socket.on("alert:triggered", (data: AlertData) => {
            if (!mountedRef.current) return;
            setAlerts((prev) => [data, ...prev].slice(0, 50));
        });

        // Listen for market status changes
        socket.on("market:status", (data: MarketStatusData) => {
            if (!mountedRef.current) return;
            setMarketStatus(data);
        });

        return () => {
            mountedRef.current = false;
            disconnectSocket();
        };
    }, [refreshStocks]);

    const contextValue: DataServerContextType = {
        isConnected,
        ticks,
        marketStatus,
        alerts,
        stocks,
        loadingStocks,
        subscribe: subscribeStock,
        unsubscribe: unsubscribeStock,
        setAlertThreshold: setThreshold,
        searchStocks: searchStocksApi,
        refreshStocks,
    };

    return (
        <DataServerContext.Provider value={contextValue}>
            {children}
        </DataServerContext.Provider>
    );
}

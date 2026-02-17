/**
 * Data-Server client library.
 *
 * Provides Socket.IO connection management and REST helpers
 * for communicating with the Data-Server (Flask + Socket.IO).
 */
import { io, Socket } from "socket.io-client";

// ─── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_DATA_SERVER_URL = "http://localhost:4000";

export const DATA_SERVER_URL =
    process.env.EXPO_PUBLIC_DATA_SERVER_URL || DEFAULT_DATA_SERVER_URL;

// ─── Socket.IO Singleton ─────────────────────────────────────────────────────

let socket: Socket | null = null;

export function getSocket(): Socket {
    if (!socket) {
        socket = io(DATA_SERVER_URL, {
            transports: ["websocket", "polling"],
            autoConnect: false,
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
        });
    }
    return socket;
}

export function connectSocket(): Socket {
    const s = getSocket();
    if (!s.connected) {
        s.connect();
    }
    return s;
}

export function disconnectSocket(): void {
    if (socket?.connected) {
        socket.disconnect();
    }
}

// ─── Socket.IO Event Helpers ─────────────────────────────────────────────────

export function subscribeStock(symbols: string[]): void {
    const s = getSocket();
    if (s.connected) {
        s.emit("subscribe:stock", { symbols });
    }
}

export function unsubscribeStock(symbols: string[]): void {
    const s = getSocket();
    if (s.connected) {
        s.emit("unsubscribe:stock", { symbols });
    }
}

export function setThreshold(data: {
    user_id: string;
    symbol: string;
    price_threshold_pct?: number;
    volume_threshold_multiplier?: number;
}): void {
    const s = getSocket();
    if (s.connected) {
        s.emit("set:threshold", data);
    }
}

export type TickData = {
    symbol: string;
    current_price: number;
    change_pct: number;
    volume: number;
    [key: string]: any;
};

export type AlertData = {
    user_id: string;
    alert: {
        symbol: string;
        alert_type: string;
        message: string;
        [key: string]: any;
    };
};

export type MarketStatusData = {
    is_open: boolean;
    trading_hours: string;
    [key: string]: any;
};

// ─── REST Helpers ────────────────────────────────────────────────────────────

async function dataServerFetch<T>(path: string): Promise<T> {
    const response = await fetch(`${DATA_SERVER_URL}${path}`);
    if (!response.ok) {
        throw new Error(`Data-Server error: ${response.status}`);
    }
    return response.json() as Promise<T>;
}

export async function fetchStocks(all = false): Promise<any[]> {
    const query = all ? "?all=true" : "";
    const data = await dataServerFetch<{ stocks: any[] }>(
        `/api/stocks${query}`
    );
    return data.stocks ?? data ?? [];
}

export async function fetchStock(symbol: string): Promise<any> {
    return dataServerFetch(`/api/stocks/${symbol}`);
}

export async function fetchStockHistory(
    symbol: string,
    days = 50
): Promise<any[]> {
    const data = await dataServerFetch<{ history: any[] }>(
        `/api/stocks/${symbol}/history?days=${days}`
    );
    return data.history ?? data ?? [];
}

export async function searchStocks(query: string): Promise<any[]> {
    const data = await dataServerFetch<{ results: any[] }>(
        `/api/stocks/search?q=${encodeURIComponent(query)}`
    );
    return data.results ?? data ?? [];
}

export async function fetchMarketStatus(): Promise<MarketStatusData> {
    return dataServerFetch<MarketStatusData>("/api/market/status");
}

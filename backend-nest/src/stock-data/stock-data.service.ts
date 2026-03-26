import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { io, Socket } from 'socket.io-client';

@Injectable()
export class StockDataService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(StockDataService.name);
    private readonly baseUrl: string;
    private socket: Socket;
    private liveTicks = new Map<string, { price: number; change_pct: number; volume: number }>();

    constructor(private readonly configService: ConfigService) {
        this.baseUrl =
            this.configService.get<string>('dataServer.url') ||
            'https://samridhha-data.manasi.com.np';
        this.logger.log(`Data-Server URL: ${this.baseUrl}`);
    }

    onModuleInit() {
        this.socket = io(this.baseUrl, {
            transports: ['websocket', 'polling'],
            autoConnect: true,
            reconnection: true,
        });

        this.socket.on('connect', () => {
            this.logger.log(`Connected to Data-Server WebSocket at ${this.baseUrl}`);
        });

        this.socket.on('disconnect', () => {
            this.logger.warn(`Disconnected from Data-Server WebSocket`);
        });

        this.socket.on('tick:update', (data: { ticks?: Record<string, any>; tick?: any }) => {
            if (data.ticks) {
                for (const [symbol, tick] of Object.entries(data.ticks)) {
                    this.liveTicks.set(symbol.toUpperCase(), {
                        price: tick.current_price ?? tick.price ?? tick.ltp ?? 0,
                        change_pct: tick.change_pct ?? 0,
                        volume: tick.volume ?? 0,
                    });
                }
            } else if (data.tick) {
                const tick = data.tick;
                const symbol = tick.symbol?.toUpperCase();
                if (symbol) {
                    this.liveTicks.set(symbol, {
                        price: tick.current_price ?? tick.price ?? tick.ltp ?? 0,
                        change_pct: tick.change_pct ?? 0,
                        volume: tick.volume ?? 0,
                    });
                }
            }
        });
    }

    onModuleDestroy() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }

    private async fetchFromDataServer<T>(path: string): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Data-Server returned ${response.status}`);
            }
            return (await response.json()) as T;
        } catch (error) {
            this.logger.error(`Failed to fetch ${url}: ${error.message}`);
            throw error;
        }
    }

    async getStocks(all = false): Promise<any> {
        const query = all ? '?all=true' : '';
        return this.fetchFromDataServer(`/api/stocks${query}`);
    }

    async getStock(symbol: string): Promise<any> {
        return this.fetchFromDataServer(`/api/stocks/${symbol}`);
    }

    async getStockHistory(symbol: string, days = 50): Promise<any> {
        return this.fetchFromDataServer(
            `/api/stocks/${symbol}/history?days=${days}`,
        );
    }

    async searchStocks(query?: string, sector?: string): Promise<any> {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (sector) params.set('sector', sector);
        return this.fetchFromDataServer(`/api/stocks/search?${params.toString()}`);
    }

    async getMarketStatus(): Promise<any> {
        return this.fetchFromDataServer('/api/market/status');
    }

    async checkAlertThreshold(body: {
        symbol: string;
        price_threshold_pct?: number;
        volume_threshold_multiplier?: number;
    }): Promise<any> {
        const url = `${this.baseUrl}/api/alerts/check`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(`Data-Server returned ${response.status}`);
        }
        return response.json();
    }

    /**
     * Fetch live prices for multiple symbols at once.
     * Returns a map of symbol → { price, change_pct, volume }.
     */
    async getLivePrices(
        symbols: string[],
    ): Promise<Record<string, { price: number; change_pct: number; volume: number }>> {
        const result: Record<string, { price: number; change_pct: number; volume: number }> = {};
        const fetches = symbols.map(async (symbol) => {
            const sym = symbol.toUpperCase();
            if (this.liveTicks.has(sym)) {
                result[sym] = this.liveTicks.get(sym)!;
            } else {
                try {
                    const data = await this.getStock(sym);
                    const tick = data.tick || data || {};
                    const tickData = {
                        price: tick.price ?? tick.current_price ?? tick.ltp ?? 0,
                        change_pct: tick.change_pct ?? 0,
                        volume: tick.volume ?? 0,
                    };
                    result[sym] = tickData;
                    this.liveTicks.set(sym, tickData);

                    if (this.socket && this.socket.connected) {
                        this.socket.emit('subscribe:stock', { symbols: [sym] });
                    }
                } catch {
                    // Stock not found in Data-Server — skip
                }
            }
        });
        await Promise.all(fetches);
        return result;
    }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StockDataService {
    private readonly logger = new Logger(StockDataService.name);
    private readonly baseUrl: string;

    constructor(private readonly configService: ConfigService) {
        this.baseUrl =
            this.configService.get<string>('dataServer.url') ||
            'https://samridhha-data.manasi.com.np';
        this.logger.log(`Data-Server URL: ${this.baseUrl}`);
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
            try {
                const data = await this.getStock(symbol.toUpperCase());
                result[symbol.toUpperCase()] = {
                    price: data.current_price ?? data.ltp ?? 0,
                    change_pct: data.change_pct ?? 0,
                    volume: data.volume ?? 0,
                };
            } catch {
                // Stock not found in Data-Server — skip
            }
        });
        await Promise.all(fetches);
        return result;
    }
}

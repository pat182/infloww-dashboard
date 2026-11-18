
import type { RankingResponse } from "../types/creatorType";
import type { ChatterResponse, FanCountResponse } from "../types/fanType";
import type { TransactionResponse } from "../types/transactionType";

const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3000";

export async function getTransactions(): Promise<TransactionResponse> {
    const response = await fetch(`${API_BASE_URL}/api/transactions`);

    if (!response.ok) {
        throw new Error("Failed to fetch transactions");
    }

    return response.json();
}

export async function getFanCounts(): Promise<FanCountResponse> {
    const response = await fetch(`${API_BASE_URL}/api/fans`);

    if (!response.ok) {
        throw new Error("Failed to fetch fan counts");
    }

    return response.json();
}

export async function getRankings(): Promise<RankingResponse> {
    const response = await fetch(`${API_BASE_URL}/api/rankings`);

    if (!response.ok) {
        throw new Error("Failed to fetch creator rankings");
    }

    return response.json();
}

export async function getChatters(days: number): Promise<ChatterResponse> {
    const response = await fetch(
        `${API_BASE_URL}/api/chatters?days=${days}`
    );

    if (!response.ok) {
        throw new Error("Failed to fetch chatter statistics");
    }

    return response.json();
}

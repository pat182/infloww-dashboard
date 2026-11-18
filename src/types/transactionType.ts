export interface Transaction {
    id: string;
    amount: string;
    fee: string;
    net: string;
    currency: string;
    status: string;
    createdTime: string;
    creatorId: number;
}

export interface TransactionResponse {
    dateRange: {
        startTime: string;
        endTime: string;
    };
    creatorCount: number;
    transactionCount: number;
    failedCreators: {
        creatorId: number;
        creatorName: string;
        error: string;
    }[];
    transactions: Transaction[];
}
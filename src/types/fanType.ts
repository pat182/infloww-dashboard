import type { CreatorFanData } from "./creatorType";

export interface FanCountResponse {
    creatorCount: number;
    creatorsWithFanData: number;
    date: string | null;
    activeFans: number;
    expiredFans: number;
    creators: CreatorFanData[];
}

export interface RevenueChartData {
    date: string;
    revenue: number;
}

export interface ChatterEmployee {
    employeeId: string;
    employeeName: string;
    status: string;
    chat: {
        messagesSent: number;
        ppvsSent: number;
        ppvsUnlocked: number;
        fansChatted: number;
        characterCount: number;
        goldenRatio: number;
        unlockRate: number;
    };
    sales: {
        salesAmount: number;
        ppvSalesAmount: number;
        tipsSalesAmount: number;
        directMessageSalesAmount: number;
        priorityMassMessageSalesAmount: number;
        massMessageSalesAmount: number;
        currency: string | null;
    };
}

export interface ChatterResponse {
    dateRange: {
        startTime: string;
        endTime: string;
    };
    employeeCount: number;
    activeEmployeeCount: number;
    chatRecordCount: number;
    salesRecordCount: number;
    totalChatSales: number;
    totalMessagesSent: number;
    totalPpvsSent: number;
    totalPpvsUnlocked: number;
    employees: ChatterEmployee[];
}
export interface Creator {
    id: string;
    platformPid: string;
    name: string;
    nickName: string;
    userName: string;
    tagName: string;
    createdTime: number;
    status: "connected" | "deleted";
    deletedTime: number | null;
}

export interface CreatorResponse {
    data: {
        platformCode: string;
        list: Creator[];
    };
    cursor: string | null;
    hasMore: boolean;
}


export interface GetCreatorsParams {
    cursor?: string;
    limit?: number;
    platformCode?: "OnlyFans";
}

export interface CreatorFanData {
    id: string;
    platformPid: string;
    name: string;
    nickName: string;
    userName: string;
    activeFans: number;
    expiredFans: number;
    date: string | null;
}

export interface CreatorRanking {
    id: string;
    platformPid: string;
    name: string;
    performanceRank: string | null;
    date: string | null;
}

export interface RankingResponse {
    creatorCount: number;
    creatorsWithRankingData: number;
    date: string | null;
    creators: CreatorRanking[];
}

export interface TopCreator {
    id: string;
    platformPid: string;
    name: string;
    revenue: number;
    fans: number;
    performanceRank: string | null;
}
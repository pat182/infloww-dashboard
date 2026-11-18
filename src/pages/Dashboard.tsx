
import {
    DollarSign,
    Users,
    MessageSquare,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
} from "recharts";

import AgencyStats from "../components/agencyStats";

import type {
    CreatorFanData,
    CreatorRanking,
    TopCreator,
} from "../types/creatorType";

import type {
    ChatterResponse,
    RevenueChartData,
} from "../types/fanType";

import type {
    Transaction,
    TransactionResponse,
} from "../types/transactionType";

import {
    formatChartDate,
    formatCurrency,
    getLocalDateKey,
} from "../utils";
import { getChatters, getFanCounts, getRankings, getTransactions } from "../api/api";

function buildRevenueChartData(
    transactions: Transaction[],
    dateRange: TransactionResponse["dateRange"]
): RevenueChartData[] {
    const dailyRevenue = new Map<string, number>();

    const startDate = new Date(dateRange.startTime);
    const endDate = new Date(dateRange.endTime);

    const currentDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
    );

    const lastDate = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate()
    );

    while (currentDate <= lastDate) {
        dailyRevenue.set(getLocalDateKey(currentDate), 0);
        currentDate.setDate(currentDate.getDate() + 1);
    }

    transactions.forEach((transaction) => {
        if (
            transaction.status !== "done" ||
            transaction.currency !== "USD"
        ) {
            return;
        }

        const timestamp = Number(transaction.createdTime);

        if (!Number.isFinite(timestamp)) {
            return;
        }

        const transactionDate = new Date(timestamp);

        if (Number.isNaN(transactionDate.getTime())) {
            return;
        }

        const dateKey = getLocalDateKey(transactionDate);
        const netRevenue = Number(transaction.net || 0);

        if (!Number.isFinite(netRevenue)) {
            return;
        }

        dailyRevenue.set(
            dateKey,
            (dailyRevenue.get(dateKey) || 0) + netRevenue
        );
    });

    return Array.from(dailyRevenue.entries())
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .map(([date, revenue]) => ({
            date: formatChartDate(date),
            revenue,
        }));
}



export default function Dashboard() {
    const [activeCreators, setActiveCreators] = useState(0);
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [activeFans, setActiveFans] = useState(0);

    const [chatterData, setChatterData] = useState<ChatterResponse | null>(
        null
    );

    const [chatterDays, setChatterDays] = useState<10 | 20 | 30>(30);

    const [revenueChartData, setRevenueChartData] = useState<
        RevenueChartData[]
    >([]);

    const [topCreators, setTopCreators] = useState<TopCreator[]>([]);

    const [isLoadingCreators, setIsLoadingCreators] = useState(true);
    const [isLoadingRevenue, setIsLoadingRevenue] = useState(true);
    const [isLoadingFans, setIsLoadingFans] = useState(true);
    const [isLoadingTopCreators, setIsLoadingTopCreators] = useState(true);
    const [isLoadingChatters, setIsLoadingChatters] = useState(true);

    // Fetch the main dashboard data independently of chatter statistics.
    useEffect(() => {
        let isCancelled = false;

        const fetchDashboardData = async () => {
            const results = await Promise.allSettled([
                getTransactions(),
                getFanCounts(),
                getRankings(),
            ]);

            if (isCancelled) {
                return;
            }

            const [
                transactionResult,
                fanResult,
                rankingResult,
            ] = results;

            let transactions: Transaction[] = [];
            let fanCreators: CreatorFanData[] = [];
            let creatorRankings: CreatorRanking[] = [];

            // Transactions and revenue.
            if (transactionResult.status === "fulfilled") {
                const transactionResponse = transactionResult.value;

                transactions = transactionResponse.transactions;

                if (transactionResponse.failedCreators.length > 0) {
                    console.warn(
                        "Some creators failed to load transactions:",
                        transactionResponse.failedCreators
                    );
                }

                const completedTransactions = transactions.filter(
                    (transaction) =>
                        transaction.status === "done" &&
                        transaction.currency === "USD"
                );

                const revenue = completedTransactions.reduce(
                    (total, transaction) =>
                        total + Number(transaction.net || 0),
                    0
                );

                setTotalRevenue(revenue);

                const chartData = buildRevenueChartData(
                    transactions,
                    transactionResponse.dateRange
                );

                setRevenueChartData(chartData);
            } else {
                console.error(
                    "Failed to fetch transactions:",
                    transactionResult.reason
                );
            }

            // Agency totals and individual creator fan counts.
            if (fanResult.status === "fulfilled") {
                const fanResponse = fanResult.value;

                setActiveCreators(fanResponse.creatorCount);
                setActiveFans(fanResponse.activeFans);

                fanCreators = fanResponse.creators || [];
            } else {
                console.error(
                    "Failed to fetch fan counts:",
                    fanResult.reason
                );
            }

            // Individual creator performance rankings.
            if (rankingResult.status === "fulfilled") {
                creatorRankings = rankingResult.value.creators || [];
            } else {
                console.error(
                    "Failed to fetch creator rankings:",
                    rankingResult.reason
                );
            }

            // Calculate revenue per creator using creatorId.
            const revenueByCreator = new Map<string, number>();

            transactions.forEach((transaction) => {
                if (
                    transaction.status !== "done" ||
                    transaction.currency !== "USD"
                ) {
                    return;
                }

                const creatorId = String(transaction.creatorId);
                const netRevenue = Number(transaction.net || 0);

                if (!Number.isFinite(netRevenue)) {
                    return;
                }

                revenueByCreator.set(
                    creatorId,
                    (revenueByCreator.get(creatorId) || 0) + netRevenue
                );
            });

            // Match ranking data using platformPid.
            const rankingByPlatformPid = new Map<
                string,
                CreatorRanking
            >();

            creatorRankings.forEach((ranking) => {
                rankingByPlatformPid.set(
                    String(ranking.platformPid),
                    ranking
                );
            });

            // Combine creator, revenue, fan count, and ranking data.
            const combinedCreators: TopCreator[] = fanCreators.map(
                (creator) => {
                    const ranking = rankingByPlatformPid.get(
                        String(creator.platformPid)
                    );

                    return {
                        id: creator.id,
                        platformPid: creator.platformPid,
                        name: creator.name,
                        revenue:
                            revenueByCreator.get(String(creator.id)) || 0,
                        fans: creator.activeFans,
                        performanceRank:
                            ranking?.performanceRank ?? null,
                    };
                }
            );

            combinedCreators.sort(
                (a, b) => b.revenue - a.revenue
            );

            setTopCreators(combinedCreators.slice(0, 4));

            setIsLoadingCreators(false);
            setIsLoadingRevenue(false);
            setIsLoadingFans(false);
            setIsLoadingTopCreators(false);
        };

        fetchDashboardData();

        return () => {
            isCancelled = true;
        };
    }, []);

    // Fetch chatter statistics whenever the selected reporting period changes.
    useEffect(() => {
        let isCancelled = false;

        const fetchChatterData = async () => {
            setIsLoadingChatters(true);

            try {
                const response = await getChatters(chatterDays);

                if (!isCancelled) {
                    setChatterData(response);
                }
            } catch (error) {
                if (!isCancelled) {
                    console.error(
                        "Failed to fetch chatter statistics:",
                        error
                    );
                }
            } finally {
                if (!isCancelled) {
                    setIsLoadingChatters(false);
                }
            }
        };

        fetchChatterData();

        return () => {
            isCancelled = true;
        };
    }, [chatterDays]);

    const chatterEmployees = chatterData?.employees || [];

    const topChatters = [...chatterEmployees]
        .sort(
            (a, b) =>
                b.sales.salesAmount - a.sales.salesAmount
        )
        .slice(0, 10);

    const totalPpvsSent = chatterData?.totalPpvsSent || 0;
    const totalPpvsUnlocked = chatterData?.totalPpvsUnlocked || 0;

    const overallUnlockRate =
        totalPpvsSent > 0
            ? (totalPpvsUnlocked / totalPpvsSent) * 100
            : 0;

    return (
        <div className="space-y-8">

            {/* Page Header */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        Dashboard
                    </h1>

                    <p className="mt-1 text-sm text-gray-400">
                        Here's what's happening with your agency.
                    </p>
                </div>

                <div className="rounded-lg border border-white/10 bg-[#151820] px-4 py-2.5 text-sm text-gray-300">
                    Last 30 days
                </div>
            </div>

            {/* Agency Statistics */}
            <AgencyStats
                activeCreators={activeCreators}
                totalRevenue={totalRevenue}
                activeFans={activeFans}
                isLoadingCreators={isLoadingCreators}
                isLoadingRevenue={isLoadingRevenue}
                isLoadingFans={isLoadingFans}
            />

            {/* Revenue Chart */}
            <div className="rounded-xl border border-white/10 bg-[#11151D] p-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="font-semibold">
                            Revenue Overview
                        </h2>

                        <p className="mt-1 text-xs text-gray-500">
                            Daily completed transaction revenue
                        </p>
                    </div>
                </div>

                <div className="h-[300px] w-full">
                    {isLoadingRevenue ? (
                        <div className="flex h-full items-center justify-center text-sm text-gray-500">
                            Loading revenue data...
                        </div>
                    ) : revenueChartData.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-sm text-gray-500">
                            No revenue data available.
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueChartData}>
                                <defs>
                                    <linearGradient
                                        id="revenueGradient"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="0%"
                                            stopColor="#8b5cf6"
                                            stopOpacity={0.3}
                                        />

                                        <stop
                                            offset="95%"
                                            stopColor="#8b5cf6"
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid
                                    stroke="#ffffff0d"
                                    vertical={false}
                                />

                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{
                                        fill: "#6b7280",
                                        fontSize: 12,
                                    }}
                                    dy={10}
                                />

                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{
                                        fill: "#6b7280",
                                        fontSize: 12,
                                    }}
                                    tickFormatter={(value) =>
                                        value >= 1000
                                            ? `$${(value / 1000).toFixed(1)}k`
                                            : `$${value}`
                                    }
                                />

                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: "#1a1d27",
                                        border: "1px solid #ffffff1a",
                                        borderRadius: "10px",
                                        color: "#fff",
                                    }}
                                    formatter={(value) => [
                                        formatCurrency(Number(value)),
                                        "Revenue",
                                    ]}
                                />

                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#8b5cf6"
                                    strokeWidth={2.5}
                                    fill="url(#revenueGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Top Creators */}
            <div className="rounded-xl border border-white/10 bg-[#11151D]">
                <div className="flex items-center justify-between border-b border-white/10 p-6">
                    <div>
                        <h2 className="font-semibold">
                            Top Performing Creators
                        </h2>

                        <p className="mt-1 text-xs text-gray-500">
                            Creators ranked by revenue
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-white/10 text-xs text-gray-500">
                            <tr>
                                <th className="px-6 py-4 font-medium">
                                    Creator
                                </th>

                                <th className="px-6 py-4 font-medium">
                                    Revenue
                                </th>

                                <th className="px-6 py-4 font-medium">
                                    Fans
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {isLoadingTopCreators ? (
                                <tr>
                                    <td
                                        colSpan={3}
                                        className="px-6 py-8 text-center text-sm text-gray-500"
                                    >
                                        Loading creator performance...
                                    </td>
                                </tr>
                            ) : topCreators.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={3}
                                        className="px-6 py-8 text-center text-sm text-gray-500"
                                    >
                                        No creator data available.
                                    </td>
                                </tr>
                            ) : (
                                topCreators.map((creator, index) => (
                                    <tr
                                        key={creator.id}
                                        className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/10 text-xs font-semibold text-violet-400">
                                                    {creator.name.charAt(0)}
                                                </div>

                                                <div>
                                                    <p className="font-medium">
                                                        {creator.name}
                                                    </p>

                                                    <p className="text-xs text-gray-500">
                                                        Revenue rank #{index + 1}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 font-medium">
                                            {formatCurrency(creator.revenue)}
                                        </td>

                                        <td className="px-6 py-4 text-gray-400">
                                            {creator.fans.toLocaleString()}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Chatter Performance */}
            <div className="space-y-4">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h2 className="text-lg font-semibold">
                            Chatter Performance
                        </h2>

                        <p className="mt-1 text-xs text-gray-500">
                            Employee chat activity and attributed sales
                        </p>
                    </div>

                    {/* Chatter Reporting Period */}
                    <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#151820] p-1">
                        {([10, 20, 30] as const).map((days) => (
                            <button
                                key={days}
                                type="button"
                                onClick={() => setChatterDays(days)}
                                disabled={isLoadingChatters}
                                className={`rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                                    chatterDays === days
                                        ? "bg-violet-500 text-white"
                                        : "text-gray-400 hover:bg-white/5 hover:text-white"
                                } disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                                {days} days
                            </button>
                        ))}
                    </div>
                </div>

                {/* Chatter Statistics */}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

                    {/* Active Chatters */}
                    <div className="rounded-xl border border-white/10 bg-[#11151D] p-5">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-400">
                                Active Chatters
                            </p>

                            <Users size={19} className="text-violet-400" />
                        </div>

                        <h3 className="mt-3 text-2xl font-bold">
                            {isLoadingChatters
                                ? "Loading..."
                                : (chatterData?.activeEmployeeCount || 0).toLocaleString()}
                        </h3>

                        <p className="mt-1 text-xs text-gray-500">
                            Currently activated employees
                        </p>
                    </div>

                    {/* Chatter Revenue */}
                    <div className="rounded-xl border border-white/10 bg-[#11151D] p-5">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-400">
                                Chatter Revenue
                            </p>

                            <DollarSign size={19} className="text-violet-400" />
                        </div>

                        <h3 className="mt-3 text-2xl font-bold">
                            {isLoadingChatters
                                ? "Loading..."
                                : formatCurrency(
                                    chatterData?.totalChatSales || 0
                                )}
                        </h3>

                        <p className="mt-1 text-xs text-gray-500">
                            Employee-attributed sales
                        </p>
                    </div>

                    {/* Messages Sent */}
                    <div className="rounded-xl border border-white/10 bg-[#11151D] p-5">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-400">
                                Messages Sent
                            </p>

                            <MessageSquare size={19} className="text-violet-400" />
                        </div>

                        <h3 className="mt-3 text-2xl font-bold">
                            {isLoadingChatters
                                ? "Loading..."
                                : (chatterData?.totalMessagesSent || 0).toLocaleString()}
                        </h3>

                        <p className="mt-1 text-xs text-gray-500">
                            Direct messages sent
                        </p>
                    </div>

                    {/* PPVs Unlocked */}
                    <div className="rounded-xl border border-white/10 bg-[#11151D] p-5">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-400">
                                PPVs Unlocked
                            </p>

                            <MessageSquare size={19} className="text-violet-400" />
                        </div>

                        <h3 className="mt-3 text-2xl font-bold">
                            {isLoadingChatters
                                ? "Loading..."
                                : totalPpvsUnlocked.toLocaleString()}
                        </h3>

                        <p className="mt-1 text-xs text-gray-500">
                            Total unlocked PPVs
                        </p>
                    </div>

                    {/* PPV Unlock Rate */}
                    <div className="rounded-xl border border-white/10 bg-[#11151D] p-5">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-400">
                                PPV Unlock Rate
                            </p>

                            <MessageSquare size={19} className="text-violet-400" />
                        </div>

                        <h3 className="mt-3 text-2xl font-bold">
                            {isLoadingChatters
                                ? "Loading..."
                                : `${overallUnlockRate.toFixed(2)}%`}
                        </h3>

                        <p className="mt-1 text-xs text-gray-500">
                            Unlocked PPVs / PPVs sent
                        </p>
                    </div>
                </div>

                {/* Chatter Leaderboard */}
                <div className="rounded-xl border border-white/10 bg-[#11151D]">
                    <div className="border-b border-white/10 p-6">
                        <h3 className="font-semibold">
                            Top Chatters
                        </h3>

                        <p className="mt-1 text-xs text-gray-500">
                            Ranked by employee-attributed sales
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-white/10 text-xs text-gray-500">
                                <tr>
                                    <th className="px-6 py-4 font-medium">
                                        Chatter
                                    </th>

                                    <th className="px-6 py-4 font-medium">
                                        Messages
                                    </th>

                                    <th className="px-6 py-4 font-medium">
                                        PPVs Sent
                                    </th>

                                    <th className="px-6 py-4 font-medium">
                                        PPVs Unlocked
                                    </th>

                                    <th className="px-6 py-4 font-medium">
                                        Unlock Rate
                                    </th>

                                    <th className="px-6 py-4 font-medium">
                                        Sales
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {isLoadingChatters ? (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-6 py-8 text-center text-sm text-gray-500"
                                        >
                                            Loading chatter performance...
                                        </td>
                                    </tr>
                                ) : topChatters.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="px-6 py-8 text-center text-sm text-gray-500"
                                        >
                                            No chatter data available.
                                        </td>
                                    </tr>
                                ) : (
                                    topChatters.map((chatter, index) => (
                                        <tr
                                            key={chatter.employeeId}
                                            className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/10 text-xs font-semibold text-violet-400">
                                                        {chatter.employeeName.charAt(0)}
                                                    </div>

                                                    <div>
                                                        <p className="font-medium">
                                                            {chatter.employeeName}
                                                        </p>

                                                        <p className="text-xs text-gray-500">
                                                            {chatter.status}
                                                            {" · "}
                                                            Rank #{index + 1}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 text-gray-400">
                                                {chatter.chat.messagesSent.toLocaleString()}
                                            </td>

                                            <td className="px-6 py-4 text-gray-400">
                                                {chatter.chat.ppvsSent.toLocaleString()}
                                            </td>

                                            <td className="px-6 py-4 text-gray-400">
                                                {chatter.chat.ppvsUnlocked.toLocaleString()}
                                            </td>

                                            <td className="px-6 py-4 text-gray-400">
                                                {chatter.chat.unlockRate.toFixed(2)}%
                                            </td>

                                            <td className="px-6 py-4 font-medium">
                                                {formatCurrency(
                                                    chatter.sales.salesAmount
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    );
}

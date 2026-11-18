
import {
    DollarSign,
    Users,
    UserPlus,
} from "lucide-react";

import { formatCurrency } from "../utils";

interface AgencyStatsProps {
    activeCreators: number;
    totalRevenue: number;
    activeFans: number;
    isLoadingCreators: boolean;
    isLoadingRevenue: boolean;
    isLoadingFans: boolean;
}

const stats = [
    {
        title: "Total Revenue",
        icon: DollarSign,
    },
    {
        title: "Active Creators",
        icon: Users,
    },
    {
        title: "Active Fans",
        icon: UserPlus,
    },
];

export default function AgencyStats({
    activeCreators,
    totalRevenue,
    activeFans,
    isLoadingCreators,
    isLoadingRevenue,
    isLoadingFans,
}: AgencyStatsProps) {
    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {stats.map((stat) => {
                const Icon = stat.icon;

                return (
                    <div
                        key={stat.title}
                        className="rounded-xl border border-white/10 bg-[#11151D] p-5"
                    >
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-400">
                                {stat.title}
                            </p>

                            <div className="rounded-lg bg-violet-500/10 p-2 text-violet-400">
                                <Icon size={19} />
                            </div>
                        </div>

                        <h2 className="mt-4 text-2xl font-bold tracking-tight">
                            {stat.title === "Active Creators"
                                ? isLoadingCreators
                                    ? "Loading..."
                                    : activeCreators.toLocaleString()
                                : stat.title === "Total Revenue"
                                    ? isLoadingRevenue
                                        ? "Loading..."
                                        : formatCurrency(totalRevenue)
                                    : isLoadingFans
                                        ? "Loading..."
                                        : activeFans.toLocaleString()}
                        </h2>
                    </div>
                );
            })}
        </div>
    );
}

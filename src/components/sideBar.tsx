
import {
  LayoutDashboard,
  ChartNoAxesCombined,
  Settings,

} from "lucide-react";

const navigation = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    path: "/",
  },
  // {
  //   name: "Creators",
  //   icon: Users,
  //   path: "/creators",
  // },
  // {
  //   name: "Chatters",
  //   icon: MessageSquare,
  //   path: "/chatters",
  // },
  // {
  //   name: "Fans",
  //   icon: UserRound,
  //   path: "/fans",
  // },
  // {
  //   name: "Promotions",
  //   icon: Megaphone,
  //   path: "/promotions",
  // },
  // {
  //   name: "Revenue",
  //   icon: ChartNoAxesCombined,
  //   path: "/revenue",
  // },
];

export default function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-white/10 bg-[#111318] text-white">
      {/* Brand */}
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600">
                <ChartNoAxesCombined size={22} />
            </div>

            <div>
                <h1 className="text-lg font-bold tracking-tight">
                  mu<span className="text-violet-400">SE</span>
                </h1>
                <p className="text-xs text-gray-500">Management Dashboard</p>
            </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
            {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = window.location.pathname === item.path;
                return (
                <a
                    key={item.name}
                    href={item.path}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isActive
                        ? "bg-violet-600/15 font-medium text-violet-400"
                        : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                >
                    <Icon size={19} strokeWidth={1.8} />
                    <span>{item.name}</span>
                </a>
                );
            })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-white/10 p-4">
            <a
                href="/settings"
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
            >
            <Settings size={19} />
            Settings
            </a>

            <div className="mt-4 flex items-center gap-3 rounded-lg bg-white/5 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold">
                    A
                </div>

                <div className="min-w-0">
                    <p className="truncate text-sm font-medium">Agency Admin</p>
                    <p className="text-xs text-gray-500">Administrator</p>
                </div>
            </div>
        </div>
    </aside>
  );
}

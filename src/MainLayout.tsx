import { Outlet } from "react-router-dom";
import Sidebar from "./components/sideBar";

export default function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0B0D12] text-white">
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1600px] p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

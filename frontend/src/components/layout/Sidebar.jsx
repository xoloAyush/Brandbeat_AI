
import { NavLink } from "react-router-dom";
import { useSelector } from "react-redux";

import {
  LayoutDashboard,
  FilePlus,
  Files,
  ShieldCheck,
  Settings,
  Sparkles,
  X,
} from "lucide-react";

const navItems = [
  {
    name: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
    roles: ["admin", "reviewer"],
  },
  {
    name: "New Review",
    path: "/new-review",
    icon: FilePlus,
    roles: ["admin", "reviewer"],
  },
  {
    name: "Documents",
    path: "/documents",
    icon: Files,
    roles: ["admin", "reviewer"],
  },
  {
    name: "Policy Library",
    path: "/policies",
    icon: ShieldCheck,
    roles: ["admin", "reviewer"],
  },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useSelector((state) => state.auth);

  const visibleNavItems = navItems.filter((item) =>
    item.roles.includes(user?.role)
  );

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
    >
      {/* Brand */}
      <div className="flex h-20 shrink-0 items-center justify-between border-b border-slate-100 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-slate-950">
            <ShieldCheck size={23} />
          </div>

          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              Brandbeat
            </h1>
            <p className="text-xs text-slate-500">AI Governance</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close sidebar"
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 lg:hidden"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
          Workspace
        </p>

        <nav className="space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-4 py-3 transition ${isActive
                    ? "bg-[#FFF0B3] font-semibold text-slate-950"
                    : "text-slate-600 hover:bg-slate-100"
                  }`
                }
              >
                <Icon size={20} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* AI Information Card */}
        <div className="mt-10 rounded-xl bg-slate-900 p-4 text-white">
          <Sparkles className="mb-3 text-amber-400" size={20} />

          <p className="text-sm font-semibold">
            AI-powered governance
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            Review content against your approved brand policies.
          </p>
        </div>
      </div>

      {/* Bottom section */}
      <div className="shrink-0 space-y-4 border-t border-slate-100 p-4">
        <NavLink
          to="/settings"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition ${isActive
              ? "bg-[#FFF0B3] font-semibold text-slate-950"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
            }`
          }
        >
          <Settings size={19} />
          Settings
        </NavLink>

        <div className="border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500">
            Brandbeat AI v1.0
          </p>
        </div>
      </div>
    </aside>
  );
}

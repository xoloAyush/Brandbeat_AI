
import {
  Bell,
  Search,
  ChevronDown,
  Menu,
} from "lucide-react";

export default function Header({ onMenuClick }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:h-20 sm:px-6 lg:px-8">

      {/* Left section */}
      <div className="flex min-w-0 items-center gap-3">

        {/* Mobile menu */}
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="rounded-lg p-2 text-slate-700 transition hover:bg-slate-100 lg:hidden"
        >
          <Menu size={22} />
        </button>

        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-slate-950 sm:text-lg">
            Workspace
          </h2>

          <p className="hidden text-xs text-slate-600 sm:block">
            Manage your brand compliance workflow
          </p>
        </div>

      </div>

      {/* Right section */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-3">

        <button
          type="button"
          aria-label="Search"
          className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
        >
          <Search size={19} />
        </button>

        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
        >
          <Bell size={19} />

          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-400" />
        </button>

        {/* Profile */}
        <div className="ml-1 flex items-center gap-2 border-l border-slate-200 pl-3 sm:ml-2 sm:gap-3 sm:pl-4">

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
            A
          </div>

          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-900">
              Admin
            </p>

            <p className="text-xs text-slate-500">
              Administrator
            </p>
          </div>

          <ChevronDown
            size={16}
            className="hidden text-slate-400 sm:block"
          />

        </div>
      </div>

    </header>
  );
}

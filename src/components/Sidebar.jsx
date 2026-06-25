import React from 'react';
import { 
  Home, 
  BarChart3, 
  Settings, 
  Users, 
  Layers, 
  Activity, 
  ChevronLeft, 
  ChevronRight,
  Sparkles,
  HelpCircle,
  LogOut
} from 'lucide-react';

export default function Sidebar({ collapsed, setCollapsed, activeTab, setActiveTab }) {
  const menuItems = [
    { id: 'dashboard', label: 'Resumen', icon: Home },
    { id: 'analytics', label: 'Analíticas', icon: BarChart3, badge: 'Nuevo' },
    { id: 'users', label: 'Clientes', icon: Users },
    { id: 'system', label: 'Servidor', icon: Activity },
    { id: 'projects', label: 'Proyectos', icon: Layers, badge: '5' },
    { id: 'settings', label: 'Configuración', icon: Settings },
  ];

  return (
    <aside 
      className={`fixed top-0 left-0 h-screen z-30 transition-all duration-300 ease-in-out border-r
        ${collapsed ? 'w-20' : 'w-64'} 
        background-color:var(--color-card-dark) border-color:var(--color-border-dark) 
        bg-[#121214]/80 backdrop-blur-xl border-[#222226] text-zinc-300 flex flex-col`}
    >
      {/* Header / Brand */}
      <div className="p-5 flex items-center justify-between border-b border-[#222226] h-16">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          {!collapsed && (
            <span className="font-extrabold text-xl bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent font-sans tracking-wide">
              Dashy
            </span>
          )}
        </div>

        <button 
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg border border-[#222226] bg-[#18181b] hover:bg-[#27272a] hover:text-white transition-all cursor-pointer"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative cursor-pointer
                ${isActive 
                  ? 'bg-indigo-600/10 text-indigo-400 shadow-sm border border-indigo-500/15' 
                  : 'hover:bg-zinc-800/40 hover:text-white border border-transparent'
                }`}
            >
              {/* Active Marker Line */}
              {isActive && (
                <span className="absolute left-0 top-3 bottom-3 w-1 bg-indigo-500 rounded-r-md" />
              )}
              
              <Icon className={`w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-105
                ${isActive ? 'text-indigo-400' : 'text-zinc-400 group-hover:text-white'}`} 
              />
              
              {!collapsed && (
                <span className="truncate font-sans font-medium">{item.label}</span>
              )}

              {/* Badges */}
              {!collapsed && item.badge && (
                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wide
                  ${item.id === 'analytics' 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                    : 'bg-zinc-700/50 text-zinc-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}

              {/* Tooltip for Collapsed Sidebar */}
              {collapsed && (
                <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs font-semibold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 shadow-xl whitespace-nowrap z-50">
                  {item.label}
                  {item.badge && <span className="ml-1.5 text-[9px] text-indigo-400 font-bold">({item.badge})</span>}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / User Profile Summary when expanded / collapsed */}
      <div className="p-4 border-t border-[#222226] bg-[#121214]/50 flex flex-col gap-2">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3 p-1.5 rounded-lg">
              <div className="relative shrink-0">
                <img 
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&h=80&q=80" 
                  alt="Avatar" 
                  className="w-10 h-10 rounded-xl object-cover ring-2 ring-indigo-500/20"
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#121214] rounded-full" />
              </div>
              <div className="overflow-hidden">
                <h4 className="text-xs font-bold text-white truncate font-sans">Sander Peguero</h4>
                <p className="text-[10px] text-zinc-500 truncate font-sans">sander@dashy.io</p>
              </div>
            </div>
            <button className="w-full flex items-center justify-center gap-2 mt-2 px-3 py-2 border border-zinc-800 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 text-zinc-400 rounded-xl text-xs font-semibold transition-all cursor-pointer">
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar Sesión</span>
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="relative cursor-pointer group">
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&h=80&q=80" 
                alt="Avatar" 
                className="w-9 h-9 rounded-xl object-cover ring-2 ring-indigo-500/20"
              />
              <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-[#121214] rounded-full" />
              <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 text-zinc-200 text-xs font-semibold rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 shadow-xl whitespace-nowrap z-50">
                Sander Peguero (Admin)
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

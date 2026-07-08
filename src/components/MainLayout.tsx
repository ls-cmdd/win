import React, { useMemo } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { 
  LayoutDashboard, Users, CreditCard, CalendarDays, 
  Settings, FileText, LogOut, Globe, Bell, PieChart
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function MainLayout() {
  const { t } = useTranslation();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const toggleLanguage = useAppStore((state) => state.toggleLanguage);
  const language = useAppStore((state) => state.language);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: "/", icon: LayoutDashboard, label: t('dashboard') },
    { to: "/subscribers", icon: Users, label: t('subscribers') },
    { to: "/plans", icon: FileText, label: t('plans') },
    { to: "/subscriptions", icon: CalendarDays, label: t('subscriptions') },
    { to: "/payments", icon: CreditCard, label: t('payments') },
    { to: "/reports", icon: PieChart, label: t('reports') },
    { to: "/settings", icon: Settings, label: t('settings') },
  ];

  const currentPageTitle = useMemo(() => {
    const item = navItems.find(nav => nav.to === location.pathname);
    return item ? item.label : 'اشتراكي';
  }, [location.pathname, navItems]);

  return (
    <div className={cn("flex h-screen bg-surface-50 text-surface-900 font-sans", language === 'ar' ? 'dir-rtl' : 'dir-ltr')}>
      {/* Sidebar */}
      <aside className="w-64 bg-white border-e border-surface-200 flex flex-col transition-all shadow-sm z-10">
        <div className="h-16 flex items-center px-6 border-b border-surface-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold">
              S
            </div>
            <h1 className="text-xl font-bold tracking-tight text-surface-900">اشتراكي</h1>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto scrollbar-hide">
          <div className="mb-4 text-xs font-semibold text-surface-400 uppercase tracking-wider px-3">
            {t('menu', 'Menu')}
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                  isActive
                    ? "bg-primary-50 text-primary-700"
                    : "text-surface-600 hover:bg-surface-100 hover:text-surface-900"
                )
              }
            >
              <item.icon className={cn("w-5 h-5 transition-colors", 
                location.pathname === item.to ? "text-primary-600" : "text-surface-400 group-hover:text-surface-600"
              )} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-surface-200 bg-surface-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold uppercase">
                {user?.username?.charAt(0) || 'U'}
              </div>
              <div className="text-sm">
                <p className="font-medium text-surface-900 leading-none">{user?.username}</p>
                <p className="text-xs text-surface-500 capitalize mt-1">{user?.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-surface-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
              title={t('logout')}
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-surface-200 flex items-center justify-between px-8 sticky top-0 z-20">
          <h2 className="text-xl font-bold tracking-tight text-surface-900">
            {currentPageTitle}
          </h2>
          
          <div className="flex items-center gap-4">
            <button className="relative p-2 text-surface-400 hover:text-surface-600 transition-colors rounded-full hover:bg-surface-100">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"></span>
            </button>
            <div className="w-px h-6 bg-surface-200 mx-1"></div>
            <button 
              onClick={toggleLanguage}
              className="flex items-center gap-2 text-sm font-medium text-surface-600 hover:text-primary-700 bg-surface-100/50 hover:bg-primary-50 px-3 py-1.5 rounded-lg transition-colors border border-surface-200 hover:border-primary-200"
            >
              <Globe className="w-4 h-4" />
              {language === 'ar' ? 'English' : 'عربي'}
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-8 scrollbar-hide">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}

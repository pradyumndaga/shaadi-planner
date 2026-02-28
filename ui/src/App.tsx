import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { LayoutDashboard, Users, Bed, Plane, Wallet, LogOut, Settings as SettingsIcon, Menu, X, Sparkles, MessageCircle, Sun, Moon, Monitor } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Guests from './pages/Guests';
import Rooms from './pages/Rooms';
import Travel from './pages/Travel';
import Finance from './pages/Finance';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Settings from './pages/Settings';
import AI from './pages/AI';
import Notify from './pages/Notify';
import ProtectedRoute, { logout } from './components/ProtectedRoute';
import { AccessProvider } from './AccessContext';
import { ThemeProvider, useTheme } from './ThemeContext';
import { API_BASE_URL, authFetch } from './config';

const menuItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Guests', path: '/guests', icon: Users },
  { name: 'Rooms', path: '/rooms', icon: Bed },
  { name: 'Travel', path: '/travel', icon: Plane },
  { name: 'Finance', path: '/finance', icon: Wallet },
  { name: 'AI Studio', path: '/ai', icon: Sparkles, beta: true },
  { name: 'Notify', path: '/notify', icon: MessageCircle, beta: true },
];

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unnotifiedCount, setUnnotifiedCount] = useState(0);
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const getThemeIcon = () => {
    if (theme === 'light') return <Sun size={20} />;
    if (theme === 'dark') return <Moon size={20} />;
    return <Monitor size={20} />;
  };

  useEffect(() => {
    const isAuthPage = ['/login', '/signup'].includes(location.pathname);
    if (isAuthPage) {
      setUnnotifiedCount(0);
      return;
    }

    const fetchStats = () => {
      authFetch(`${API_BASE_URL}/api/stats`)
        .then(res => res.json())
        .then(data => setUnnotifiedCount(data.unnotifiedGuests || 0))
        .catch(() => { });
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, [location.pathname]);

  const isAuthPage = ['/login', '/signup'].includes(location.pathname);

  if (isAuthPage) return <>{children}</>;

  const SidebarContent = () => (
    <>
      <div className="p-6 flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-brand-700 dark:text-brand-500 tracking-tight flex items-center gap-2">
          ShaadiDesk
        </h1>
        <button className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" onClick={() => setMobileMenuOpen(false)}>
          <X size={24} />
        </button>
      </div>
      <nav className="flex-1 min-h-0 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${isActive
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-slate-800 dark:hover:text-gray-100'
                }`}
            >
              <Icon size={20} className={isActive ? 'text-brand-600 dark:text-brand-500' : 'text-gray-400 dark:text-gray-500'} />
              {item.name}
              {item.name === 'Notify' && unnotifiedCount > 0 && (
                <span className="ml-2 flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
              )}
              {item.beta && (
                <span className="ml-auto text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 dark:bg-brand-900/50 dark:text-brand-400 tracking-wider">
                  Beta
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-50 dark:border-slate-800 flex flex-col gap-2 shrink-0">
        {/* Quick Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-slate-800 dark:hover:text-gray-100 transition-colors"
          title={`Current theme: ${theme}. Click to toggle.`}
        >
          <div className="flex items-center gap-3">
            {getThemeIcon()}
            <span className="capitalize">{theme} Theme</span>
          </div>
        </button>

        <Link
          to="/settings"
          onClick={() => setMobileMenuOpen(false)}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${location.pathname === '/settings'
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-slate-800 dark:hover:text-gray-100'
            }`}
        >
          <SettingsIcon size={20} className={location.pathname === '/settings' ? 'text-brand-600 dark:text-brand-500' : 'text-gray-400 dark:text-gray-500'} />
          Settings
        </Link>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut size={20} />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background dark:bg-slate-900 overflow-hidden transition-colors duration-200">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 z-10 transition-colors duration-200">
        <h1 className="text-xl font-display font-bold text-brand-700 dark:text-brand-500 tracking-tight flex items-center gap-2">
          ShaadiDesk
        </h1>
        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
            {getThemeIcon()}
          </button>
          <button onClick={() => setMobileMenuOpen(true)} className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
            <Menu size={24} />
          </button>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 hidden md:flex flex-col flex-shrink-0 overflow-hidden transition-colors duration-200">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-gray-900/50 dark:bg-black/60 transition-opacity" onClick={() => setMobileMenuOpen(false)}></div>
          <aside className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-slate-900 shadow-xl overflow-hidden transition-colors duration-200">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full">
        <div className="p-4 md:p-8 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AccessProvider>
          <Toaster position="top-right" reverseOrder={false}
            toastOptions={{
              className: 'dark:bg-slate-800 dark:text-white dark:border-slate-700',
              style: {
                transition: 'all 0.2s ease',
              }
            }}
          />
          <Layout>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/guests" element={<ProtectedRoute><Guests /></ProtectedRoute>} />
              <Route path="/rooms" element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
              <Route path="/travel" element={<ProtectedRoute><Travel /></ProtectedRoute>} />
              <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
              <Route path="/ai" element={<ProtectedRoute><AI /></ProtectedRoute>} />
              <Route path="/notify" element={<ProtectedRoute><Notify /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </AccessProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

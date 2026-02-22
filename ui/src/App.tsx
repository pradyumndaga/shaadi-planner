import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { LayoutDashboard, Users, Bed, Plane, Wallet, LogOut } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Guests from './pages/Guests';
import Rooms from './pages/Rooms';
import Travel from './pages/Travel';
import Finance from './pages/Finance';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ProtectedRoute, { logout } from './components/ProtectedRoute';

const menuItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Guests', path: '/guests', icon: Users },
  { name: 'Rooms', path: '/rooms', icon: Bed },
  { name: 'Travel', path: '/travel', icon: Plane },
  { name: 'Finance', path: '/finance', icon: Wallet },
];

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isAuthPage = ['/login', '/signup'].includes(location.pathname);

  if (isAuthPage) return <>{children}</>;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 hidden md:flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-display font-bold text-brand-700 tracking-tight flex items-center gap-2">
            ShaadiPlanner
          </h1>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                <Icon size={20} className={isActive ? 'text-brand-600' : 'text-gray-400'} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-50">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" reverseOrder={false} />
      <Layout>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/guests" element={<ProtectedRoute><Guests /></ProtectedRoute>} />
          <Route path="/rooms" element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
          <Route path="/travel" element={<ProtectedRoute><Travel /></ProtectedRoute>} />
          <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

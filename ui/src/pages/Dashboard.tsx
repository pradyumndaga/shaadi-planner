import { useEffect, useState } from 'react';
import { Bed, CreditCard, Banknote, UserCheck, UserMinus, Share2, Users, Link as LinkIcon, Unlink } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL, authFetch } from '../config';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

interface DashboardStats {
    totalGuests: number;
    tentativeGuests: number;
    visitingGuests: number;
    unassignedGuests: number;
    totalRooms: number;
    totalCapacity: number;
    remainingCapacity: number;
    totalSpent: number;
}

export default function Dashboard() {
    const [stats, setStats] = useState<DashboardStats>({
        totalGuests: 0,
        tentativeGuests: 0,
        visitingGuests: 0,
        unassignedGuests: 0,
        totalRooms: 0,
        totalCapacity: 0,
        remainingCapacity: 0,
        totalSpent: 0
    });

    const [loading, setLoading] = useState(true);
    const [accessData, setAccessData] = useState<{
        shareCode: string | null;
        primaryUser: { mobile: string } | null;
        sharedUsers: { mobile: string }[];
    } | null>(null);
    const [joinCode, setJoinCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);

    useEffect(() => {
        Promise.all([
            authFetch(`${API_BASE_URL}/api/stats`).then(res => res.json()),
            authFetch(`${API_BASE_URL}/api/user/share-code`).then(res => res.json())
        ])
            .then(([statsData, access]) => {
                setStats(statsData);
                setAccessData(access);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching dashboard data:', err);
                setLoading(false);
            });
    }, []);

    const handleJoin = async () => {
        if (!joinCode.trim()) return;
        setIsJoining(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/api/user/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shareCode: joinCode.trim() })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to join');

            toast.success(data.message);
            setTimeout(() => window.location.reload(), 1000);
        } catch (err: any) {
            toast.error(err.message);
            setIsJoining(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Are you sure you want to disconnect from this wedding?')) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/api/user/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shareCode: null }) // null disconnects
            });
            if (res.ok) {
                toast.success('Disconnected successfully');
                setTimeout(() => window.location.reload(), 1000);
            }
        } catch (err: any) {
            toast.error('Failed to disconnect');
        }
    };

    const statCards = [
        {
            title: 'Visiting Guests',
            value: stats.visitingGuests,
            subvalue: `${stats.unassignedGuests} need rooms`,
            icon: UserCheck,
            color: 'bg-green-50 text-green-600',
        },
        {
            title: 'Tentative Guests',
            value: stats.tentativeGuests,
            subvalue: 'might not attend',
            icon: UserMinus,
            color: 'bg-orange-50 text-orange-600',
        },
        {
            title: 'Total Rooms',
            value: stats.totalRooms,
            subvalue: `Capacity: ${stats.totalCapacity}`,
            icon: Bed,
            color: 'bg-brand-50 text-brand-600',
        },
        {
            title: 'Room Availability',
            value: stats.remainingCapacity,
            subvalue: 'slots remaining',
            icon: CreditCard,
            color: 'bg-emerald-50 text-emerald-600',
        },
        {
            title: 'Total Expense',
            value: `₹${stats.totalSpent.toLocaleString()}`,
            subvalue: 'till date',
            icon: Banknote,
            color: 'bg-indigo-50 text-indigo-600',
        },
    ];

    const attendanceData = [
        { name: 'Visiting', value: stats.visitingGuests, color: '#10b981' }, // emerald-500
        { name: 'Tentative', value: stats.tentativeGuests, color: '#f97316' }  // orange-500
    ];

    const occupancyData = [
        { name: 'Room Occupancy', Allocated: stats.totalCapacity - stats.remainingCapacity, Available: stats.remainingCapacity }
    ];

    if (loading) return <div className="text-center mt-10">Loading Dashboard...</div>;

    return (
        <div className="animate-fade-in">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-display text-gray-900">Dashboard</h1>
                <p className="text-gray-500 mt-1">Overview of your wedding planning progress</p>
            </header>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {statCards.map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                        <div key={i} className="card relative overflow-hidden group">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                                    <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">{stat.value}</p>
                                </div>
                                <div className={`p-3 rounded-xl ${stat.color} transition-transform group-hover:scale-110`}>
                                    <Icon size={24} />
                                </div>
                            </div>
                            <div className="mt-4">
                                <span className="text-sm text-gray-500">{stat.subvalue}</span>
                            </div>
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-brand-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                    )
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                {/* Attendance Chart */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 font-display">Attendance Distribution</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={attendanceData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {attendanceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => [value, 'Guests']} />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Occupancy Chart */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 font-display">Overall Room Occupancy</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={occupancyData}
                                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                                layout="vertical"
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Legend verticalAlign="bottom" height={36} />
                                <Bar dataKey="Allocated" stackId="a" fill="#3b82f6" name="Beds Filled" radius={[4, 0, 0, 4]} />
                                <Bar dataKey="Available" stackId="a" fill="#cbd5e1" name="Beds Available" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Access Sharing Section */}
            <div className="mt-8 border-t border-gray-100 pt-8 pb-12">
                <header className="mb-6">
                    <h2 className="text-2xl font-bold font-display text-gray-900 flex items-center gap-2">
                        <Share2 className="text-brand-600" size={24} />
                        Wedding Access
                    </h2>
                    <p className="text-gray-500 mt-1">Share access with your partner or family members</p>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Share Your Wedding */}
                    <div className="card bg-gradient-to-br from-brand-50 to-white border-brand-100">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 font-display">Invite Others</h3>
                                <p className="text-sm text-gray-500 mt-1">Give this code to others so they can join and help manage your wedding.</p>
                            </div>
                            <div className="p-3 bg-white rounded-xl shadow-sm border border-brand-100 text-brand-600">
                                <Users size={20} />
                            </div>
                        </div>

                        {accessData?.primaryUser ? (
                            <div className="bg-white rounded-lg p-5 border border-brand-100 text-center">
                                <p className="text-sm text-gray-600 mb-2">You are currently viewing a shared wedding.</p>
                                <p className="font-semibold text-gray-900">Linked to: {accessData.primaryUser.mobile}</p>
                                <button
                                    onClick={handleDisconnect}
                                    className="mt-4 inline-flex items-center gap-2 text-red-600 font-medium hover:text-red-700 text-sm"
                                >
                                    <Unlink size={16} /> Disconnect
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="bg-white rounded-xl border border-brand-200 p-4 text-center">
                                    <p className="text-xs text-brand-600 font-bold uppercase tracking-wider mb-1">Your Share Code</p>
                                    <p className="text-4xl font-display font-medium tracking-widest text-gray-900">
                                        {accessData?.shareCode || '------'}
                                    </p>
                                </div>

                                {accessData?.sharedUsers && accessData.sharedUsers.length > 0 && (
                                    <div className="mt-4">
                                        <p className="text-sm font-medium text-gray-700 mb-2">Linked Accounts:</p>
                                        <div className="space-y-2">
                                            {accessData.sharedUsers.map((user, idx) => (
                                                <div key={idx} className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-100 text-sm text-gray-600">
                                                    <UserCheck size={14} className="text-green-500" />
                                                    {user.mobile}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Join a Wedding */}
                    <div className="card">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 font-display">Join a Wedding</h3>
                                <p className="text-sm text-gray-500 mt-1">Enter a 6-digit share code to help manage someone else's wedding.</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-gray-600">
                                <LinkIcon size={20} />
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <input
                                type="text"
                                placeholder="Enter 6-digit code..."
                                className="input-field uppercase font-medium placeholder:normal-case flex-1"
                                value={joinCode}
                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                maxLength={6}
                                disabled={isJoining || !!accessData?.primaryUser}
                            />
                            <button
                                onClick={handleJoin}
                                disabled={!joinCode || isJoining || !!accessData?.primaryUser}
                                className="btn-primary whitespace-nowrap"
                            >
                                {isJoining ? 'Joining...' : 'Join Wedding'}
                            </button>
                        </div>

                        {!!accessData?.primaryUser && (
                            <p className="text-xs text-orange-600 font-medium mt-3 bg-orange-50 p-2 rounded">
                                You must disconnect from your current shared wedding before joining a new one.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

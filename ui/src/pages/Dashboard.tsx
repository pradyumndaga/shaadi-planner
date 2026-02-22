import { useEffect, useState } from 'react';
import { Users, Bed, CreditCard, Banknote } from 'lucide-react';
import { API_BASE_URL, authFetch } from '../config';

interface DashboardStats {
    totalGuests: number;
    unassignedGuests: number;
    totalRooms: number;
    totalCapacity: number;
    remainingCapacity: number;
    totalSpent: number;
}

export default function Dashboard() {
    const [stats, setStats] = useState<DashboardStats>({
        totalGuests: 0,
        unassignedGuests: 0,
        totalRooms: 0,
        totalCapacity: 0,
        remainingCapacity: 0,
        totalSpent: 0
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        authFetch(`${API_BASE_URL}/api/stats`)
            .then(res => res.json())
            .then(data => {
                setStats(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching stats:', err);
                setLoading(false);
            });
    }, []);

    const statCards = [
        {
            title: 'Total Guests',
            value: stats.totalGuests,
            subvalue: `${stats.unassignedGuests} unassigned`,
            icon: Users,
            color: 'bg-blue-50 text-blue-600',
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

        </div>
    );
}

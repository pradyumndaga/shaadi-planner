import { useState, useEffect, useMemo } from 'react';
import { Plane, FileDown, Search } from 'lucide-react';
import { API_BASE_URL, authFetch } from '../config';
import { useAccess } from '../AccessContext';

interface GuestTravel {
    id: number;
    name: string;
    mobile: string;
    arrivalTime?: string;
    arrivalFlightNo?: string;
    arrivalPnr?: string;
    departureTime?: string;
    departureFlightNo?: string;
    departurePnr?: string;
}

type GroupedResult =
    | { type: 'all'; data: GuestTravel[] }
    | { type: 'arrivals'; groups: Record<string, GuestTravel[]> }
    | { type: 'departures'; groups: Record<string, GuestTravel[]> };

export default function Travel() {
    const { isReadOnly } = useAccess();
    const [guests, setGuests] = useState<GuestTravel[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMode, setFilterMode] = useState<'all' | 'arrivals' | 'departures'>('all');

    useEffect(() => {
        authFetch(`${API_BASE_URL}/api/guests`)
            .then(res => res.json())
            .then(data => {
                setGuests(data.filter((g: GuestTravel) => g.arrivalTime || g.departureTime || g.arrivalFlightNo || g.departureFlightNo));
                setLoading(false);
            });
    }, []);

    const groupedData = useMemo((): GroupedResult => {
        const filtered = guests.filter(g =>
            g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (g.arrivalFlightNo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (g.departureFlightNo || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (filterMode === 'arrivals') {
            const groups: Record<string, GuestTravel[]> = {};
            filtered.filter(g => g.arrivalFlightNo).forEach(g => {
                const key = g.arrivalFlightNo || 'Other';
                if (!groups[key]) groups[key] = [];
                groups[key].push(g);
            });
            return { type: 'arrivals', groups };
        } else if (filterMode === 'departures') {
            const groups: Record<string, GuestTravel[]> = {};
            filtered.filter(g => g.departureFlightNo).forEach(g => {
                const key = g.departureFlightNo || 'Other';
                if (!groups[key]) groups[key] = [];
                groups[key].push(g);
            });
            return { type: 'departures', groups };
        }

        return { type: 'all', data: filtered };
    }, [guests, searchTerm, filterMode]);

    if (loading) return <div className="text-center mt-10">Loading Travel Plans...</div>;

    return (
        <div className="animate-fade-in">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-display text-gray-900">Travel Itinerary</h1>
                    <p className="text-gray-500 mt-1">Group guests by transport for easy pickup coordination</p>
                </div>
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    <button
                        onClick={() => window.open(`${API_BASE_URL}/api/guests/export/travel?mode=${filterMode}&token=${localStorage.getItem('token')}`, '_blank')}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <FileDown size={18} />
                        Excel Report
                    </button>
                    <button
                        onClick={() => window.open(`${API_BASE_URL}/api/guests/export/travel/pdf?mode=${filterMode}&token=${localStorage.getItem('token')}`, '_blank')}
                        className="btn-primary flex items-center gap-2"
                    >
                        <FileDown size={18} />
                        PDF Report
                    </button>
                </div>
            </header>

            {isReadOnly && (
                <div className="mb-4 flex items-center gap-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3">
                    <Plane size={18} className="shrink-0" />
                    <p className="text-sm font-medium">You have <strong>View Only</strong> access. Travel data is read-only.</p>
                </div>
            )}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search guest or flight/train number..."
                        className="input-field pl-10"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex flex-wrap justify-center gap-2 bg-white p-1 rounded-lg border border-gray-200">
                    <button
                        onClick={() => setFilterMode('all')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filterMode === 'all' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        Show All
                    </button>
                    <button
                        onClick={() => setFilterMode('arrivals')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filterMode === 'arrivals' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        Arrival Groups
                    </button>
                    <button
                        onClick={() => setFilterMode('departures')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${filterMode === 'departures' ? 'bg-brand-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        Departure Groups
                    </button>
                </div>
            </div>

            {groupedData.type === 'all' ? (
                <div className="card">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Guest</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Arrival Info</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Departure Info</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {groupedData.data.map(guest => (
                                    <tr key={guest.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-gray-900">{guest.name}</div>
                                            <div className="text-xs text-gray-500">{guest.mobile}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{guest.arrivalFlightNo || '-'}</div>
                                            <div className="text-xs text-gray-500">{guest.arrivalTime ? new Date(guest.arrivalTime).toLocaleString() : ''}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{guest.departureFlightNo || '-'}</div>
                                            <div className="text-xs text-gray-500">{guest.departureTime ? new Date(guest.departureTime).toLocaleString() : ''}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {(() => {
                                                const hasArr = !!(guest.arrivalFlightNo || guest.arrivalTime);
                                                const hasDep = !!(guest.departureFlightNo || guest.departureTime);
                                                if (hasArr && hasDep) {
                                                    return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-green-100 text-green-700">Confirmed</span>;
                                                } else if (hasArr || hasDep) {
                                                    return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-yellow-100 text-yellow-700">Partially Confirmed</span>;
                                                } else {
                                                    return <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full bg-gray-100 text-gray-500">No Details</span>;
                                                }
                                            })()}
                                        </td>
                                    </tr>
                                ))}
                                {groupedData.data.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">No data to display</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.keys(groupedData.groups).map(flightKey => (
                        <div key={flightKey} className="card border-l-4 border-l-brand-600">
                            <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-100">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-brand-50 rounded-lg text-brand-600">
                                        <Plane size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                            Flight/Train: {flightKey}
                                            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                                {groupedData.groups[flightKey].length} Guests
                                            </span>
                                        </h3>
                                        <p className="text-xs text-gray-500">
                                            PNR: {groupedData.groups[flightKey][0][groupedData.type === 'arrivals' ? 'arrivalPnr' : 'departurePnr'] || 'N/A'} •
                                            Time: {groupedData.groups[flightKey][0][groupedData.type === 'arrivals' ? 'arrivalTime' : 'departureTime'] ? new Date(groupedData.groups[flightKey][0][groupedData.type === 'arrivals' ? 'arrivalTime' : 'departureTime']!).toLocaleString() : 'N/A'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-semibold text-brand-700 uppercase tracking-wider">{groupedData.type}</div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {groupedData.groups[flightKey].map(guest => (
                                    <div key={guest.id} className="bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                                        <div className="text-sm font-medium text-gray-900">{guest.name}</div>
                                        <div className="text-[10px] text-gray-500">
                                            {guest.mobile} • PNR: {groupedData.type === 'arrivals' ? (guest.arrivalPnr || '-') : (guest.departurePnr || '-')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {Object.keys(groupedData.groups).length === 0 && (
                        <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            <p className="text-gray-400">No data to display</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

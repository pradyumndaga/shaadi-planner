import { useState, useEffect, useRef } from 'react';
import { UploadCloud, Plus, Search, Trash2, Edit, X, FileDown, UserCheck, UserMinus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL, authFetch, downloadWithToken } from '../config';
import { useAccess } from '../AccessContext';

interface Guest {
    id: number;
    name: string;
    mobile: string;
    gender: string;
    arrivalTime?: string;
    arrivalFlightNo?: string;
    arrivalPnr?: string;
    departureTime?: string;
    departureFlightNo?: string;
    departurePnr?: string;
    isNotified: boolean;
    isTentative: boolean;
    roomId?: number | null;
    room?: {
        name: string;
    } | null;
}

export default function Guests() {
    const { isReadOnly } = useAccess();
    const [guests, setGuests] = useState<Guest[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [attendanceFilter, setAttendanceFilter] = useState('All'); // 'All', 'Tentative', 'Confirmed'
    const [roomFilter, setRoomFilter] = useState('All'); // 'All', or room name
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchGuests = () => {
        setLoading(true);
        authFetch(`${API_BASE_URL}/api/guests`)
            .then(res => res.json())
            .then(data => {
                setGuests(data);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchGuests();
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        authFetch(`${API_BASE_URL}/api/guests/upload`, {
            method: 'POST',
            body: formData,
        })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    toast.error(data.error);
                } else {
                    toast.success(data.message || 'File uploaded successfully!');
                }
                fetchGuests();
            })
            .catch(err => {
                console.error(err);
                toast.error('Failed to upload file');
            });
    };

    const deleteGuest = (id: number) => {
        if (!window.confirm('Are you sure?')) return;
        authFetch(`${API_BASE_URL}/api/guests/${id}`, { method: 'DELETE' })
            .then(res => {
                if (res.ok) {
                    toast.success('Guest deleted');
                    fetchGuests();
                } else {
                    toast.error('Failed to delete guest');
                }
            })
            .catch(() => toast.error('Failed to delete guest'));
    };

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} selected guests?`)) return;

        authFetch(`${API_BASE_URL}/api/guests/bulk-delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: Array.from(selectedIds) })
        })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    toast.error(data.error);
                } else {
                    toast.success(data.message || 'Guests deleted');
                    setSelectedIds(new Set());
                    fetchGuests();
                }
            })
            .catch(err => {
                console.error(err);
                toast.error('Failed to delete guests');
            });
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredGuests.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredGuests.map(g => g.id)));
        }
    };

    const toggleSelectRow = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
    const [linkedArrivals, setLinkedArrivals] = useState<number[]>([]);
    const [linkedDepartures, setLinkedDepartures] = useState<number[]>([]);
    const [arrivalSearch, setArrivalSearch] = useState('');
    const [departureSearch, setDepartureSearch] = useState('');
    const [showArrivalOptions, setShowArrivalOptions] = useState(false);
    const [showDepartureOptions, setShowDepartureOptions] = useState(false);
    const [formData, setFormData] = useState<{
        name: string;
        mobile: string;
        gender: string;
        arrivalTime: string;
        arrivalFlightNo: string;
        arrivalPnr: string;
        departureTime: string;
        departureFlightNo: string;
        departurePnr: string;
        isTentative: boolean;
    }>({
        name: '',
        mobile: '',
        gender: 'Other',
        arrivalTime: '',
        arrivalFlightNo: '',
        arrivalPnr: '',
        departureTime: '',
        departureFlightNo: '',
        departurePnr: '',
        isTentative: false
    });

    const openCreateModal = () => {
        setEditingGuest(null);
        setLinkedArrivals([]);
        setLinkedDepartures([]);
        setArrivalSearch('');
        setDepartureSearch('');
        setFormData({
            name: '',
            mobile: '',
            gender: 'Other',
            arrivalTime: '',
            arrivalFlightNo: '',
            arrivalPnr: '',
            departureTime: '',
            departureFlightNo: '',
            departurePnr: '',
            isTentative: false
        });
        setIsModalOpen(true);
    };

    const formatLocalDateForInput = (dateString?: string) => {
        if (!dateString) return '';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return '';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const openEditModal = (guest: Guest) => {
        setEditingGuest(guest);

        // Infer linkages by checking if other guests share the same exact travel details
        const hasArrival = guest.arrivalTime || guest.arrivalFlightNo || guest.arrivalPnr;
        const linkedArrivalsFound = hasArrival ? guests.filter(g =>
            g.id !== guest.id &&
            !g.isTentative &&
            (g.arrivalTime === guest.arrivalTime) &&
            ((g.arrivalFlightNo || '') === (guest.arrivalFlightNo || '')) &&
            ((g.arrivalPnr || '') === (guest.arrivalPnr || ''))
        ).map(g => g.id) : [];

        const hasDeparture = guest.departureTime || guest.departureFlightNo || guest.departurePnr;
        const linkedDeparturesFound = hasDeparture ? guests.filter(g =>
            g.id !== guest.id &&
            !g.isTentative &&
            (g.departureTime === guest.departureTime) &&
            ((g.departureFlightNo || '') === (guest.departureFlightNo || '')) &&
            ((g.departurePnr || '') === (guest.departurePnr || ''))
        ).map(g => g.id) : [];

        setLinkedArrivals(linkedArrivalsFound);
        setLinkedDepartures(linkedDeparturesFound);
        setArrivalSearch('');
        setDepartureSearch('');
        setFormData({
            name: guest.name,
            mobile: guest.mobile,
            gender: guest.gender,
            arrivalTime: formatLocalDateForInput(guest.arrivalTime),
            arrivalFlightNo: guest.arrivalFlightNo || '',
            arrivalPnr: guest.arrivalPnr || '',
            departureTime: formatLocalDateForInput(guest.departureTime),
            departureFlightNo: guest.departureFlightNo || '',
            departurePnr: guest.departurePnr || '',
            isTentative: guest.isTentative || false
        });
        setIsModalOpen(true);
    };

    const saveGuest = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            ...formData,
            linkedArrivalGuestIds: linkedArrivals,
            linkedDepartureGuestIds: linkedDepartures
        };
        try {
            if (editingGuest) {
                await authFetch(`${API_BASE_URL}/api/guests/${editingGuest.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            } else {
                await authFetch(`${API_BASE_URL}/api/guests`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
            }
            setIsModalOpen(false);
            toast.success(editingGuest ? 'Guest updated' : 'Guest added');
            fetchGuests();
        } catch (err) {
            console.error(err);
            toast.error('Failed to save guest');
        }
    };

    const toggleTentativeStatus = async (guest: Guest) => {
        // Optimistic UI update
        const previousGuests = [...guests];
        setGuests(guests.map(g => g.id === guest.id ? { ...g, isTentative: !g.isTentative } : g));

        try {
            await authFetch(`${API_BASE_URL}/api/guests/${guest.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isTentative: !guest.isTentative })
            });
            toast.success(`${guest.name} marked as ${!guest.isTentative ? 'Tentative' : 'Visiting'}`);
            // No need to fetchGuests(), we already updated locally
        } catch (err) {
            console.error(err);
            // Revert on failure
            setGuests(previousGuests);
            toast.error('Failed to update status');
        }
    };

    const uniqueRooms = Array.from(new Set(guests.map(g => g.room?.name).filter(Boolean))).sort() as string[];

    const filteredGuests = guests.filter(g => {
        const matchesSearch = g.name.toLowerCase().includes(searchTerm.toLowerCase()) || g.mobile.includes(searchTerm);

        let matchesAttendance = true;
        if (attendanceFilter === 'Visiting') matchesAttendance = !g.isTentative;
        else if (attendanceFilter === 'Tentative') matchesAttendance = g.isTentative;

        let matchesRoom = true;
        if (roomFilter === 'Unassigned') matchesRoom = !g.room;
        else if (roomFilter === 'Assigned') matchesRoom = !!g.room;
        else if (roomFilter !== 'All') matchesRoom = g.room?.name === roomFilter;

        return matchesSearch && matchesAttendance && matchesRoom;
    });

    // Calculate metrics
    const totalGuestsCount = guests.length;
    const tentativeGuestsCount = guests.filter(g => g.isTentative).length;
    const visitingGuestsCount = totalGuestsCount - tentativeGuestsCount;

    return (
        <div className="animate-fade-in">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold font-display text-gray-900">Guest List</h1>
                    <p className="text-gray-500 mt-1">Manage all your wedding guests</p>
                </div>

                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    {!isReadOnly && (
                        <>
                            <button
                                onClick={() => downloadWithToken('/api/guests/template')}
                                className="btn-secondary"
                            >
                                <FileDown size={18} className="mr-2" />
                                Download Template
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFileUpload}
                            />
                            <button
                                onClick={() => { if (fileInputRef.current) (fileInputRef.current as HTMLInputElement).click(); }}
                                className="btn-secondary whitespace-nowrap"
                            >
                                <UploadCloud size={18} className="mr-2" />
                                Upload Excel
                            </button>
                        </>
                    )}

                    <button
                        onClick={() => downloadWithToken(`/api/guests/export/all/pdf?attendance=${attendanceFilter}`)}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <FileDown size={18} />
                        PDF Export
                    </button>

                    {!isReadOnly && (
                        <button className="btn-primary flex-shrink-0" onClick={openCreateModal}>
                            <Plus size={18} className="mr-2" />
                            Add Guest
                        </button>
                    )}

                    {!isReadOnly && (
                        <button
                            className={`btn-secondary flex items-center gap-2 ${selectedIds.size === 0 ? 'opacity-50 cursor-not-allowed' : 'text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300'}`}
                            onClick={handleBulkDelete}
                            disabled={selectedIds.size === 0}
                        >
                            <Trash2 size={18} />
                            Delete {selectedIds.size > 0 ? `Selected (${selectedIds.size})` : 'Selected'}
                        </button>
                    )}
                </div>
            </header>

            {isReadOnly && (
                <div className="mb-6 flex items-center gap-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3">
                    <UserCheck size={18} className="shrink-0" />
                    <p className="text-sm font-medium">You have <strong>View Only</strong> access to this wedding. Contact the admin to request edit permissions.</p>
                </div>
            )}

            {/* Metrics Summary & Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div
                    onClick={() => setAttendanceFilter('All')}
                    className={`rounded-xl shadow-sm border p-4 flex items-center gap-4 cursor-pointer transition-all ${attendanceFilter === 'All' ? 'border-brand-500 ring-1 ring-brand-500 bg-brand-50' : 'bg-white border-brand-100 hover:border-brand-300 hover:shadow-md opacity-80 hover:opacity-100'}`}
                >
                    <div className={`p-3 rounded-lg ${attendanceFilter === 'All' ? 'bg-white text-brand-600 shadow-sm' : 'bg-brand-50 text-brand-600'}`}>
                        <Users size={20} />
                    </div>
                    <div>
                        <p className={`text-sm font-medium ${attendanceFilter === 'All' ? 'text-brand-800' : 'text-gray-500'}`}>Total Guests</p>
                        <p className={`text-2xl font-bold ${attendanceFilter === 'All' ? 'text-brand-900' : 'text-gray-900'}`}>{totalGuestsCount}</p>
                    </div>
                </div>
                <div
                    onClick={() => setAttendanceFilter('Visiting')}
                    className={`rounded-xl shadow-sm border p-4 flex items-center gap-4 cursor-pointer transition-all ${attendanceFilter === 'Visiting' ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50' : 'bg-white border-emerald-100 hover:border-emerald-300 hover:shadow-md opacity-80 hover:opacity-100'}`}
                >
                    <div className={`p-3 rounded-lg ${attendanceFilter === 'Visiting' ? 'bg-white text-emerald-600 shadow-sm' : 'bg-emerald-50 text-emerald-600'}`}>
                        <UserCheck size={20} />
                    </div>
                    <div>
                        <p className={`text-sm font-medium ${attendanceFilter === 'Visiting' ? 'text-emerald-800' : 'text-gray-500'}`}>Visiting</p>
                        <p className={`text-2xl font-bold ${attendanceFilter === 'Visiting' ? 'text-emerald-900' : 'text-gray-900'}`}>{visitingGuestsCount}</p>
                    </div>
                </div>
                <div
                    onClick={() => setAttendanceFilter('Tentative')}
                    className={`rounded-xl shadow-sm border p-4 flex items-center gap-4 cursor-pointer transition-all ${attendanceFilter === 'Tentative' ? 'border-orange-500 ring-1 ring-orange-500 bg-orange-50' : 'bg-white border-orange-100 hover:border-orange-300 hover:shadow-md opacity-80 hover:opacity-100'}`}
                >
                    <div className={`p-3 rounded-lg ${attendanceFilter === 'Tentative' ? 'bg-white text-orange-600 shadow-sm' : 'bg-orange-50 text-orange-600'}`}>
                        <UserMinus size={20} />
                    </div>
                    <div>
                        <p className={`text-sm font-medium ${attendanceFilter === 'Tentative' ? 'text-orange-800' : 'text-gray-500'}`}>Tentative</p>
                        <p className={`text-2xl font-bold ${attendanceFilter === 'Tentative' ? 'text-orange-900' : 'text-gray-900'}`}>{tentativeGuestsCount}</p>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="input-field pl-10"
                            placeholder="Search guests by name or mobile..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-4 sm:w-auto w-full">
                        <select
                            className="input-field shadow-sm bg-white min-w-[160px]"
                            value={roomFilter}
                            onChange={(e) => setRoomFilter(e.target.value)}
                        >
                            <option value="All">Room: All</option>
                            <option value="Assigned">Assigned (Any Room)</option>
                            <option value="Unassigned">Unassigned</option>
                            <optgroup label="Specific Rooms">
                                {uniqueRooms.map(room => (
                                    <option key={room} value={room}>{room}</option>
                                ))}
                            </optgroup>
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="text-center py-10 text-gray-500">Loading guests...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr>
                                    <th className="px-6 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                                            checked={filteredGuests.length > 0 && selectedIds.size === filteredGuests.length}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Mobile</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Gender</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Attendance</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Room Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredGuests.map(guest => (
                                    <tr
                                        key={guest.id}
                                        className={`transition-colors ${selectedIds.has(guest.id) ? 'bg-brand-50/50' : (guest.isTentative ? 'bg-orange-50/40 hover:bg-orange-50/70' : 'hover:bg-gray-50')}`}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                                                checked={selectedIds.has(guest.id)}
                                                onChange={() => toggleSelectRow(guest.id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{guest.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{guest.mobile}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${guest.gender === 'Male' ? 'badge-radiant-male' :
                                                guest.gender === 'Female' ? 'badge-radiant-female' :
                                                    'bg-gray-100 text-gray-800 border-gray-200 border'
                                                }`}>
                                                {guest.gender}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <button
                                                onClick={() => !isReadOnly && toggleTentativeStatus(guest)}
                                                disabled={isReadOnly}
                                                className={`px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 flex items-center gap-1 ${isReadOnly ? 'opacity-50 cursor-not-allowed ' : ''}${guest.isTentative
                                                    ? 'bg-orange-100 border border-orange-300 text-orange-700 hover:bg-orange-200 focus:ring-orange-500'
                                                    : 'bg-emerald-100 border border-emerald-300 text-emerald-700 hover:bg-emerald-200 focus:ring-emerald-500'
                                                    }`}
                                            >
                                                {guest.isTentative ? (
                                                    <><UserMinus size={14} /> Tentative</>
                                                ) : (
                                                    <><UserCheck size={14} /> Visiting</>
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {guest.room ? (
                                                <span className="text-brand-600 font-medium">{guest.room.name}</span>
                                            ) : (
                                                <span className="text-gray-400">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {!isReadOnly && (
                                                <>
                                                    <button onClick={() => openEditModal(guest)} className="text-indigo-600 hover:text-indigo-900 mr-3"><Edit size={16} /></button>
                                                    <button onClick={() => deleteGuest(guest.id)} className="text-red-600 hover:text-red-900"><Trash2 size={16} /></button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredGuests.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">No data to display</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Guest Modal */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-fade-in">
                            <div className="flex justify-between items-center p-6 border-b border-gray-100">
                                <h2 className="text-xl font-semibold text-gray-900">
                                    {editingGuest ? 'Edit Guest' : 'Add Guest'}
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={saveGuest} className="p-6">
                                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                                        <input
                                            type="text"
                                            required
                                            className="input-field"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile *</label>
                                            <input
                                                type="text"
                                                required
                                                className="input-field"
                                                value={formData.mobile}
                                                onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                                            <select
                                                className="input-field"
                                                value={formData.gender}
                                                onChange={e => setFormData({ ...formData, gender: e.target.value })}
                                            >
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex items-center mt-4">
                                        <input
                                            type="checkbox"
                                            id="isTentative"
                                            className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded"
                                            checked={formData.isTentative}
                                            onChange={e => setFormData({ ...formData, isTentative: e.target.checked })}
                                        />
                                        <label htmlFor="isTentative" className="ml-2 block text-sm text-gray-900">
                                            Mark as Tentative (Might not attend)
                                        </label>
                                    </div>

                                    <hr className="my-4 border-gray-100" />
                                    <h3 className="font-medium text-base text-gray-900 mb-2">Travel - Arrival</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Time</label>
                                            <input
                                                type="datetime-local"
                                                className="input-field"
                                                value={formData.arrivalTime}
                                                onChange={e => setFormData({ ...formData, arrivalTime: e.target.value })}
                                            />
                                            <p className="text-[11px] text-gray-500 mt-1.5 italic font-medium tracking-tight">Saved automatically — tap outside to close</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Arrival Flight/Train No.</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. 6E 2131"
                                                className="input-field"
                                                value={formData.arrivalFlightNo}
                                                onChange={e => setFormData({ ...formData, arrivalFlightNo: e.target.value })}
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Arrival PNR</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. V83ND0"
                                                className="input-field"
                                                value={formData.arrivalPnr}
                                                onChange={e => setFormData({ ...formData, arrivalPnr: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Apply Arrival details to other guests:</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search and select guests..."
                                                className="input-field mb-2"
                                                value={arrivalSearch}
                                                onChange={e => setArrivalSearch(e.target.value)}
                                                onFocus={() => setShowArrivalOptions(true)}
                                                onBlur={() => setTimeout(() => setShowArrivalOptions(false), 200)}
                                            />
                                            {showArrivalOptions && (
                                                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto top-[42px]">
                                                    {guests
                                                        .filter(g => !g.isTentative && g.id !== editingGuest?.id && !linkedArrivals.includes(g.id))
                                                        .filter(g => g.name.toLowerCase().includes(arrivalSearch.toLowerCase()))
                                                        .slice(0, 50)
                                                        .map(g => (
                                                            <div
                                                                key={g.id}
                                                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    setLinkedArrivals([...linkedArrivals, g.id]);
                                                                    setArrivalSearch('');
                                                                }}
                                                            >
                                                                {g.name}
                                                            </div>
                                                        ))}
                                                    {guests.filter(g => !g.isTentative && g.id !== editingGuest?.id && !linkedArrivals.includes(g.id)).filter(g => g.name.toLowerCase().includes(arrivalSearch.toLowerCase())).length === 0 && (
                                                        <div className="px-4 py-2 text-gray-500 text-sm">No guests found</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {linkedArrivals.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {linkedArrivals.map(id => {
                                                    const g = guests.find(guest => guest.id === id);
                                                    return (
                                                        <span key={id} className="inline-flex items-center px-2 py-1 rounded bg-brand-50 text-brand-700 text-xs font-medium">
                                                            {g?.name}
                                                            <button type="button" onClick={() => setLinkedArrivals(linkedArrivals.filter(l => l !== id))} className="ml-1 text-brand-500 hover:text-brand-800 focus:outline-none">
                                                                <X size={12} />
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    <hr className="my-4 border-gray-100" />
                                    <h3 className="font-medium text-base text-gray-900 mb-2">Travel - Departure</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Departure Time</label>
                                            <input
                                                type="datetime-local"
                                                className="input-field"
                                                value={formData.departureTime}
                                                onChange={e => setFormData({ ...formData, departureTime: e.target.value })}
                                            />
                                            <p className="text-[11px] text-gray-500 mt-1.5 italic font-medium tracking-tight">Saved automatically — tap outside to close</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Departure Flight/Train No.</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. 6E 2132"
                                                className="input-field"
                                                value={formData.departureFlightNo}
                                                onChange={e => setFormData({ ...formData, departureFlightNo: e.target.value })}
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Departure PNR</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. V83ND1"
                                                className="input-field"
                                                value={formData.departurePnr}
                                                onChange={e => setFormData({ ...formData, departurePnr: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Apply Departure details to other guests:</label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                placeholder="Search and select guests..."
                                                className="input-field mb-2"
                                                value={departureSearch}
                                                onChange={e => setDepartureSearch(e.target.value)}
                                                onFocus={() => setShowDepartureOptions(true)}
                                                onBlur={() => setTimeout(() => setShowDepartureOptions(false), 200)}
                                            />
                                            {showDepartureOptions && (
                                                <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto top-[42px]">
                                                    {guests
                                                        .filter(g => !g.isTentative && g.id !== editingGuest?.id && !linkedDepartures.includes(g.id))
                                                        .filter(g => g.name.toLowerCase().includes(departureSearch.toLowerCase()))
                                                        .slice(0, 50)
                                                        .map(g => (
                                                            <div
                                                                key={g.id}
                                                                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    setLinkedDepartures([...linkedDepartures, g.id]);
                                                                    setDepartureSearch('');
                                                                }}
                                                            >
                                                                {g.name}
                                                            </div>
                                                        ))}
                                                    {guests.filter(g => !g.isTentative && g.id !== editingGuest?.id && !linkedDepartures.includes(g.id)).filter(g => g.name.toLowerCase().includes(departureSearch.toLowerCase())).length === 0 && (
                                                        <div className="px-4 py-2 text-gray-500 text-sm">No guests found</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        {linkedDepartures.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                                {linkedDepartures.map(id => {
                                                    const g = guests.find(guest => guest.id === id);
                                                    return (
                                                        <span key={id} className="inline-flex items-center px-2 py-1 rounded bg-brand-50 text-brand-700 text-xs font-medium">
                                                            {g?.name}
                                                            <button type="button" onClick={() => setLinkedDepartures(linkedDepartures.filter(l => l !== id))} className="ml-1 text-brand-500 hover:text-brand-800 focus:outline-none">
                                                                <X size={12} />
                                                            </button>
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-8 flex justify-end gap-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary">
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn-primary">
                                        Save
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

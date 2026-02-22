import { useState, useEffect, useRef } from 'react';
import { UploadCloud, Plus, Search, Trash2, Edit, X, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL, authFetch } from '../config';

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
    roomId?: number | null;
    room?: {
        name: string;
    } | null;
}

export default function Guests() {
    const [guests, setGuests] = useState<Guest[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef(null);

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
    const [formData, setFormData] = useState({
        name: '',
        mobile: '',
        gender: 'Other',
        arrivalTime: '',
        arrivalFlightNo: '',
        arrivalPnr: '',
        departureTime: '',
        departureFlightNo: '',
        departurePnr: ''
    });

    const openCreateModal = () => {
        setEditingGuest(null);
        setFormData({
            name: '',
            mobile: '',
            gender: 'Other',
            arrivalTime: '',
            arrivalFlightNo: '',
            arrivalPnr: '',
            departureTime: '',
            departureFlightNo: '',
            departurePnr: ''
        });
        setIsModalOpen(true);
    };

    const openEditModal = (guest: Guest) => {
        setEditingGuest(guest);
        setFormData({
            name: guest.name,
            mobile: guest.mobile,
            gender: guest.gender,
            arrivalTime: guest.arrivalTime ? new Date(guest.arrivalTime).toISOString().slice(0, 16) : '',
            arrivalFlightNo: guest.arrivalFlightNo || '',
            arrivalPnr: guest.arrivalPnr || '',
            departureTime: guest.departureTime ? new Date(guest.departureTime).toISOString().slice(0, 16) : '',
            departureFlightNo: guest.departureFlightNo || '',
            departurePnr: guest.departurePnr || ''
        });
        setIsModalOpen(true);
    };

    const saveGuest = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingGuest) {
                await authFetch(`${API_BASE_URL}/api/guests/${editingGuest.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
            } else {
                await authFetch(`${API_BASE_URL}/api/guests`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
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

    const filteredGuests = guests.filter(g => g.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="animate-fade-in">
            <header className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold font-display text-gray-900">Guest List</h1>
                    <p className="text-gray-500 mt-1">Manage all your wedding guests</p>
                </div>

                <div className="flex gap-4">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileUpload}
                    />
                    <button
                        onClick={() => { if (fileInputRef.current) (fileInputRef.current as HTMLInputElement).click(); }}
                        className="btn-secondary"
                    >
                        <UploadCloud size={18} className="mr-2" />
                        Upload Excel
                    </button>

                    <button
                        onClick={() => window.open(`${API_BASE_URL}/api/guests/export/all/pdf?token=${localStorage.getItem('token')}`, '_blank')}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <FileDown size={18} />
                        PDF Export
                    </button>

                    <button className="btn-primary" onClick={openCreateModal}>
                        <Plus size={18} className="mr-2" />
                        Add Guest
                    </button>

                    <button
                        className={`btn-secondary flex items-center gap-2 ${selectedIds.size === 0 ? 'opacity-50 cursor-not-allowed' : 'text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300'}`}
                        onClick={handleBulkDelete}
                        disabled={selectedIds.size === 0}
                    >
                        <Trash2 size={18} />
                        Delete {selectedIds.size > 0 ? `Selected (${selectedIds.size})` : 'Selected'}
                    </button>
                </div>
            </header>

            <div className="card">
                <div className="mb-6 relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="input-field pl-10"
                        placeholder="Search guests..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 tracking-wider">Room Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredGuests.map(guest => (
                                    <tr key={guest.id} className={`hover:bg-gray-50 transition-colors ${selectedIds.has(guest.id) ? 'bg-brand-50/30' : ''}`}>
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
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {guest.room ? (
                                                <span className="text-brand-600 font-medium">{guest.room.name}</span>
                                            ) : (
                                                <span className="text-gray-400">Unassigned</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => openEditModal(guest)} className="text-indigo-600 hover:text-indigo-900 mr-3"><Edit size={16} /></button>
                                            <button onClick={() => deleteGuest(guest.id)} className="text-red-600 hover:text-red-900"><Trash2 size={16} /></button>
                                        </td>
                                    </tr>
                                ))}
                                {filteredGuests.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">No data to display</td>
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
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-fade-in">
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

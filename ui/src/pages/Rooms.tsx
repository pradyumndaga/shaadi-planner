import { useState, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragOverlay
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { Bed, Users, X, FileDown, FileText, Search, Edit } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL, authFetch, downloadWithToken } from '../config';
import { useAccess } from '../AccessContext';

interface Guest {
    id: number;
    name: string;
    mobile: string;
    gender: string;
    roomId?: number;
    isTentative: boolean;
}

interface RoomType {
    id: number;
    name: string;
    capacity: number;
    hasExtraBed: boolean;
    guests: Guest[];
}

// Draggable Guest Item
function SortableGuest({ id, guest, onRemove, onMove, availableRooms, disabled, compact }: {
    id: string,
    guest: Guest,
    onRemove?: (guestId: number) => void,
    onMove?: (guestId: number, roomId: number | null) => void,
    availableRooms?: { id: number, name: string }[],
    disabled?: boolean,
    compact?: boolean
}) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id, disabled });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const genderClasses: Record<string, string> = {
        'Female': 'badge-radiant-female',
        'Male': 'badge-radiant-male',
        'Other': 'bg-white border-gray-200'
    };
    const currentGenderClass = genderClasses[guest.gender] || genderClasses.Other;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`group relative mb-2 ${compact ? 'p-3' : 'p-4'} rounded-lg border shadow-sm transition-shadow bg-white ${disabled ? 'cursor-default' : 'cursor-grab active:cursor-grabbing hover:border-brand-400 hover:shadow-md'} ${currentGenderClass} touch-none`}
        >
            <div className={`w-full ${compact ? 'pr-2' : 'pr-5'}`}>
                <p className={`font-medium ${compact ? 'text-xs' : 'text-sm'} text-gray-900 leading-tight break-words max-w-full`}>{guest.name}</p>
                <div className="flex flex-col gap-2 mt-1.5 w-full">
                    <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-gray-500`}>{guest.mobile}</p>

                    {/* Mobile/Fallback Dropdown for moving guests */}
                    {!disabled && onMove && availableRooms && (
                        <div className="md:hidden w-full relative z-10" onPointerDown={(e) => e.stopPropagation()}>
                            <select
                                className="w-full text-xs py-1.5 px-2 pr-6 border border-brand-200 rounded cursor-pointer bg-brand-50 text-brand-700 focus:outline-none focus:ring-1 focus:ring-brand-500 shadow-sm"
                                value={guest.roomId || 'unassigned'}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    onMove(guest.id, val === 'unassigned' ? null : parseInt(val));
                                }}
                            >
                                <option value="unassigned">Unassigned</option>
                                {availableRooms.map(r => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>
            {onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent drag start when clicking remove
                        onRemove(guest.id);
                    }}
                    onPointerDown={(e) => e.stopPropagation()} // Prevent dnd-kit from catching the pointer down event on the button
                    className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    title="Remove from room"
                >
                    <X size={16} />
                </button>
            )}
        </div>
    );
}

// Droppable Room Container
function Room({ room, guests, onRemoveGuest, onMoveGuest, availableRooms, onToggleExtraBed, isEditing, onDeleteRoom }: {
    room: RoomType,
    guests: Guest[],
    onRemoveGuest: (guestId: number) => void,
    onMoveGuest: (guestId: number, roomId: number | null) => void,
    availableRooms: { id: number, name: string }[],
    onToggleExtraBed: (roomId: number, current: boolean) => void,
    isEditing: boolean,
    onDeleteRoom: (roomId: number) => void
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `room-${room.id}`,
        data: { isRoom: true, roomId: room.id }
    });

    const effectiveCapacity = room.capacity + (room.hasExtraBed ? 1 : 0);
    const isFull = guests.length >= effectiveCapacity;

    return (
        <div
            ref={setNodeRef}
            className={`bg-gray-50 rounded-xl p-4 border-2 transition-colors min-h-[220px] flex flex-col relative ${isOver && !isFull ? 'border-brand-400 bg-brand-50' : 'border-dashed border-gray-300'}`}
        >
            {isEditing && (
                <button
                    onClick={() => onDeleteRoom(room.id)}
                    className="absolute -top-2 -right-2 p-1.5 bg-red-100 text-red-600 hover:bg-red-200 rounded-full shadow-sm border border-red-200 z-10 transition-transform hover:scale-110"
                    title="Delete Room"
                >
                    <X size={14} />
                </button>
            )}
            <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Bed size={18} className="text-brand-600" />
                        {room.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <button
                            onClick={() => onToggleExtraBed(room.id, room.hasExtraBed)}
                            disabled={!isEditing}
                            className={`text-[10px] px-2 py-0.5 rounded-full transition-colors border ${!isEditing ? 'opacity-50 cursor-not-allowed ' : ''}${room.hasExtraBed ? 'bg-orange-100 text-orange-700 border-orange-200 shadow-sm' : 'bg-gray-100 text-gray-500 border-gray-200 opacity-60 hover:opacity-100'}`}
                        >
                            {room.hasExtraBed ? 'Extra Bed On (+1)' : 'Add Extra Bed?'}
                        </button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${isFull ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {guests.length} / {effectiveCapacity}
                    </span>
                </div>
            </div>

            <div className="flex-1">
                <SortableContext items={guests.map(g => `guest-${g.id}`)} strategy={verticalListSortingStrategy}>
                    {guests.map(g => (
                        <SortableGuest
                            key={g.id}
                            id={`guest-${g.id}`}
                            guest={g}
                            onRemove={isEditing ? onRemoveGuest : undefined}
                            onMove={onMoveGuest}
                            availableRooms={availableRooms}
                            disabled={!isEditing}
                        />
                    ))}
                </SortableContext>
                {guests.length === 0 && isEditing && (
                    <div className="h-full flex items-center justify-center text-sm text-gray-400 italic">
                        Drop guests here
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Rooms() {
    const [rooms, setRooms] = useState<RoomType[]>([]);
    const [unassignedGuests, setUnassignedGuests] = useState<Guest[]>([]);
    const [isEditing, setIsEditing] = useState(false);
    const [tempRooms, setTempRooms] = useState<RoomType[]>([]);
    const [tempUnassigned, setTempUnassigned] = useState<Guest[]>([]);
    const [deletedRoomIds, setDeletedRoomIds] = useState<Set<number>>(new Set());
    const { isReadOnly } = useAccess();
    const [loading, setLoading] = useState(true);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [queueSearch, setQueueSearch] = useState('');

    const fetchData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [roomsRes, guestsRes] = await Promise.all([
                authFetch(`${API_BASE_URL}/api/rooms`).then(r => r.json()),
                authFetch(`${API_BASE_URL}/api/guests`).then(r => r.json())
            ]);

            setRooms(roomsRes);
            // Hide tentative guests from the room assignment list completely
            setUnassignedGuests(guestsRes.filter((g: Guest) => !g.roomId && !g.isTentative));
        } catch (err) {
            console.error(err);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    const handleAddRooms = async () => {
        const input = window.prompt('How many rooms would you like to add?');
        if (!input) return;
        const count = parseInt(input);
        if (isNaN(count) || count <= 0) return alert('Invalid number of rooms');

        const capacityInput = window.prompt('What is the default capacity for these rooms?', '2');
        const capacity = parseInt(capacityInput || '2');

        const seriesStartInput = window.prompt('Optional: What number should the room series start at? (e.g., 101 or A101)\nLeave blank to auto-continue existing numbers.');
        const seriesStart = seriesStartInput ? seriesStartInput.trim() : null;

        try {
            const res = await authFetch(`${API_BASE_URL}/api/rooms/bulk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ count, capacity, prefix: 'Room', seriesStart })
            });
            if (res.ok) {
                toast.success(`Added ${count} rooms`);
                await fetchData(true);
            } else {
                toast.error('Failed to add rooms');
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to add rooms');
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const startEditing = () => {
        setTempRooms(JSON.parse(JSON.stringify(rooms)));
        setTempUnassigned(JSON.parse(JSON.stringify(unassignedGuests)));
        setIsEditing(true);
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setTempRooms([]);
        setTempUnassigned([]);
        setDeletedRoomIds(new Set());
    };

    const saveChanges = async () => {
        setLoading(true);
        try {
            // 1. Perform room deletions
            if (deletedRoomIds.size > 0) {
                await Promise.all(Array.from(deletedRoomIds).map(id =>
                    authFetch(`${API_BASE_URL}/api/rooms/${id}`, { method: 'DELETE' })
                ));
            }

            // 2. Perform guest allocations
            const allocations: { guestId: number, roomId: number | null }[] = [];

            // Compare temp state with original state to find changes
            // For simplicity, we can just send all guests that are currently in tempRooms or tempUnassigned
            // but to be more efficient, we only send those that moved.

            const originalMap = new Map();
            rooms.forEach(r => r.guests.forEach(g => originalMap.set(g.id, r.id)));
            unassignedGuests.forEach(g => originalMap.set(g.id, null));

            tempRooms.forEach(r => {
                r.guests.forEach(g => {
                    if (originalMap.get(g.id) !== r.id) {
                        allocations.push({ guestId: g.id, roomId: r.id });
                    }
                });
            });

            tempUnassigned.forEach(g => {
                if (originalMap.get(g.id) !== null) {
                    allocations.push({ guestId: g.id, roomId: null });
                }
            });

            if (allocations.length > 0) {
                await authFetch(`${API_BASE_URL}/api/rooms/batch-allocate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ allocations })
                });
            }

            await fetchData(true);
            setIsEditing(false);
            setDeletedRoomIds(new Set());
            toast.success('Changes saved successfully');
        } catch (err) {
            console.error(err);
            toast.error('Failed to save changes');
        } finally {
            setLoading(false);
        }
    };

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 5,
            }
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            }
        }),
        useSensor(KeyboardSensor)
    );

    const handleDragStart = (event: any) => {
        setActiveId(event.active.id);
    };

    const handleDragEnd = async (event: any) => {
        setActiveId(null);
        const { active, over } = event;

        if (!over) return;

        const guestId = parseInt(active.id.replace('guest-', ''));
        let targetRoomId: number | null = null;

        if (over.id === 'unassigned') {
            targetRoomId = null;
        } else if (String(over.id).startsWith('room-')) {
            targetRoomId = parseInt(over.id.replace('room-', ''));
        } else if (String(over.id).startsWith('guest-')) {
            const droppedOnGuestId = parseInt(over.id.replace('guest-', ''));

            const currentRooms = isEditing ? tempRooms : rooms;
            const currentUnassigned = isEditing ? tempUnassigned : unassignedGuests;

            const unassignedGuest = currentUnassigned.find(g => g.id === droppedOnGuestId);
            if (unassignedGuest) {
                targetRoomId = null;
            } else {
                const roomWithGuest = currentRooms.find(r => r.guests.some(g => g.id === droppedOnGuestId));
                if (roomWithGuest) {
                    targetRoomId = roomWithGuest.id;
                } else {
                    return;
                }
            }
        } else {
            return;
        }

        if (isEditing) {
            // Local update only
            setTempRooms(prev => {
                const next = JSON.parse(JSON.stringify(prev)) as RoomType[];
                // Remove guest from rooms if it was there
                next.forEach(r => {
                    r.guests = r.guests.filter(g => g.id !== guestId);
                });
                // Add to room if target is a room
                if (targetRoomId !== null) {
                    const target = next.find(r => r.id === targetRoomId);
                    if (target) {
                        // Check capacity locally?
                        const effectiveCap = target.capacity + (target.hasExtraBed ? 1 : 0);
                        if (target.guests.length >= effectiveCap) {
                            alert('Room is full');
                            return prev;
                        }
                        const guestObj = [...tempUnassigned, ...tempRooms.flatMap(r => r.guests)].find(g => g.id === guestId);
                        if (guestObj) target.guests.push({ ...guestObj, roomId: targetRoomId });
                    }
                }
                return next;
            });

            setTempUnassigned(prev => {
                let next = [...prev];
                // Remove if it was here
                next = next.filter(g => g.id !== guestId);
                // Add if target is unassigned
                if (targetRoomId === null) {
                    const guestObj = [...tempUnassigned, ...tempRooms.flatMap(r => r.guests)].find(g => g.id === guestId);
                    if (guestObj) next.push({ ...guestObj, roomId: undefined });
                }
                return next;
            });
        } else {
            // Traditional direct API call
            try {
                const res = await authFetch(`${API_BASE_URL}/api/rooms/allocate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ guestId, roomId: targetRoomId })
                });

                if (!res.ok) {
                    const error = await res.json();
                    toast.error(error.error || 'Allocation failed');
                    return;
                }
                toast.success('Guest allocated');
                await fetchData(true);
            } catch (err) {
                console.error(err);
                toast.error('Failed to allocate guest');
            }
        }
    };

    const { setNodeRef: setUnassignedRef, isOver: isUnassignedOver } = useDroppable({
        id: 'unassigned',
    });

    const activeGuest = activeId
        ? [...unassignedGuests, ...rooms.flatMap(r => r.guests)].find(g => `guest-${g.id}` === activeId)
        : null;

    if (loading) return <div className="text-center mt-10">Loading Rooms...</div>;

    return (
        <div className="animate-fade-in flex flex-col h-full">
            <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-display text-gray-900">Rooms & Allotment</h1>
                    <p className="text-gray-500 mt-1">Drag and drop guests to allocate rooms</p>
                </div>
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    {!isReadOnly && (!isEditing ? (
                        <button onClick={startEditing} className="btn-secondary flex items-center gap-2 border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100">
                            <Edit size={18} />
                            Edit Layout
                        </button>
                    ) : (
                        <>
                            <button onClick={saveChanges} className="btn-primary flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 border-emerald-700">
                                Save Changes
                            </button>
                            <button onClick={cancelEditing} className="btn-secondary flex items-center gap-2">
                                Cancel
                            </button>
                        </>
                    ))}
                    <button
                        onClick={() => downloadWithToken('/api/rooms/export/excel')}
                        className="btn-secondary flex items-center gap-2"
                        disabled={isEditing}
                    >
                        <FileDown size={18} />
                        Export Excel
                    </button>
                    <button
                        onClick={() => downloadWithToken('/api/rooms/export/pdf')}
                        className="btn-secondary flex items-center gap-2"
                        disabled={isEditing}
                    >
                        <FileText size={18} />
                        Export PDF
                    </button>
                </div>
            </header>

            {isReadOnly && (
                <div className="mb-6 flex items-center gap-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3">
                    <Users size={18} className="shrink-0" />
                    <p className="text-sm font-medium">You have <strong>View Only</strong> access to this wedding. You can view room assignments but cannot make changes.</p>
                </div>
            )}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 h-[calc(100vh-200px)]">
                    {/* Unassigned Guests Sidebar */}
                    <div className="card lg:col-span-1 flex flex-col h-full overflow-hidden">
                        <header className="mb-4">
                            <h2 className="font-semibold text-lg mb-2 flex items-center gap-2">
                                <Users size={20} className="text-gray-400" />
                                Unassigned Queue
                                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full ml-auto">{unassignedGuests.length}</span>
                            </h2>
                            <div className="relative group/search">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/search:text-brand-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search queue..."
                                    className="w-full bg-gray-50 border-gray-200 rounded-lg pl-9 pr-3 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-brand-500 transition-all outline-none border"
                                    value={queueSearch}
                                    onChange={e => setQueueSearch(e.target.value)}
                                />
                            </div>
                        </header>

                        <div
                            ref={setUnassignedRef}
                            className={`flex-1 overflow-y-auto pr-2 custom-scrollbar transition-colors ${isUnassignedOver ? 'bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg' : ''} ${isEditing ? 'ring-2 ring-brand-200 ring-inset rounded-lg p-2' : ''}`}
                        >
                            <div className="space-y-2 pb-4">
                                <SortableContext items={(isEditing ? tempUnassigned : unassignedGuests).map(g => `guest-${g.id}`)} strategy={verticalListSortingStrategy}>
                                    {(isEditing ? tempUnassigned : unassignedGuests)
                                        .filter(g => g.name.toLowerCase().includes(queueSearch.toLowerCase()))
                                        .map(g => (
                                            <SortableGuest
                                                key={g.id}
                                                id={`guest-${g.id}`}
                                                guest={g}
                                                onMove={async (guestId: number, roomId: number | null) => {
                                                    // Mobile Move Handler for Unassigned -> Room
                                                    const fakeEvent = {
                                                        active: { id: `guest-${guestId}` },
                                                        over: { id: roomId ? `room-${roomId}` : 'unassigned' }
                                                    };
                                                    await handleDragEnd(fakeEvent);
                                                }}
                                                availableRooms={isEditing ? tempRooms.map(r => ({ id: r.id, name: r.name })) : rooms.map(r => ({ id: r.id, name: r.name }))}
                                                disabled={!isEditing}
                                                compact
                                            />
                                        ))}
                                </SortableContext>
                            </div>
                            {unassignedGuests.filter(g => g.name.toLowerCase().includes(queueSearch.toLowerCase())).length === 0 && (
                                <div className="text-center text-sm text-gray-400 mt-10 italic">
                                    No data to display
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Rooms Grid */}
                    <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto content-start p-4">
                        {(isEditing ? tempRooms : rooms).map(room => (
                            <Room
                                key={room.id}
                                room={room}
                                guests={room.guests}
                                isEditing={isEditing}
                                onDeleteRoom={(id) => {
                                    setTempRooms(prev => prev.filter(r => r.id !== id));
                                    const roomToDelete = tempRooms.find(r => r.id === id);
                                    if (roomToDelete) {
                                        setTempUnassigned(prev => [...prev, ...roomToDelete.guests.map(g => ({ ...g, roomId: undefined }))]);
                                    }
                                    setDeletedRoomIds(prev => new Set(prev).add(id));
                                }}
                                onMoveGuest={async (guestId: number, roomId: number | null) => {
                                    // Mobile Move Handler for Room -> Room/Unassigned
                                    const fakeEvent = {
                                        active: { id: `guest-${guestId}` },
                                        over: { id: roomId ? `room-${roomId}` : 'unassigned' }
                                    };
                                    await handleDragEnd(fakeEvent);
                                }}
                                availableRooms={isEditing ? tempRooms.map(r => ({ id: r.id, name: r.name })) : rooms.map(r => ({ id: r.id, name: r.name }))}
                                onToggleExtraBed={async (id, current) => {
                                    if (isEditing) {
                                        setTempRooms(prev => {
                                            const next = JSON.parse(JSON.stringify(prev)) as RoomType[];
                                            const target = next.find(r => r.id === id);
                                            if (target) {
                                                target.hasExtraBed = !current;
                                                // If toggling OFF, handle overflow
                                                if (current && target.guests.length > target.capacity) {
                                                    const overflowCount = target.guests.length - target.capacity;
                                                    const overflowGuests = target.guests.splice(-overflowCount);
                                                    setTempUnassigned(un => [...un, ...overflowGuests.map(g => ({ ...g, roomId: undefined }))]);
                                                }
                                            }
                                            return next;
                                        });
                                        return;
                                    }

                                    // if not editing, do nothing
                                    return;
                                }}
                                onRemoveGuest={async (gId) => {
                                    if (isEditing) {
                                        const guestObj = [...tempUnassigned, ...tempRooms.flatMap(r => r.guests)].find(g => g.id === gId);
                                        if (!guestObj) return;

                                        setTempRooms(prev => {
                                            const next = JSON.parse(JSON.stringify(prev)) as RoomType[];
                                            next.forEach(r => {
                                                r.guests = r.guests.filter(g => g.id !== gId);
                                            });
                                            return next;
                                        });
                                        setTempUnassigned(prev => [...prev.filter(g => g.id !== gId), { ...guestObj, roomId: undefined }]);
                                        return;
                                    }

                                    // if not editing, do nothing
                                    return;
                                }}
                            />
                        ))}

                        {/* Add new room placeholder */}
                        <div
                            onClick={!isEditing ? handleAddRooms : undefined}
                            className={`border-2 border-dashed border-gray-300 rounded-xl min-h-[200px] flex items-center justify-center transition-colors group ${isEditing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-brand-400 hover:bg-brand-50'}`}
                        >
                            <div className="text-center">
                                <div className="bg-white p-3 rounded-full inline-block mb-2 shadow-sm group-hover:shadow-md transition-shadow">
                                    <Bed size={24} className="text-brand-600" />
                                </div>
                                <p className="font-medium text-brand-700">Add X Rooms</p>
                            </div>
                        </div>
                    </div>
                </div>

                <DragOverlay>
                    {activeGuest ? (
                        <div className="bg-white p-3 rounded-lg border border-brand-400 shadow-xl opacity-90 scale-105 cursor-grabbing rotate-2">
                            <p className="font-medium text-sm text-gray-900">{activeGuest.name}</p>
                            <p className="text-xs text-brand-600 font-medium">Dragging...</p>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}

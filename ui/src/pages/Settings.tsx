import { useState, useEffect } from 'react';
import { Share2, Users, Copy, Check, UserCheck, ShieldCheck, Link as LinkIcon, Unlink, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL, authFetch } from '../config';

export default function Settings() {
    const [loading, setLoading] = useState(true);
    const [accessData, setAccessData] = useState<{
        shareCode: string | null;
        primaryUser: { mobile: string } | null;
        sharedUsers: { id: number; mobile: string; readOnly: boolean }[];
        isReadOnly?: boolean;
    } | null>(null);
    const [joinCode, setJoinCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [copied, setCopied] = useState(false);

    // WhatsApp Native config state
    const [waStatus, setWaStatus] = useState<string>('loading');
    const [waQrCode, setWaQrCode] = useState<string | null>(null);

    const isMaster = accessData !== null && !accessData.primaryUser;

    useEffect(() => {
        authFetch(`${API_BASE_URL}/api/user/share-code`)
            .then(res => res.json())
            .then(data => { setAccessData(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    // Poll WhatsApp Status
    useEffect(() => {
        if (!isMaster) return;

        let timeoutId: any;
        let isMounted = true;

        const checkStatus = async () => {
            // Prevent polling if logged out to avoid 401 redirect loops
            if (!localStorage.getItem('token')) return;

            try {
                const res = await authFetch(`${API_BASE_URL}/api/user/whatsapp-status`);
                const data = await res.json();

                if (!isMounted) return;

                setWaStatus(data.status);

                if (data.status === 'qr_ready') {
                    const qrRes = await authFetch(`${API_BASE_URL}/api/user/whatsapp-qr`);
                    const qrData = await qrRes.json();
                    if (qrData.qr && isMounted) setWaQrCode(qrData.qr);
                } else {
                    setWaQrCode(null);
                }

                // Schedule next check: 3s if connecting/QR, 60s if already ready
                const delay = (data.status === 'authenticated' || data.status === 'ready') ? 60000 : 3000;
                timeoutId = setTimeout(checkStatus, delay);
            } catch (e) {
                console.error('Failed to fetch WA status', e);
                if (isMounted) timeoutId = setTimeout(checkStatus, 10000); // Retry later on error
            }
        };

        checkStatus();
        return () => {
            isMounted = false;
            clearTimeout(timeoutId);
        };
    }, [isMaster]);

    const handleCopy = () => {
        if (!accessData?.shareCode) return;
        navigator.clipboard.writeText(accessData.shareCode).then(() => {
            setCopied(true);
            toast.success('Share code copied to clipboard!');
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleJoin = async () => {
        if (!joinCode.trim()) return;
        const isConfirmed = window.confirm("Warning: Joining another wedding will temporarily hide your current guests, rooms, and finances until you disconnect. Do you wish to continue?");
        if (!isConfirmed) return;
        setIsJoining(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/api/user/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shareCode: joinCode.trim() }) });
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
            const res = await authFetch(`${API_BASE_URL}/api/user/join`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shareCode: null }) });
            if (res.ok) { toast.success('Disconnected successfully'); setTimeout(() => window.location.reload(), 1000); }
        } catch { toast.error('Failed to disconnect'); }
    };

    const toggleAccess = async (user: { id: number; mobile: string; readOnly: boolean }) => {
        const newReadOnly = !user.readOnly;
        try {
            const res = await authFetch(`${API_BASE_URL}/api/user/shared-access/${user.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ readOnly: newReadOnly }) });
            if (!res.ok) throw new Error('Failed');
            toast.success(`${user.mobile} is now ${newReadOnly ? 'Read Only' : 'Read/Write'}`);
            setAccessData(prev => prev ? { ...prev, sharedUsers: prev.sharedUsers.map(u => u.id === user.id ? { ...u, readOnly: newReadOnly } : u) } : prev);
        } catch { toast.error('Failed to update access'); }
    };

    const handleWaLogout = async () => {
        if (!confirm('Unlink this WhatsApp device?')) return;
        try {
            await authFetch(`${API_BASE_URL}/api/user/whatsapp-logout`, { method: 'POST' });
            toast.success('WhatsApp unlinked');
        } catch { toast.error('Failed to unlink'); }
    };

    if (loading) return <div className="text-center mt-10">Loading Settings...</div>;

    return (
        <div className="animate-fade-in max-w-4xl mx-auto space-y-8 pb-12">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-display text-gray-900 dark:text-white">Settings</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your account and wedding access</p>
            </header>

            {/* Access Sharing Section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-8">
                <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold font-display text-gray-900 dark:text-white flex items-center gap-2">
                            <Share2 className="text-brand-600 dark:text-brand-500" size={24} />
                            Wedding Access
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Share access with your partner or family members</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Share Your Wedding */}
                    <div className="card bg-gradient-to-br from-brand-50 to-white dark:from-brand-900/10 dark:to-slate-800 border-brand-100 dark:border-brand-900/30 h-full">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white font-display">Invite Others</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Give this code to others so they can join and help manage your wedding.</p>
                            </div>
                            <div className="p-3 bg-white dark:bg-slate-700 rounded-xl shadow-sm border border-brand-100 dark:border-slate-600 text-brand-600 dark:text-brand-400 shrink-0"><Users size={20} /></div>
                        </div>

                        {accessData?.primaryUser ? (
                            <div className="bg-white dark:bg-slate-800 rounded-lg p-5 border border-brand-100 dark:border-slate-700 text-center mt-6">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">You are currently viewing a shared wedding.</p>
                                <p className="font-semibold text-gray-900 dark:text-white text-lg">Linked to: {accessData.primaryUser.mobile}</p>
                                <button onClick={handleDisconnect} className="mt-6 inline-flex items-center gap-2 text-red-600 font-medium hover:bg-red-50 px-4 py-2 rounded-lg transition-colors">
                                    <Unlink size={18} /> Disconnect Account
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6 mt-6">
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-brand-200 dark:border-slate-700 p-6 flex flex-col items-center justify-center relative group">
                                    <p className="text-xs text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider mb-2">Your Share Code</p>
                                    <div className="flex items-center gap-4">
                                        <p className="text-5xl font-display font-bold tracking-widest text-gray-900 dark:text-white">{accessData?.shareCode || '------'}</p>
                                        <button onClick={handleCopy} className="p-3 rounded-full hover:bg-brand-50 dark:hover:bg-slate-700 text-brand-600 dark:text-brand-400 transition-colors">
                                            {copied ? <Check size={24} /> : <Copy size={24} />}
                                        </button>
                                    </div>
                                </div>

                                {accessData?.sharedUsers && accessData.sharedUsers.length > 0 && (
                                    <div className="mt-4 border-t border-brand-100 dark:border-slate-700 pt-4">
                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Accounts Linked to You:</p>
                                        <div className="space-y-2">
                                            {accessData.sharedUsers.map((user) => (
                                                <div key={user.id} className="flex items-center justify-between bg-white dark:bg-slate-800 px-4 py-3 rounded-lg border border-gray-100 dark:border-slate-700">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-500"><UserCheck size={16} /></div>
                                                        <span className="text-gray-700 dark:text-gray-300 font-medium">{user.mobile}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${user.readOnly ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-500' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-500'}`}>
                                                            {user.readOnly ? 'Read Only' : 'Read/Write'}
                                                        </span>
                                                        <button onClick={() => toggleAccess(user)} className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 font-medium px-2 py-1 rounded hover:bg-brand-50 dark:hover:bg-slate-700 transition-colors">
                                                            {user.readOnly ? 'Grant Write' : 'Revoke Write'}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Join a Wedding */}
                    <div className="card h-full">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white font-display">Join a Wedding</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Enter a 6-digit share code to help manage someone else's wedding.</p>
                            </div>
                            <div className="p-3 bg-gray-50 dark:bg-slate-700 rounded-xl border border-gray-100 dark:border-slate-600 text-gray-600 dark:text-gray-300 shrink-0"><LinkIcon size={20} /></div>
                        </div>
                        <div className="mt-8">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Share Code</label>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input type="text" placeholder="e.g. A1B2C3" className="input-field text-lg uppercase font-bold placeholder:normal-case placeholder:font-normal flex-1"
                                    value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} maxLength={6} disabled={isJoining || !!accessData?.primaryUser} />
                                <button onClick={handleJoin} disabled={joinCode.length < 6 || isJoining || !!accessData?.primaryUser} className="btn-primary whitespace-nowrap px-6">
                                    {isJoining ? 'Joining...' : 'Join Wedding'}
                                </button>
                            </div>
                            {!!accessData?.primaryUser && (
                                <div className="mt-6 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/50 rounded-lg p-4 flex gap-3 text-orange-800 dark:text-orange-400">
                                    <Unlink className="shrink-0 mt-0.5" size={20} />
                                    <p className="text-sm">You are already linked to a wedding. You must disconnect your current link before you can join a new one.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Native WhatsApp Device Linker — admin only */}
            {isMaster && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 p-8">
                    <header className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold font-display text-gray-900 dark:text-white flex items-center gap-2">
                                <MessageCircle className="text-[#25D366]" size={24} />
                                Link WhatsApp
                            </h2>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">Connect your personal or business WhatsApp to send guest notifications directly.</p>
                        </div>
                        <div className="shrink-0">
                            {(waStatus === 'authenticated' || waStatus === 'ready') && (
                                <div className="flex items-center gap-2 bg-[#25D366]/10 border border-[#25D366]/20 text-[#128C7E] font-medium text-sm px-4 py-2 rounded-full">
                                    <ShieldCheck size={18} /> Connected
                                </div>
                            )}
                        </div>
                    </header>

                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 mb-8 text-sm text-amber-800 dark:text-amber-400">
                        <p>🔒 <strong>Admin only</strong> — This connection runs securely on your Node backend. Shared users can trigger messages but cannot see this QR code.</p>
                    </div>

                    <div className="flex justify-center border border-gray-100 dark:border-slate-700 rounded-2xl p-8 bg-gray-50/50 dark:bg-slate-800/50">
                        {waStatus === 'starting' && (
                            <div className="text-center py-10">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#25D366] mx-auto mb-4"></div>
                                <p className="text-gray-500 dark:text-gray-400 font-medium">Initializing WhatsApp Web locally...</p>
                            </div>
                        )}

                        {waStatus === 'qr_ready' && waQrCode && (
                            <div className="flex flex-col md:flex-row items-center gap-10">
                                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700">
                                    <img src={waQrCode} alt="WhatsApp QR Code" className="w-64 h-64 object-contain" />
                                </div>
                                <div className="max-w-xs space-y-4">
                                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">To use WhatsApp Planner:</h3>
                                    <ol className="list-decimal list-inside space-y-3 text-gray-600 dark:text-gray-400">
                                        <li>Open WhatsApp on your phone</li>
                                        <li>Tap <strong>Menu</strong> or <strong>Settings</strong> and select <strong>Linked Devices</strong></li>
                                        <li>Tap on <strong>Link a device</strong></li>
                                        <li>Point your phone to this screen to capture the code</li>
                                    </ol>
                                </div>
                            </div>
                        )}

                        {(waStatus === 'authenticated' || waStatus === 'ready') && (
                            <div className="text-center py-8">
                                <div className="w-20 h-20 bg-[#25D366]/20 text-[#25D366] rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Check size={40} className="stroke-[3]" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">WhatsApp is Ready!</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm mx-auto">Your phone is successfully linked. You can now send beautiful guest notifications from the Notify tab.</p>

                                <button onClick={handleWaLogout} className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 font-medium px-6 py-2.5 rounded-lg transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/50">
                                    Unlink Device
                                </button>
                            </div>
                        )}

                        {(waStatus === 'disconnected' || waStatus === 'failed') && (
                            <div className="text-center py-10">
                                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Unlink size={30} />
                                </div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Disconnected</h3>
                                <p className="text-gray-500 dark:text-gray-400 mt-1">The connection was lost or failed to start. Restarting...</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}


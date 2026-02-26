import { useEffect, useState } from 'react';
import { Share2, Users, Link as LinkIcon, Unlink, Copy, Check, UserCheck } from 'lucide-react';
import { API_BASE_URL, authFetch } from '../config';
import toast from 'react-hot-toast';

export default function Settings() {
    const [loading, setLoading] = useState(true);
    const [accessData, setAccessData] = useState<{
        shareCode: string | null;
        primaryUser: { mobile: string } | null;
        sharedUsers: { mobile: string }[];
    } | null>(null);
    const [joinCode, setJoinCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        authFetch(`${API_BASE_URL}/api/user/share-code`)
            .then(res => res.json())
            .then(data => {
                setAccessData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching share code:', err);
                setLoading(false);
            });
    }, []);

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

        // Data loss warning
        const isConfirmed = window.confirm(
            "Warning: Joining another wedding will temporarily hide your current guests, rooms, and finances until you disconnect. Do you wish to continue?"
        );
        if (!isConfirmed) return;

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

    if (loading) return <div className="text-center mt-10">Loading Settings...</div>;

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-display text-gray-900">Settings</h1>
                <p className="text-gray-500 mt-1">Manage your account and wedding access</p>
            </header>

            {/* Access Sharing Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold font-display text-gray-900 flex items-center gap-2">
                            <Share2 className="text-brand-600" size={24} />
                            Wedding Access
                        </h2>
                        <p className="text-gray-500 mt-1">Share access with your partner or family members</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Share Your Wedding */}
                    <div className="card bg-gradient-to-br from-brand-50 to-white border-brand-100 h-full">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 font-display">Invite Others</h3>
                                <p className="text-sm text-gray-500 mt-1">Give this code to others so they can join and help manage your wedding.</p>
                            </div>
                            <div className="p-3 bg-white rounded-xl shadow-sm border border-brand-100 text-brand-600 shrink-0">
                                <Users size={20} />
                            </div>
                        </div>

                        {accessData?.primaryUser ? (
                            <div className="bg-white rounded-lg p-5 border border-brand-100 text-center mt-6">
                                <p className="text-sm text-gray-600 mb-2">You are currently viewing a shared wedding.</p>
                                <p className="font-semibold text-gray-900 text-lg">Linked to: {accessData.primaryUser.mobile}</p>
                                <button
                                    onClick={handleDisconnect}
                                    className="mt-6 inline-flex items-center gap-2 text-red-600 font-medium hover:bg-red-50 px-4 py-2 rounded-lg transition-colors"
                                >
                                    <Unlink size={18} /> Disconnect Account
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-6 mt-6">
                                <div className="bg-white rounded-xl border border-brand-200 p-6 flex flex-col items-center justify-center relative group">
                                    <p className="text-xs text-brand-600 font-bold uppercase tracking-wider mb-2">Your Share Code</p>
                                    <div className="flex items-center gap-4">
                                        <p className="text-5xl font-display font-bold tracking-widest text-gray-900">
                                            {accessData?.shareCode || '------'}
                                        </p>
                                        <button
                                            onClick={handleCopy}
                                            className="p-3 rounded-full hover:bg-brand-50 text-brand-600 transition-colors tooltip tooltip-top"
                                            data-tip="Copy Code"
                                        >
                                            {copied ? <Check size={24} /> : <Copy size={24} />}
                                        </button>
                                    </div>
                                </div>

                                {accessData?.sharedUsers && accessData.sharedUsers.length > 0 && (
                                    <div className="mt-4 border-t border-brand-100 pt-4">
                                        <p className="text-sm font-medium text-gray-700 mb-3">Accounts Linked to You:</p>
                                        <div className="space-y-2">
                                            {accessData.sharedUsers.map((user, idx) => (
                                                <div key={idx} className="flex items-center gap-3 bg-white px-4 py-3 rounded-lg border border-gray-100 text-gray-700 font-medium">
                                                    <div className="p-1.5 bg-green-100 rounded-full text-green-600">
                                                        <UserCheck size={16} />
                                                    </div>
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
                    <div className="card h-full">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 font-display">Join a Wedding</h3>
                                <p className="text-sm text-gray-500 mt-1">Enter a 6-digit share code to help manage someone else's wedding.</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-gray-600 shrink-0">
                                <LinkIcon size={20} />
                            </div>
                        </div>

                        <div className="mt-8">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Share Code</label>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input
                                    type="text"
                                    placeholder="e.g. A1B2C3"
                                    className="input-field text-lg uppercase font-bold placeholder:normal-case placeholder:font-normal flex-1"
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                    maxLength={6}
                                    disabled={isJoining || !!accessData?.primaryUser}
                                />
                                <button
                                    onClick={handleJoin}
                                    disabled={joinCode.length < 6 || isJoining || !!accessData?.primaryUser}
                                    className="btn-primary whitespace-nowrap px-6"
                                >
                                    {isJoining ? 'Joining...' : 'Join Wedding'}
                                </button>
                            </div>

                            {!!accessData?.primaryUser && (
                                <div className="mt-6 bg-orange-50 border border-orange-100 rounded-lg p-4 flex gap-3 text-orange-800">
                                    <Unlink className="shrink-0 mt-0.5" size={20} />
                                    <p className="text-sm">
                                        You are already linked to a wedding. You must disconnect your current link before you can join a new one.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

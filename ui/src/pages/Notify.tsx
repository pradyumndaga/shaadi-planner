import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
    MessageCircle, Users, CheckCircle2, XCircle, Send, Sparkles,
    ChevronDown, ChevronUp, Loader2, Eye, Paperclip, X, Code2
} from 'lucide-react';
import { API_BASE_URL, authFetch } from '../config';
import toast from 'react-hot-toast';

interface Guest {
    id: number;
    name: string;
    mobile: string;
    isNotified: boolean;
    isTentative: boolean;
    room?: { name: string } | null;
    side?: string;
}

const VARIABLES = [
    { token: '{{name}}', label: 'Guest Name', example: 'Rahul Sharma' },
    { token: '{{room}}', label: 'Room', example: 'Room 201' },
    { token: '{{date}}', label: 'Wedding Date', example: '15 March 2025' },
    { token: '{{venue}}', label: 'Venue', example: 'Taj Palace, Mumbai' },
    { token: '{{mobile}}', label: 'Mobile', example: '9876543210' },
];

const TEMPLATES = [
    { label: 'Room Allotment', text: 'Dear {{name}}, 🏨 your room has been allocated: *{{room}}* for the wedding on {{date}} at {{venue}}. Looking forward to seeing you! 🎊' },
    { label: 'Wedding Reminder', text: 'Hi {{name}}! 💍 Just a reminder that the wedding is on *{{date}}* at *{{venue}}*. We are so excited to celebrate with you! 🎉' },
    { label: 'RSVP Request', text: 'Dear {{name}}, we would love to confirm your attendance at the wedding on {{date}} at {{venue}}. Please reply YES or NO. 🙏' },
    { label: 'Thank You', text: 'Dear {{name}}, 🙏 Thank you so much for being part of our special day! Your presence made it even more memorable. With love ❤️' },
];

function resolveMessage(template: string, guest: Guest, date: string, venue: string): string {
    return template
        .replace(/\{\{name\}\}/gi, guest.name || '')
        .replace(/\{\{room\}\}/gi, guest.room?.name || 'TBD')
        .replace(/\{\{mobile\}\}/gi, guest.mobile || '')
        .replace(/\{\{date\}\}/gi, date || '')
        .replace(/\{\{venue\}\}/gi, venue || '');
}

export default function Notify() {
    const location = useLocation();
    const navState = location.state as { filter?: string } | null;

    // Guests
    const [guests, setGuests] = useState<Guest[]>([]);
    const [loadingGuests, setLoadingGuests] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [guestFilter, setGuestFilter] = useState<'all' | 'assigned' | 'unnotified'>('all');
    const [guestSearch, setGuestSearch] = useState('');
    const [guestListOpen, setGuestListOpen] = useState(false);

    // Message
    const [message, setMessage] = useState('');
    const [date, setDate] = useState('');
    const [venue, setVenue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [previewGuest, setPreviewGuest] = useState<Guest | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    // AI Assist
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiOpen, setAiOpen] = useState(false);
    const aiModel = localStorage.getItem('shaadi_ai_model') || 'dall-e-3';
    const aiApiKey = localStorage.getItem('shaadi_ai_api_key') || '';

    // Sending
    const [sending, setSending] = useState(false);
    const [results, setResults] = useState<{ id: number; name: string; status: string; error?: string }[]>([]);

    useEffect(() => {
        authFetch(`${API_BASE_URL}/api/guests`)
            .then(r => r.json())
            .then(data => {
                setGuests(data);
                setLoadingGuests(false);

                // Handle navigation state for auto-filtering and selection
                if (navState?.filter === 'unnotified') {
                    setGuestFilter('unnotified');
                    setGuestListOpen(true);

                    // Pre-select guests who are not notified and have a room
                    const unnotifiedWithRoom = data.filter((g: Guest) => !g.isNotified && g.room);
                    if (unnotifiedWithRoom.length > 0) {
                        setSelectedIds(new Set(unnotifiedWithRoom.map((g: Guest) => g.id)));
                        // Pre-select the Room Allotment template
                        setMessage(TEMPLATES[0].text);
                        toast.success(`Auto-selected ${unnotifiedWithRoom.length} guests for room notification`);
                    }
                }
            })
            .catch(() => setLoadingGuests(false));
    }, [navState]);

    const filteredGuests = guests.filter(g => {
        if (guestFilter === 'assigned' && !g.room) return false;
        if (guestFilter === 'unnotified' && g.isNotified) return false;
        if (guestSearch && !g.name.toLowerCase().includes(guestSearch.toLowerCase())) return false;
        return true;
    });

    const toggleGuest = (id: number) => {
        setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
    };
    const selectAll = () => setSelectedIds(new Set(filteredGuests.map(g => g.id)));
    const clearAll = () => setSelectedIds(new Set());

    // Insert variable at cursor
    const insertVariable = (token: string) => {
        const ta = textareaRef.current;
        if (!ta) { setMessage(m => m + token); return; }
        const start = ta.selectionStart, end = ta.selectionEnd;
        const newMsg = message.slice(0, start) + token + message.slice(end);
        setMessage(newMsg);
        setTimeout(() => { ta.focus(); ta.setSelectionRange(start + token.length, start + token.length); }, 0);
    };

    // AI message generation
    const assistWithAI = async () => {
        if (!aiApiKey) { toast.error('No AI API key found. Configure one in the AI Studio tab.'); return; }
        if (!aiPrompt.trim()) { toast.error('Describe what kind of message you want.'); return; }
        setAiLoading(true);

        const prompt = `Write a warm, personalized WhatsApp message for a wedding guest. 
Context: ${aiPrompt}
Use these template variables exactly as shown: {{name}} for guest name, {{room}} for room, {{date}} for wedding date, {{venue}} for venue.
Keep it concise (under 200 characters), friendly and use 1-2 emojis. Return ONLY the message text, nothing else.`;

        try {
            let text = '';
            if (aiModel.startsWith('gemini') || aiModel.includes('gemini')) {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${aiApiKey}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });
                const d = await res.json();
                if (!res.ok) throw new Error(d.error?.message || 'Gemini error');
                text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
            } else {
                const res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiApiKey}` },
                    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], max_tokens: 300 })
                });
                const d = await res.json();
                if (!res.ok) throw new Error(d.error?.message || 'OpenAI error');
                text = d.choices?.[0]?.message?.content || '';
            }
            setMessage(text.trim());
            setAiOpen(false);
            setAiPrompt('');
            toast.success('AI message generated!');
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'AI generation failed');
        } finally { setAiLoading(false); }
    };

    const [attachmentBase64, setAttachmentBase64] = useState<string | null>(null);
    const [attachmentName, setAttachmentName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { toast.error('File must be less than 5MB'); return; }

        const reader = new FileReader();
        reader.onload = (ev) => {
            setAttachmentBase64(ev.target?.result as string);
            setAttachmentName(file.name);
        };
        reader.readAsDataURL(file);
    };

    const sendMessages = async () => {
        if (selectedIds.size === 0) { toast.error('Select at least one guest.'); return; }
        if (!message.trim() && !attachmentBase64) { toast.error('Please write a message or attach a file.'); return; }

        setSending(true); setResults([]);
        try {
            const res = await authFetch(`${API_BASE_URL}/api/guests/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guestIds: Array.from(selectedIds), message, weddingDate: date, venue, imageBase64: attachmentBase64 })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Send failed');
            setResults(data.results || []);
            toast.success(`✅ Sent: ${data.sent} | ❌ Failed: ${data.failed}`);
            setAttachmentBase64(null);
            setAttachmentName(null);
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to send');
        } finally { setSending(false); }
    };

    const preview = previewGuest || filteredGuests[0] || null;
    const previewText = preview ? resolveMessage(message || '(write a message above)', preview, date, venue) : '';

    if (loadingGuests) return <div className="text-center mt-10 text-gray-500">Loading guests...</div>;

    return (
        <div className="animate-fade-in max-w-5xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-display text-gray-900 flex items-center gap-3">
                    <MessageCircle className="text-[#25D366]" size={30} />
                    WhatsApp Notifications
                </h1>
                <p className="text-gray-500 mt-1">Send personalized WhatsApp messages to your wedding guests</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left: Guest Selector */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <button onClick={() => setGuestListOpen(o => !o)} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-50 rounded-lg text-green-600"><Users size={18} /></div>
                                <div className="text-left">
                                    <p className="font-semibold text-gray-900">Select Guests</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{selectedIds.size} of {guests.length} selected</p>
                                </div>
                            </div>
                            {guestListOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                        </button>

                        {guestListOpen && (
                            <div className="border-t border-gray-100 p-4 space-y-3">
                                {/* Filters */}
                                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                                    {([['all', 'All'], ['assigned', 'Assigned'], ['unnotified', 'Unsent']] as const).map(([k, l]) => (
                                        <button key={k} onClick={() => setGuestFilter(k)}
                                            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${guestFilter === k ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}>
                                            {l}
                                        </button>
                                    ))}
                                </div>
                                <input type="text" placeholder="Search guest..." className="input-field text-sm"
                                    value={guestSearch} onChange={e => setGuestSearch(e.target.value)} />
                                <div className="flex gap-2">
                                    <button onClick={selectAll} className="text-xs text-brand-600 hover:underline">Select All ({filteredGuests.length})</button>
                                    <span className="text-gray-300">|</span>
                                    <button onClick={clearAll} className="text-xs text-gray-400 hover:underline">Clear</button>
                                </div>
                                <div className="max-h-64 overflow-y-auto space-y-1">
                                    {filteredGuests.map(g => (
                                        <label key={g.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                                            <input type="checkbox" checked={selectedIds.has(g.id)} onChange={() => toggleGuest(g.id)}
                                                className="accent-brand-600 w-4 h-4 flex-shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-gray-900 truncate">{g.name}</p>
                                                <p className="text-xs text-gray-400">{g.mobile}{g.room ? ` · ${g.room.name}` : ''}</p>
                                            </div>
                                            {g.isNotified && <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />}
                                        </label>
                                    ))}
                                    {filteredGuests.length === 0 && <p className="text-center text-sm text-gray-400 py-4">No guests found</p>}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Wedding context for variables */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                        <p className="font-semibold text-gray-900 text-sm">Wedding Context <span className="text-gray-400 font-normal text-xs">(used in {'{{date}}'} / {'{{venue}}'})</span></p>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Wedding Date</label>
                            <input type="date" className="input-field text-sm" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Venue</label>
                            <input type="text" className="input-field text-sm" placeholder="e.g. Taj Palace, Mumbai" value={venue} onChange={e => setVenue(e.target.value)} />
                        </div>
                    </div>
                </div>

                {/* Right: Message Composer */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Templates */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <p className="font-semibold text-gray-900 mb-3 text-sm">Quick Templates</p>
                        <div className="grid grid-cols-2 gap-2">
                            {TEMPLATES.map(t => (
                                <button key={t.label} onClick={() => setMessage(t.text)}
                                    className="text-xs text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 transition-all">
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Message Editor */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="font-semibold text-gray-900">Message Composer</p>
                            <span className="text-xs text-gray-400">{message.length} chars · ~{Math.ceil(message.length / 160)} SMS</span>
                        </div>

                        {/* Variable buttons */}
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <Code2 size={14} className="text-gray-400" />
                                <p className="text-xs font-medium text-gray-500">Insert Variable</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {VARIABLES.map(v => (
                                    <button key={v.token} onClick={() => insertVariable(v.token)}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-full hover:bg-indigo-100 transition-colors font-mono">
                                        {v.token}
                                        <span className="font-sans text-indigo-400 text-[10px]">({v.label})</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Attachment */}
                        <div className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                            <div className="flex items-center justify-between">
                                <p className="font-semibold text-gray-700 text-xs flex items-center gap-2"><Paperclip size={14} className="text-gray-500" /> Attachment</p>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
                                {!attachmentName ? (
                                    <button onClick={() => fileInputRef.current?.click()} className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline">Add Photo or PDF</button>
                                ) : (
                                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm">
                                        <span className="text-xs text-gray-700 font-medium truncate max-w-[150px]">{attachmentName}</span>
                                        <button onClick={() => { setAttachmentBase64(null); setAttachmentName(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-gray-400 hover:text-red-500 transition-colors"><X size={14} /></button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <textarea
                            ref={textareaRef}
                            className="input-field w-full resize-none font-mono text-sm leading-relaxed"
                            rows={6}
                            placeholder="Type your message here, or use AI Assist below. Click a variable above to insert it at the cursor position."
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                        />

                        {/* AI Assist */}
                        <div className="border border-purple-200 rounded-xl overflow-hidden">
                            <button onClick={() => setAiOpen(o => !o)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 hover:bg-purple-100 transition-colors">
                                <div className="flex items-center gap-2 text-purple-700">
                                    <Sparkles size={16} />
                                    <span className="text-sm font-medium">AI Assist — Generate Message</span>
                                    {!aiApiKey && <span className="text-[10px] bg-purple-200 text-purple-600 px-1.5 py-0.5 rounded-full">No API key</span>}
                                </div>
                                {aiOpen ? <ChevronUp size={16} className="text-purple-400" /> : <ChevronDown size={16} className="text-purple-400" />}
                            </button>

                            {aiOpen && (
                                <div className="p-4 space-y-3 bg-white">
                                    <textarea
                                        rows={2}
                                        className="input-field w-full resize-none text-sm"
                                        placeholder='e.g. "A warm message informing guests their room is ready, with check-in details" or "A short reminder about the wedding ceremony timing"'
                                        value={aiPrompt}
                                        onChange={e => setAiPrompt(e.target.value)}
                                    />
                                    {!aiApiKey && (
                                        <p className="text-xs text-amber-600">⚠️ No AI API key configured — go to <strong>AI Studio</strong> tab to set one up.</p>
                                    )}
                                    <button onClick={assistWithAI} disabled={aiLoading || !aiApiKey}
                                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl font-medium text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                                        {aiLoading ? <><Loader2 size={16} className="animate-spin" /> Generating...</> : <><Sparkles size={16} /> Generate with AI</>}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Preview */}
                    {message && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <button onClick={() => setShowPreview(o => !o)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-2 text-gray-700"><Eye size={16} /><span className="text-sm font-medium">Preview</span>
                                    {preview && <span className="text-xs text-gray-400">for {preview.name}</span>}
                                </div>
                                {showPreview ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                            </button>
                            {showPreview && preview && (
                                <div className="border-t border-gray-100 p-4">
                                    <div className="flex justify-end mb-3">
                                        <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600"
                                            onChange={e => setPreviewGuest(guests.find(g => g.id === parseInt(e.target.value)) || null)}>
                                            {guests.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="bg-[#e9fbe5] rounded-2xl rounded-tr-none p-4 max-w-sm ml-auto shadow-sm">
                                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{previewText}</p>
                                        <p className="text-[10px] text-gray-400 text-right mt-2">Delivered ✓✓</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Send Button */}
                    <button onClick={sendMessages} disabled={sending || selectedIds.size === 0 || (!message.trim() && !attachmentBase64)}
                        className="w-full py-4 text-lg flex items-center justify-center gap-3 rounded-xl font-semibold text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        style={{ background: sending ? '#9ca3af' : '#25D366' }}>
                        {sending
                            ? <><Loader2 size={22} className="animate-spin" /> Sending...</>
                            : <><Send size={22} /> Send WhatsApp to {selectedIds.size} Guest{selectedIds.size !== 1 ? 's' : ''}</>}
                    </button>

                    {/* Results */}
                    {results.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                            <p className="font-semibold text-gray-900 mb-3">Send Results</p>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {results.map(r => (
                                    <div key={r.id} className={`flex items-center justify-between p-3 rounded-xl text-sm ${r.status === 'sent' ? 'bg-green-50' : 'bg-red-50'}`}>
                                        <div className="flex items-center gap-2">
                                            {r.status === 'sent'
                                                ? <CheckCircle2 size={16} className="text-green-600" />
                                                : <XCircle size={16} className="text-red-500" />}
                                            <span className="font-medium text-gray-800">{r.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-xs font-semibold ${r.status === 'sent' ? 'text-green-700' : 'text-red-600'}`}>
                                                {r.status === 'sent' ? 'Sent ✓' : 'Failed'}
                                            </span>
                                            {r.error && <p className="text-[10px] text-red-400 mt-0.5 max-w-[180px] truncate">{r.error}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

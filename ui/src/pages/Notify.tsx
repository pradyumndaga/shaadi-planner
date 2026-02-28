import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
    MessageCircle, Users, CheckCircle2, XCircle, Send, Sparkles,
    ChevronDown, ChevronUp, Loader2, Eye, Paperclip, X, Code2, Edit2, Save, Plus, Tag, Trash2
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

interface CustomVar { key: string; value: string; }

function sanitizeVarKey(raw: string): string {
    return raw.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);
}

function buildVarRegex(customVars: CustomVar[]): RegExp {
    const names = [
        ...VARIABLES.map(v => v.token.replace(/\{\{|\}\}/g, '')),
        ...customVars.filter(cv => cv.key).map(cv => cv.key),
    ];
    if (names.length === 0) return /(?!)/;
    return new RegExp(`\\{\\{(${names.join('|')})\\}\\}`, 'gi');
}

const VARIABLES = [
    { token: '{{name}}', label: 'Guest Name', example: 'Rahul Sharma' },
    { token: '{{room}}', label: 'Room', example: 'Room 201' },
    { token: '{{date}}', label: 'Wedding Date', example: '15 March 2025' },
    { token: '{{venue}}', label: 'Venue', example: 'Taj Palace, Mumbai' },
    { token: '{{mobile}}', label: 'Mobile', example: '9876543210' },
];

const DEFAULT_TEMPLATES = [
    { label: 'Room Allotment', text: 'Dear {{name}}, 🏨 your room has been allocated: *{{room}}* for the wedding on {{date}} at {{venue}}. Looking forward to seeing you! 🎊' },
    { label: 'Wedding Reminder', text: 'Hi {{name}}! 💍 Just a reminder that the wedding is on *{{date}}* at *{{venue}}*. We are so excited to celebrate with you! 🎉' },
    { label: 'RSVP Request', text: 'Dear {{name}}, we would love to confirm your attendance at the wedding on {{date}} at {{venue}}. Please reply YES or NO. 🙏' },
    { label: 'Thank You', text: 'Dear {{name}}, 🙏 Thank you so much for being part of our special day! Your presence made it even more memorable. With love ❤️' },
];

function resolveMessage(template: string, guest: Guest, date: string, venue: string, customVars: CustomVar[] = []): string {
    let result = template
        .replace(/\{\{name\}\}/gi, guest.name || '')
        .replace(/\{\{room\}\}/gi, guest.room?.name || 'TBD')
        .replace(/\{\{mobile\}\}/gi, guest.mobile || '')
        .replace(/\{\{date\}\}/gi, date || '')
        .replace(/\{\{venue\}\}/gi, venue || '');
    for (const cv of customVars) {
        if (!cv.key) continue;
        const re = new RegExp(`\\{\\{${cv.key}\\}\\}`, 'gi');
        result = result.replace(re, cv.value || `{{${cv.key}}}`);
    }
    return result;
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
    const overlayRef = useRef<HTMLDivElement>(null);
    const [previewGuest, setPreviewGuest] = useState<Guest | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    // Templates
    const [templates, setTemplates] = useState<{ label: string; text: string }[]>([]);
    const [editTemplatesOpen, setEditTemplatesOpen] = useState(false);
    const [editingTemplates, setEditingTemplates] = useState<{ label: string; text: string }[]>([]);

    // AI Assist
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiOpen, setAiOpen] = useState(false);
    const aiModel = localStorage.getItem('shaadi_ai_model') || 'dall-e-3';
    const aiApiKey = localStorage.getItem('shaadi_ai_api_key') || '';

    // Custom Variables
    const [customVars, setCustomVars] = useState<CustomVar[]>(() => {
        const s = localStorage.getItem('shaadi_custom_vars');
        return s ? JSON.parse(s) : [];
    });
    const [newVarKey, setNewVarKey] = useState('');
    const [newVarValue, setNewVarValue] = useState('');
    const [showAddVar, setShowAddVar] = useState(false);

    // Sending
    const [sending, setSending] = useState(false);
    const [results, setResults] = useState<{ id: number; name: string; status: string; error?: string }[]>([]);


    useEffect(() => {
        localStorage.setItem('shaadi_custom_vars', JSON.stringify(customVars));
    }, [customVars]);

    useEffect(() => {
        // Load Templates
        const stored = localStorage.getItem('shaadi_quick_templates');
        let parsed = stored ? JSON.parse(stored) : [...DEFAULT_TEMPLATES];
        // Ensure exactly 8 slots
        while (parsed.length < 8) parsed.push({ label: `Template ${parsed.length + 1}`, text: '' });
        setTemplates(parsed);

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
                        setMessage(parsed[0].text);
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

    // Add a custom variable
    const addCustomVar = () => {
        const key = sanitizeVarKey(newVarKey.trim());
        if (!key) { toast.error('Variable name cannot be empty.'); return; }
        if (VARIABLES.some(v => v.token === `{{${key}}}`)) { toast.error('Cannot override a built-in variable.'); return; }
        if (customVars.some(cv => cv.key === key)) { toast.error('Variable already exists.'); return; }
        setCustomVars(prev => [...prev, { key, value: newVarValue }]);
        setNewVarKey(''); setNewVarValue(''); setShowAddVar(false);
        toast.success(`{{${key}}} added!`);
    };
    const removeCustomVar = (key: string) => setCustomVars(prev => prev.filter(cv => cv.key !== key));
    const updateCustomVarValue = (key: string, value: string) =>
        setCustomVars(prev => prev.map(cv => cv.key === key ? { ...cv, value } : cv));

    // Handle Backspace for Variable Chips
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Backspace' && textareaRef.current) {
            const ta = textareaRef.current;
            const start = ta.selectionStart;
            if (start >= 2 && message.substring(start - 2, start) === '}}') {
                const textBeforeCursor = message.substring(0, start);
                const matchPos = textBeforeCursor.lastIndexOf('{{');
                if (matchPos !== -1) {
                    const block = message.substring(matchPos, start);
                    const allTokens = [
                        ...VARIABLES.map(v => v.token),
                        ...customVars.filter(cv => cv.key).map(cv => `{{${cv.key}}}`),
                    ];
                    if (allTokens.some(t => t === block)) {
                        e.preventDefault();
                        const newMsg = message.substring(0, matchPos) + message.substring(start);
                        setMessage(newMsg);
                        setTimeout(() => { ta.setSelectionRange(matchPos, matchPos); }, 0);
                    }
                }
            }
        }
    };

    // Render Overlay Highlights (works for both main composer and template editor)
    const renderOverlay = (text: string) => {
        const regex = buildVarRegex(customVars);
        const parts: React.ReactNode[] = [];
        let lastIndex = 0, match;
        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) parts.push(text.substring(lastIndex, match.index));
            const isCustom = customVars.some(cv => cv.key === match![1]);
            parts.push(
                <span key={match.index} className={`${isCustom
                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700'
                    : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                    } px-1 mx-[1px] rounded font-sans text-xs inline-flex items-center select-none shadow-sm align-middle h-[1.2rem]`}>
                    {match[0]}
                </span>
            );
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < text.length) parts.push(text.substring(lastIndex));
        return <>{parts}{text.endsWith('\n') ? <br /> : ''}</>;
    };


    // Sync scrolling between textarea and overlay
    const handleScroll = () => {
        if (textareaRef.current && overlayRef.current) {
            overlayRef.current.scrollTop = textareaRef.current.scrollTop;
            overlayRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    };

    // Handle Template Save
    const saveTemplates = () => {
        localStorage.setItem('shaadi_quick_templates', JSON.stringify(editingTemplates));
        setTemplates(editingTemplates);
        setEditTemplatesOpen(false);
        toast.success("Templates saved");
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
        // Pre-resolve custom variables (global values, not guest-specific)
        let resolvedMsg = message;
        for (const cv of customVars) {
            if (!cv.key) continue;
            const re = new RegExp(`\\{\\{${cv.key}\\}\\}`, 'gi');
            resolvedMsg = resolvedMsg.replace(re, cv.value || `{{${cv.key}}}`);
        }
        try {
            const res = await authFetch(`${API_BASE_URL}/api/guests/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guestIds: Array.from(selectedIds), message: resolvedMsg, weddingDate: date, venue, imageBase64: attachmentBase64 })
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
    const previewText = preview ? resolveMessage(message || '(write a message above)', preview, date, venue, customVars) : '';

    if (loadingGuests) return <div className="text-center mt-10 text-gray-500">Loading guests...</div>;

    return (
        <div className="animate-fade-in max-w-5xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-display text-gray-900 dark:text-white flex items-center gap-3">
                    <MessageCircle className="text-[#25D366]" size={30} />
                    WhatsApp Notifications
                </h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Send personalized WhatsApp messages to your wedding guests</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left: Guest Selector */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
                        <button onClick={() => setGuestListOpen(o => !o)} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg text-green-600 dark:text-green-400"><Users size={18} /></div>
                                <div className="text-left">
                                    <p className="font-semibold text-gray-900 dark:text-white">Select Guests</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{selectedIds.size} of {guests.length} selected</p>
                                </div>
                            </div>
                            {guestListOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                        </button>

                        {guestListOpen && (
                            <div className="border-t border-gray-100 dark:border-slate-700 p-4 space-y-3">
                                {/* Filters */}
                                <div className="flex gap-1 bg-gray-100 dark:bg-slate-700/50 p-1 rounded-lg">
                                    {([['all', 'All'], ['assigned', 'Assigned'], ['unnotified', 'Unsent']] as const).map(([k, l]) => (
                                        <button key={k} onClick={() => setGuestFilter(k)}
                                            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-all ${guestFilter === k ? 'bg-white dark:bg-slate-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}>
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
                                        <label key={g.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                                            <input type="checkbox" checked={selectedIds.has(g.id)} onChange={() => toggleGuest(g.id)}
                                                className="accent-brand-600 w-4 h-4 flex-shrink-0" />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{g.name}</p>
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
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 space-y-3">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">Wedding Context <span className="text-gray-400 font-normal text-xs">(used in {'{{date}}'} / {'{{venue}}'})</span></p>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Wedding Date</label>
                            <input type="date" className="input-field text-sm" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Venue</label>
                            <input type="text" className="input-field text-sm" placeholder="e.g. Taj Palace, Mumbai" value={venue} onChange={e => setVenue(e.target.value)} />
                        </div>
                    </div>

                    {/* Custom Variables */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-amber-100 dark:border-amber-900/40 shadow-sm p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Tag size={14} className="text-amber-500" />
                                <p className="font-semibold text-gray-900 dark:text-white text-sm">Custom Variables</p>
                            </div>
                            <button onClick={() => setShowAddVar(v => !v)}
                                className="text-xs font-medium text-amber-600 hover:text-amber-700 bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors">
                                <Plus size={12} /> Add
                            </button>
                        </div>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
                            Define reusable values — map links, hotel info, RSVP URLs — then insert them as <span className="font-mono bg-amber-50 dark:bg-amber-900/20 text-amber-600 px-1 rounded">{'{{key}}'}</span>
                        </p>
                        {showAddVar && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3 space-y-2">
                                <div>
                                    <label className="block text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">Variable Name</label>
                                    <div className="flex items-center">
                                        <span className="text-xs text-amber-600 font-mono bg-white dark:bg-slate-700 border border-amber-200 dark:border-amber-700 border-r-0 px-2 py-1.5 rounded-l-lg">{'{{'}&#8203;</span>
                                        <input type="text" className="flex-1 text-xs font-mono border-y border-amber-200 dark:border-amber-700 px-2 py-1.5 focus:outline-none dark:bg-slate-700 dark:text-white"
                                            placeholder="mapLink" value={newVarKey} onChange={e => setNewVarKey(sanitizeVarKey(e.target.value))}
                                            onKeyDown={e => e.key === 'Enter' && document.getElementById('nv-val')?.focus()} />
                                        <span className="text-xs text-amber-600 font-mono bg-white dark:bg-slate-700 border border-amber-200 dark:border-amber-700 border-l-0 px-2 py-1.5 rounded-r-lg">{'}}'}&#8203;</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1">Value / Replacement</label>
                                    <input id="nv-val" type="text" className="w-full text-xs border border-amber-200 dark:border-amber-700 rounded-lg px-2 py-1.5 focus:outline-none dark:bg-slate-700 dark:text-white"
                                        placeholder="https://maps.google.com/..." value={newVarValue} onChange={e => setNewVarValue(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addCustomVar()} />
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={addCustomVar} className="flex-1 text-xs font-semibold py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors">Add Variable</button>
                                    <button onClick={() => { setShowAddVar(false); setNewVarKey(''); setNewVarValue(''); }} className="text-xs px-3 py-1.5 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">Cancel</button>
                                </div>
                            </div>
                        )}
                        {customVars.length === 0 && !showAddVar && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-1">No custom variables yet. Click Add to create one.</p>
                        )}
                        <div className="space-y-2">
                            {customVars.map(cv => (
                                <div key={cv.key} className="border border-amber-100 dark:border-amber-900/40 rounded-xl p-2.5 bg-amber-50/60 dark:bg-amber-900/10 group">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-xs font-mono font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded">{`{{${cv.key}}}`}</span>
                                        <button onClick={() => removeCustomVar(cv.key)} className="text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" title="Delete"><Trash2 size={12} /></button>
                                    </div>
                                    <input type="text" className="w-full text-xs border border-amber-200 dark:border-amber-700 rounded-lg px-2 py-1.5 focus:outline-none dark:bg-slate-700 dark:text-white bg-white placeholder-gray-300"
                                        placeholder="Value / link..." value={cv.value} onChange={e => updateCustomVarValue(cv.key, e.target.value)} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Message Composer */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Templates */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 relative">
                        <div className="flex items-center justify-between mb-3">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">Quick Templates</p>
                            <button onClick={() => { setEditingTemplates(templates.map(t => ({ ...t }))); setEditTemplatesOpen(true); }} className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 font-medium bg-brand-50 dark:bg-brand-900/40 px-2 py-1 rounded-md transition-colors">
                                <Edit2 size={12} /> Edit
                            </button>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                            {templates.filter(t => t.text.trim() !== '').map((t, idx) => {
                                const isSelected = t.text === message;
                                return (
                                    <button key={idx} onClick={() => setMessage(t.text)}
                                        className={`text-xs text-left px-3 py-2 rounded-lg border transition-all truncate ${isSelected ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 ring-1 ring-brand-500 font-medium' : 'border-gray-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-slate-700/50 text-gray-600 dark:text-gray-300'}`}
                                        title={t.label}>
                                        {t.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Message Editor */}
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="font-semibold text-gray-900 dark:text-white">Message Composer</p>
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
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors font-mono">
                                        {v.token}
                                        <span className="font-sans text-indigo-400 text-[10px]">({v.label})</span>
                                    </button>
                                ))}
                                {customVars.filter(cv => cv.key).map(cv => (
                                    <button key={cv.key} onClick={() => insertVariable(`{{${cv.key}}}`)}
                                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-300 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors font-mono">
                                        {`{{${cv.key}}}`}
                                        <span className="font-sans text-amber-400 text-[10px]">custom</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Attachment */}
                        <div className="bg-gray-50 dark:bg-slate-700/50 rounded-xl border border-gray-100 dark:border-slate-600 p-3">
                            <div className="flex items-center justify-between">
                                <p className="font-semibold text-gray-700 dark:text-gray-300 text-xs flex items-center gap-2"><Paperclip size={14} className="text-gray-500" /> Attachment</p>
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

                        <div className="relative border border-gray-200 dark:border-slate-600 rounded-xl overflow-hidden focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 transition-shadow bg-white dark:bg-slate-800">
                            {/* Overlay for syntax highlighting/chips */}
                            <div
                                ref={overlayRef}
                                aria-hidden="true"
                                className="absolute inset-0 pointer-events-none p-3 whitespace-pre-wrap font-mono text-sm leading-relaxed overflow-hidden break-words text-gray-800 dark:text-white"
                            >
                                {renderOverlay(message)}
                            </div>

                            {/* Actual textarea */}
                            <textarea
                                ref={textareaRef}
                                className="w-full resize-none font-mono text-sm leading-relaxed p-3 bg-transparent text-gray-800 dark:text-white focus:outline-none placeholder:text-gray-400 block h-full min-h-[140px]"
                                style={{
                                    caretColor: 'var(--brand-600, #4f46e5)', // Ensure caret is visible
                                    color: 'transparent' // Hide raw text since overlay draws it
                                }}
                                rows={6}
                                placeholder="Type your message here... Variables will convert to chips automatically."
                                value={message}
                                onScroll={handleScroll}
                                onKeyDown={handleKeyDown}
                                onChange={e => setMessage(e.target.value)}
                            />
                        </div>

                        {/* AI Assist */}
                        <div className="border border-purple-200 dark:border-purple-900/50 rounded-xl overflow-hidden">
                            <button onClick={() => setAiOpen(o => !o)}
                                className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors">
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
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm overflow-hidden">
                            <button onClick={() => setShowPreview(o => !o)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300"><Eye size={16} /><span className="text-sm font-medium">Preview</span>
                                    {preview && <span className="text-xs text-gray-400">for {preview.name}</span>}
                                </div>
                                {showPreview ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                            </button>
                            {showPreview && preview && (
                                <div className="border-t border-gray-100 dark:border-slate-700 p-4">
                                    <div className="flex justify-end mb-3">
                                        <select className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:border-brand-500"
                                            value={previewGuest?.id || preview?.id || ''}
                                            onChange={e => setPreviewGuest(guests.find(g => g.id === parseInt(e.target.value)) || null)}>
                                            {filteredGuests.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
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
                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-5">
                            <p className="font-semibold text-gray-900 dark:text-white mb-3">Send Results</p>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {results.map(r => (
                                    <div key={r.id} className={`flex items-center justify-between p-3 rounded-xl text-sm ${r.status === 'sent' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                                        <div className="flex items-center gap-2">
                                            {r.status === 'sent'
                                                ? <CheckCircle2 size={16} className="text-green-600 dark:text-green-500" />
                                                : <XCircle size={16} className="text-red-500 dark:text-red-500" />}
                                            <span className="font-medium text-gray-800 dark:text-gray-200">{r.name}</span>
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

            {/* Edit Templates Modal */}
            {editTemplatesOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in">
                        <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50">
                            <div>
                                <h3 className="text-xl font-bold font-display text-gray-900 dark:text-white">Manage Quick Templates</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Customize up to 8 templates. Empty text will hide the template button.</p>
                            </div>
                            <button onClick={() => setEditTemplatesOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors"><X size={24} /></button>
                        </div>

                        <div className="p-6 overflow-y-auto bg-gray-50 dark:bg-slate-900/50 space-y-4 flex-1">
                            {editingTemplates.map((t, index) => (
                                <div key={index} className="bg-white dark:bg-slate-800 border text-left border-gray-200 dark:border-slate-700 rounded-xl p-4 flex flex-col lg:flex-row gap-4 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-brand-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="w-full lg:w-1/4">
                                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wider">Button Label {index + 1}</label>
                                        <input
                                            type="text"
                                            className="input-field text-sm font-medium"
                                            value={t.label}
                                            placeholder={`Template ${index + 1}`}
                                            onChange={e => {
                                                const newT = [...editingTemplates];
                                                newT[index].label = e.target.value;
                                                setEditingTemplates(newT);
                                            }}
                                        />
                                    </div>
                                    <div className="w-full lg:w-3/4 flex flex-col gap-2">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Message Text</label>
                                            <div className="relative border border-gray-200 dark:border-slate-600 rounded-xl overflow-hidden focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500 transition-shadow bg-white dark:bg-slate-800 h-[90px]">
                                                <div
                                                    id={`template-overlay-${index}`}
                                                    aria-hidden="true"
                                                    className="absolute inset-0 pointer-events-none p-3 whitespace-pre-wrap font-mono text-sm leading-relaxed overflow-hidden break-words text-gray-800 dark:text-white"
                                                >
                                                    {renderOverlay(t.text)}
                                                </div>
                                                <textarea
                                                    id={`template-textarea-${index}`}
                                                    rows={3}
                                                    className="w-full resize-none font-mono text-sm leading-relaxed p-3 bg-transparent text-gray-800 dark:text-white focus:outline-none placeholder:text-gray-400 block h-full min-h-[90px]"
                                                    style={{ caretColor: 'var(--brand-600, #4f46e5)', color: 'transparent' }}
                                                    value={t.text}
                                                    placeholder="Leave empty to hide this template slot..."
                                                    onScroll={(e) => {
                                                        const overlay = document.getElementById(`template-overlay-${index}`);
                                                        if (overlay) { overlay.scrollTop = e.currentTarget.scrollTop; overlay.scrollLeft = e.currentTarget.scrollLeft; }
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Backspace') {
                                                            const ta = e.currentTarget;
                                                            const start = ta.selectionStart;
                                                            if (start >= 2 && t.text.substring(start - 2, start) === '}}') {
                                                                const textBeforeCursor = t.text.substring(0, start);
                                                                const matchPos = textBeforeCursor.lastIndexOf('{{');
                                                                if (matchPos !== -1) {
                                                                    const block = t.text.substring(matchPos, start);
                                                                    if (VARIABLES.some(v => v.token === block)) {
                                                                        e.preventDefault();
                                                                        const newMsg = t.text.substring(0, matchPos) + t.text.substring(start);
                                                                        const newT = [...editingTemplates];
                                                                        newT[index].text = newMsg;
                                                                        setEditingTemplates(newT);
                                                                        setTimeout(() => { ta.setSelectionRange(matchPos, matchPos); }, 0);
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }}
                                                    onChange={e => {
                                                        const newT = [...editingTemplates];
                                                        newT[index].text = e.target.value;
                                                        setEditingTemplates(newT);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        {/* Insert Variables Row */}
                                        <div className="flex flex-wrap gap-1.5 mt-1">
                                            {VARIABLES.map(v => (
                                                <button
                                                    key={v.token}
                                                    type="button"
                                                    onClick={() => {
                                                        const el = document.getElementById(`template-textarea-${index}`) as HTMLTextAreaElement;
                                                        const start = el ? el.selectionStart : t.text.length;
                                                        const end = el ? el.selectionEnd : t.text.length;
                                                        const newText = t.text.substring(0, start) + v.token + t.text.substring(end);

                                                        const newT = [...editingTemplates];
                                                        newT[index].text = newText;
                                                        setEditingTemplates(newT);

                                                        if (el) {
                                                            setTimeout(() => {
                                                                el.focus();
                                                                el.setSelectionRange(start + v.token.length, start + v.token.length);
                                                            }, 0);
                                                        }
                                                    }}
                                                    className="inline-flex items-center gap-1 text-[10px] px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 text-indigo-600 dark:text-indigo-300 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors font-mono"
                                                >
                                                    {v.token}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3 p-6 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800">
                            <button onClick={() => setEditTemplatesOpen(false)} className="px-5 py-2.5 rounded-lg text-gray-600 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">Cancel</button>
                            <button onClick={saveTemplates} className="px-6 py-2.5 bg-brand-600 text-white rounded-lg font-medium shadow-md hover:bg-brand-700 hover:shadow-lg transition-all flex items-center gap-2">
                                <Save size={18} /> Save Templates
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

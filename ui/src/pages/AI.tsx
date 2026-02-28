import { useState, useRef, useEffect } from 'react';
import { Sparkles, Key, ChevronDown, ChevronUp, Download, Image as ImageIcon, Image, MessageCircle, Loader2, AlertCircle, Check, Eye, EyeOff, Video, Film, Share2, X, Send } from 'lucide-react';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import { API_BASE_URL, authFetch } from '../config';

// ─── Helpers ──────────────────────────────────────────────────
function b64toBlob(b64: string, mimeType = 'video/mp4'): Blob {
    const byteChars = atob(b64);
    const byteArrays: BlobPart[] = [];
    for (let i = 0; i < byteChars.length; i += 512) {
        const slice = byteChars.slice(i, i + 512);
        const arr = new Uint8Array(slice.length);
        for (let j = 0; j < slice.length; j++) arr[j] = slice.charCodeAt(j);
        byteArrays.push(arr.buffer as ArrayBuffer);
    }
    return new Blob(byteArrays, { type: mimeType });
}

// ─── Storage Keys ─────────────────────────────────────────────
const SK_IMG_MODEL = 'shaadi_ai_model';
const SK_IMG_KEY = 'shaadi_ai_api_key';
const SK_VID_MODEL = 'shaadi_vid_model';
const SK_VID_KEY = 'shaadi_vid_api_key';

// ─── Model Definitions ────────────────────────────────────────
const IMAGE_MODELS = [
    { id: 'dall-e-3', label: 'OpenAI DALL-E 3', provider: 'openai', description: 'High quality, realistic images', keyHint: 'sk-...', keyLink: 'platform.openai.com' },
    { id: 'gemini-2.0-flash-exp-image-generation', label: 'Google Gemini (Image)', provider: 'gemini', description: "Google's latest image model", keyHint: 'AIza...', keyLink: 'aistudio.google.com' },
];

const VIDEO_MODELS = [
    { id: 'google-veo-2', label: 'Google Veo 2', provider: 'veo', description: 'Google\'s best video model (Gemini API key)', keyHint: 'AIza...', keyLink: 'aistudio.google.com', unavailable: false },
    { id: 'openai-sora', label: 'OpenAI Sora', provider: 'sora', description: 'No public API yet — coming soon', keyHint: 'sk-...', keyLink: 'openai.com/sora', unavailable: true },
    { id: 'runway-gen3', label: 'RunwayML Gen-3 Turbo', provider: 'runway', description: 'Cinematic AI video, up to 10 seconds', keyHint: 'key_...', keyLink: 'app.runwayml.com/settings', unavailable: false },
    { id: 'luma-dream', label: 'Luma Dream Machine', provider: 'luma', description: 'Fast photorealistic video generation', keyHint: 'luma_...', keyLink: 'lumalabs.ai', unavailable: false },
];

// ─── Wedding details form (shared between tabs) ───────────────
function WeddingForm({ groomName, setGroomName, brideName, setBrideName, weddingDate, setWeddingDate, venue, setVenue }: {
    groomName: string; setGroomName: (v: string) => void;
    brideName: string; setBrideName: (v: string) => void;
    weddingDate: string; setWeddingDate: (v: string) => void;
    venue: string; setVenue: (v: string) => void;
}) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <span>💍</span> Wedding Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Groom's Name</label>
                    <input type="text" className="input-field" placeholder="e.g. Rahul Sharma" value={groomName} onChange={e => setGroomName(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bride's Name</label>
                    <input type="text" className="input-field" placeholder="e.g. Priya Gupta" value={brideName} onChange={e => setBrideName(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Wedding Date</label>
                    <input type="date" className="input-field" value={weddingDate} onChange={e => setWeddingDate(e.target.value)} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Venue / Place</label>
                    <input type="text" className="input-field" placeholder="e.g. Taj Mahal Palace, Mumbai" value={venue} onChange={e => setVenue(e.target.value)} />
                </div>
            </div>
        </div>
    );
}

// ─── Settings Panel ───────────────────────────────────────────
function SettingsPanel({ models, selectedModel, setSelectedModel, apiKey, setApiKey, keySaved, setKeySaved, title }: {
    models: typeof IMAGE_MODELS | typeof VIDEO_MODELS;
    selectedModel: string; setSelectedModel: (v: string) => void;
    apiKey: string; setApiKey: (v: string) => void;
    keySaved: boolean; setKeySaved: (v: boolean) => void;
    title: string;
}) {
    const [open, setOpen] = useState(!keySaved);
    const [showKey, setShowKey] = useState(false);
    const current = models.find(m => m.id === selectedModel)!;

    const save = () => {
        setKeySaved(true);
        setOpen(false);
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 overflow-hidden">
            <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-50 rounded-lg text-brand-600"><Key size={18} /></div>
                    <div className="text-left">
                        <p className="font-semibold text-gray-900">{title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {keySaved ? `Using: ${current?.label} • Key saved locally` : 'Configure to get started'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {keySaved && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1"><Check size={10} /> Configured</span>}
                    {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                </div>
            </button>

            {open && (
                <div className="border-t border-gray-100 p-5 space-y-5">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                        <AlertCircle size={18} className="text-blue-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-700">
                            <strong>Your API key is stored in your browser only</strong> — never sent to our servers. All calls go directly from your browser to the AI provider.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">AI Model</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {models.map(model => (
                                <button
                                    key={model.id}
                                    onClick={() => !('unavailable' in model && model.unavailable) && setSelectedModel(model.id)}
                                    disabled={'unavailable' in model && model.unavailable}
                                    className={`border rounded-xl p-4 text-left transition-all ${'unavailable' in model && model.unavailable
                                        ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                                        : selectedModel === model.id
                                            ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                                            : 'border-gray-200 hover:border-gray-300 bg-white'
                                        }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="font-semibold text-sm text-gray-900">{model.label}</p>
                                        {'unavailable' in model && model.unavailable && (
                                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">Coming Soon</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-400">{model.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">API Key</label>
                        <div className="relative">
                            <input
                                type={showKey ? 'text' : 'password'}
                                className="input-field pr-12 font-mono text-sm"
                                placeholder={current?.keyHint || '...'}
                                value={apiKey}
                                onChange={e => setApiKey(e.target.value)}
                            />
                            <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                        {current?.keyLink && <p className="text-xs text-gray-400 mt-1">Get your key at <a href={`https://${current.keyLink}`} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-700 underline">{current.keyLink}</a></p>}
                    </div>

                    <button onClick={save} disabled={!apiKey} className="btn-primary w-full">Save Settings</button>
                </div>
            )}
        </div>
    );
}

// ─── Share Modal ──────────────────────────────────────────────
interface Guest {
    id: number;
    name: string;
    mobile: string;
    isNotified: boolean;
    room?: { name: string } | null;
}

function ShareModal({ imageBase64, onClose }: { imageBase64: string, onClose: () => void }) {
    const [guests, setGuests] = useState<Guest[]>([]);
    const [loadingGuests, setLoadingGuests] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [message, setMessage] = useState('Here is a beautiful AI-generated image for our wedding! 🎨✨');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        authFetch(`${API_BASE_URL}/api/guests`)
            .then(r => r.json())
            .then(data => { setGuests(data); setLoadingGuests(false); })
            .catch(() => setLoadingGuests(false));
    }, []);

    const toggleGuest = (id: number) => {
        setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
    };
    const selectAll = () => setSelectedIds(new Set(guests.map(g => g.id)));

    const sendMessages = async () => {
        if (selectedIds.size === 0) { toast.error('Select at least one guest.'); return; }
        if (!message.trim()) { toast.error('Please write a caption.'); return; }

        setSending(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/api/guests/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guestIds: Array.from(selectedIds), message, imageBase64 })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Send failed');
            toast.success(`✅ Sent: ${data.sent} | ❌ Failed: ${data.failed}`);
            onClose();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : 'Failed to send');
        } finally { setSending(false); }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-display font-semibold text-lg flex items-center gap-2"><Share2 size={20} className="text-brand-600" /> Share Image to WhatsApp</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><X size={20} className="text-gray-500" /></button>
                </div>
                <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <img src={imageBase64} alt="Preview" className="w-full sm:w-40 sm:h-40 object-cover rounded-xl border border-gray-200 shadow-sm" />
                        <div className="flex-1 space-y-2">
                            <label className="text-sm font-medium text-gray-700">Image Caption</label>
                            <textarea className="input-field w-full resize-none" rows={5} value={message} onChange={e => setMessage(e.target.value)} placeholder="Write a message to accompany the image..." />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between items-end mb-3">
                            <label className="text-sm font-medium text-gray-700 font-display">Select Recipients ({selectedIds.size})</label>
                            <button onClick={selectAll} className="text-xs text-brand-600 hover:underline">Select All</button>
                        </div>
                        <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto bg-gray-50/50 p-2 space-y-1">
                            {loadingGuests ? <p className="text-sm text-center py-4 text-gray-400">Loading guests...</p> : guests.map(g => (
                                <label key={g.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white border border-transparent hover:border-gray-100 hover:shadow-sm cursor-pointer transition-all">
                                    <input type="checkbox" checked={selectedIds.has(g.id)} onChange={() => toggleGuest(g.id)} className="accent-brand-600 w-4 h-4 flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-900 truncate">{g.name}</p>
                                        <p className="text-xs text-gray-400">{g.mobile}</p>
                                    </div>
                                </label>
                            ))}
                            {!loadingGuests && guests.length === 0 && <p className="text-center text-sm py-4 text-gray-400">No guests found</p>}
                        </div>
                    </div>
                </div>
                <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="btn-secondary">Cancel</button>
                    <button onClick={sendMessages} disabled={sending || selectedIds.size === 0 || !message.trim()} className="btn-primary flex items-center gap-2">
                        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        Send to WhatsApp
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Image Tab ────────────────────────────────────────────────
function ImageTab({ groomName, setGroomName, brideName, setBrideName, weddingDate, setWeddingDate, venue, setVenue }: {
    groomName: string; setGroomName: (v: string) => void;
    brideName: string; setBrideName: (v: string) => void;
    weddingDate: string; setWeddingDate: (v: string) => void;
    venue: string; setVenue: (v: string) => void;
}) {
    const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem(SK_IMG_MODEL) || 'dall-e-3');
    const [apiKey, setApiKey] = useState(() => localStorage.getItem(SK_IMG_KEY) || '');
    const [keySaved, setKeySaved] = useState(!!localStorage.getItem(SK_IMG_KEY));
    const [customPrompt, setCustomPrompt] = useState('');
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [imageBase64, setImageBase64] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const imgRef = useRef<HTMLImageElement>(null);

    const saveKey = (key: string) => { localStorage.setItem(SK_IMG_KEY, key); setApiKey(key); };
    const saveModel = (m: string) => { localStorage.setItem(SK_IMG_MODEL, m); setSelectedModel(m); };
    const saveKeySaved = (v: boolean) => setKeySaved(v);

    const buildPrompt = () => {
        const d = [
            groomName && brideName ? `for the wedding of ${groomName} and ${brideName}` : '',
            weddingDate ? `on ${new Date(weddingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}` : '',
            venue ? `at ${venue}` : '',
        ].filter(Boolean).join(', ');
        const base = `Generate a beautiful, elegant wedding invitation card ${d}. Portrait orientation, print-ready.`;
        const style = customPrompt.trim() ? ` Style: ${customPrompt}` : ' Traditional Indian aesthetic with gold accents, floral motifs, ornate borders.';
        return base + style + ' No placeholder text. Make it look like a real printed card.';
    };

    const generate = async () => {
        if (!apiKey) { setError('Please configure your API key above.'); return; }
        if (!groomName || !brideName || !weddingDate || !venue) { setError('Please fill all wedding details.'); return; }
        setLoading(true); setError(null); setImageUrl(null); setImageBase64(null);
        const prompt = buildPrompt();
        const model = IMAGE_MODELS.find(m => m.id === selectedModel)!;

        try {
            if (model.provider === 'openai') {
                const res = await fetch('https://api.openai.com/v1/images/generations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: '1024x1792', quality: 'hd', response_format: 'b64_json' }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error?.message || 'OpenAI error');
                const b64 = `data:image/png;base64,${data.data[0].b64_json}`;
                setImageBase64(b64); setImageUrl(b64);

            } else if (model.provider === 'gemini') {
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE', 'TEXT'] } }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error?.message || 'Gemini error');
                const part = data.candidates?.[0]?.content?.parts?.find((p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData);
                if (!part?.inlineData) throw new Error('No image returned by Gemini. Try DALL-E 3.');
                const b64 = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                setImageBase64(b64); setImageUrl(b64);
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Generation failed. Check your API key.');
        } finally { setLoading(false); }
    };

    const downloadPng = () => {
        if (!imageBase64) return;
        const a = document.createElement('a'); a.href = imageBase64; a.download = `${groomName}_${brideName}_invitation.png`; a.click();
    };
    const downloadPdf = () => {
        if (!imageBase64) return;
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const m = 10, w = pdf.internal.pageSize.getWidth() - m * 2, h = pdf.internal.pageSize.getHeight() - m * 2;
        pdf.addImage(imageBase64, 'PNG', m, m, w, h);
        pdf.save(`${groomName}_${brideName}_invitation.pdf`);
    };

    return (
        <div className="space-y-6">
            <SettingsPanel models={IMAGE_MODELS} selectedModel={selectedModel} setSelectedModel={saveModel} apiKey={apiKey} setApiKey={saveKey} keySaved={keySaved} setKeySaved={saveKeySaved} title="Image Model & API Key" />

            {/* Wedding Details inside tab */}
            <WeddingForm
                groomName={groomName} setGroomName={setGroomName}
                brideName={brideName} setBrideName={setBrideName}
                weddingDate={weddingDate} setWeddingDate={setWeddingDate}
                venue={venue} setVenue={setVenue}
            />

            {/* Style */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><span>✨</span> Style Instructions</h2>
                <p className="text-xs text-gray-400 mb-3">Describe the design style. Leave blank for a classic Indian wedding look.</p>
                <textarea className="input-field w-full resize-none" rows={4}
                    placeholder={`e.g. "Rajasthani miniature art style with peacock motifs, deep red and gold, marigold borders"`}
                    value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} />
                <div className="mt-3 flex flex-wrap gap-2">
                    {['Traditional Indian', 'Rajasthani Floral', 'Modern Minimalist', 'Royal Gold', 'Pastel Watercolor'].map(tag => (
                        <button key={tag} onClick={() => setCustomPrompt(tag + ' style wedding invitation')}
                            className="text-xs px-3 py-1 rounded-full border border-brand-200 text-brand-700 hover:bg-brand-50 transition-colors">{tag}</button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={generate} disabled={loading} className="btn-primary flex-1 py-4 text-lg flex items-center justify-center gap-3 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed">
                    {loading ? <><Loader2 size={22} className="animate-spin" /> Generating invitation...</> : <><ImageIcon size={22} /> Generate Invitation Card</>}
                </button>
                <button
                    onClick={() => {
                        setLoading(true);
                        setError(null);
                        setTimeout(() => {
                            const dummy = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
                            setImageBase64(dummy);
                            setImageUrl(dummy);
                            setLoading(false);
                        }, 800);
                    }}
                    disabled={loading}
                    className="bg-white border-2 border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800 sm:w-auto py-4 px-6 text-sm flex items-center justify-center gap-2 rounded-xl font-medium transition-colors"
                    title="Quickly test generation & WhatsApp sharing with a dummy 1x1 image"
                >
                    <Image size={18} /> Test Mock Gen
                </button>
            </div>

            {error && <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3"><AlertCircle size={18} className="shrink-0 mt-0.5" /><p className="text-sm">{error}</p></div>}

            {imageUrl && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-50 rounded-lg text-green-600"><ImageIcon size={18} /></div>
                            <div><p className="font-semibold text-gray-900">Invitation Ready!</p><p className="text-xs text-gray-400">Generated with {IMAGE_MODELS.find(m => m.id === selectedModel)?.label}</p></div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button onClick={downloadPng} className="btn-secondary flex items-center gap-2" title="Download PNG"><Download size={16} /></button>
                            <button onClick={downloadPdf} className="btn-secondary flex items-center gap-2" title="Download PDF"><Download size={16} /></button>
                            <button onClick={() => setShowShareModal(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-xl shadow-sm hover:opacity-90 transition-opacity" style={{ backgroundColor: '#25D366' }}>
                                <MessageCircle size={16} /> Share to Guests
                            </button>
                        </div>
                    </div>
                    <div className="p-6 bg-gray-50 flex justify-center">
                        <img ref={imgRef} src={imageUrl} alt="Generated wedding invitation" className="max-h-[700px] rounded-xl shadow-xl object-contain hover:scale-[1.02] transition-transform duration-300" />
                    </div>
                </div>
            )}

            {showShareModal && imageBase64 && <ShareModal imageBase64={imageBase64} onClose={() => setShowShareModal(false)} />}
        </div>
    );
}

// ─── Video Tab ────────────────────────────────────────────────
function VideoTab({ groomName, setGroomName, brideName, setBrideName, weddingDate, setWeddingDate, venue, setVenue }: {
    groomName: string; setGroomName: (v: string) => void;
    brideName: string; setBrideName: (v: string) => void;
    weddingDate: string; setWeddingDate: (v: string) => void;
    venue: string; setVenue: (v: string) => void;
}) {
    const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem(SK_VID_MODEL) || 'runway-gen3');
    const [apiKey, setApiKey] = useState(() => localStorage.getItem(SK_VID_KEY) || '');
    const [keySaved, setKeySaved] = useState(!!localStorage.getItem(SK_VID_KEY));
    const [videoPrompt, setVideoPrompt] = useState('');
    const [duration, setDuration] = useState<'5' | '10'>('5');
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [error, setError] = useState<string | null>(null);

    const saveKey = (k: string) => { localStorage.setItem(SK_VID_KEY, k); setApiKey(k); };
    const saveModel = (m: string) => { localStorage.setItem(SK_VID_MODEL, m); setSelectedModel(m); };

    const buildPrompt = () => {
        const names = groomName && brideName ? `${groomName} and ${brideName}` : 'the couple';
        const date = weddingDate ? new Date(weddingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
        const detail = [date && `celebrating on ${date}`, venue && `at ${venue}`].filter(Boolean).join(', ');
        const base = `A beautiful cinematic wedding invitation video for ${names}${detail ? ', ' + detail : ''}. `;
        const style = videoPrompt.trim() ? videoPrompt : 'Elegant slow-motion footage of flowers, candles, and romantic decor. Soft golden light, warm tones. Overlay elegant text with couple names.';
        return base + style + ' High quality, cinematic, 4K.';
    };

    const generate = async () => {
        if (!apiKey) { setError('Please configure your video API key above.'); return; }
        if (!groomName || !brideName) { setError('Please fill in at least Groom and Bride names.'); return; }

        setLoading(true); setError(null); setVideoUrl(null);
        const prompt = buildPrompt();
        const model = VIDEO_MODELS.find(m => m.id === selectedModel)!;

        try {
            if (model.provider === 'veo') {
                // Google Veo 2 via Gemini API
                setStatus('Submitting to Google Veo 2...');
                const res = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/veo-2.0-generate-001:predictLongRunning?key=${apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            instances: [{ prompt }],
                            parameters: { aspectRatio: '9:16', sampleCount: 1 }
                        }),
                    }
                );
                const opData = await res.json();
                if (!res.ok) throw new Error(opData.error?.message || 'Veo 2 request failed');

                // Poll the long-running operation
                const opName = opData.name;
                setStatus('Generating video with Veo 2 (this may take 2–3 minutes)...');
                for (let i = 0; i < 80; i++) {
                    await new Promise(r => setTimeout(r, 4000));
                    const poll = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/${opName}?key=${apiKey}`
                    );
                    const op = await poll.json();
                    if (op.done) {
                        if (op.error) throw new Error(op.error.message || 'Veo 2 generation failed');
                        const videoB64 = op.response?.predictions?.[0]?.bytesBase64Encoded;
                        const mimeType = op.response?.predictions?.[0]?.mimeType || 'video/mp4';
                        if (videoB64) {
                            const blob = b64toBlob(videoB64, mimeType);
                            setVideoUrl(URL.createObjectURL(blob));
                            setStatus('');
                            break;
                        }
                        throw new Error('No video in Veo 2 response');
                    }
                    setStatus(`Veo 2 is generating... (${i > 0 ? `~${i * 4}s elapsed` : 'starting'})`);
                }

            } else if (model.provider === 'runway') {
                // Runway Gen-3 Alpha Turbo — text to video
                setStatus('Submitting to RunwayML...');
                const res = await fetch('https://api.dev.runwayml.com/v1/text_to_video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'X-Runway-Version': '2024-11-06' },
                    body: JSON.stringify({ model: 'gen3a_turbo', promptText: prompt, ratio: '768:1344', duration: parseInt(duration) }),
                });
                const task = await res.json();
                if (!res.ok) throw new Error(task.message || task.error || 'RunwayML error');

                // Poll for completion
                const taskId = task.id;
                setStatus('Generating video (this may take 1–2 minutes)...');
                for (let i = 0; i < 60; i++) {
                    await new Promise(r => setTimeout(r, 3000));
                    const poll = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
                        headers: { 'Authorization': `Bearer ${apiKey}`, 'X-Runway-Version': '2024-11-06' },
                    });
                    const t = await poll.json();
                    if (t.status === 'SUCCEEDED') { setVideoUrl(t.output?.[0]); setStatus(''); break; }
                    if (t.status === 'FAILED') { throw new Error(t.failure || 'RunwayML generation failed'); }
                    setStatus(`Generating... (${t.progress ? Math.round(t.progress * 100) : '..'}%)`);
                }

            } else if (model.provider === 'luma') {
                // Luma Dream Machine
                setStatus('Submitting to Luma Dream Machine...');
                const res = await fetch('https://api.lumalabs.ai/dream-machine/v1/generations/video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                    body: JSON.stringify({ prompt, aspect_ratio: '9:16', loop: false }),
                });
                const task = await res.json();
                if (!res.ok) throw new Error(task.detail || task.error || 'Luma error');

                // Poll
                const taskId = task.id;
                setStatus('Generating video (this may take 1–2 minutes)...');
                for (let i = 0; i < 60; i++) {
                    await new Promise(r => setTimeout(r, 3000));
                    const poll = await fetch(`https://api.lumalabs.ai/dream-machine/v1/generations/${taskId}`, {
                        headers: { 'Authorization': `Bearer ${apiKey}` },
                    });
                    const t = await poll.json();
                    if (t.state === 'completed') { setVideoUrl(t.assets?.video); setStatus(''); break; }
                    if (t.state === 'failed') { throw new Error(t.failure_reason || 'Luma generation failed'); }
                    setStatus(`Generating... (${t.state})`);
                }
            }
            if (!videoUrl) setError('Video generation timed out. Please try again.');
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Video generation failed. Check your API key.');
        } finally { setLoading(false); setStatus(''); }
    };

    const downloadVideo = async () => {
        if (!videoUrl) return;
        const res = await fetch(videoUrl);
        const blob = await res.blob();
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `${groomName}_${brideName}_invitation.mp4`; a.click();
    };

    return (
        <div className="space-y-6">
            <SettingsPanel models={VIDEO_MODELS} selectedModel={selectedModel} setSelectedModel={saveModel} apiKey={apiKey} setApiKey={saveKey} keySaved={keySaved} setKeySaved={setKeySaved} title="Video Model &amp; API Key" />

            {/* Wedding Details inside video tab */}
            <WeddingForm
                groomName={groomName} setGroomName={setGroomName}
                brideName={brideName} setBrideName={setBrideName}
                weddingDate={weddingDate} setWeddingDate={setWeddingDate}
                venue={venue} setVenue={setVenue}
            />

            {/* Style */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><span>🎬</span> Video Style</h2>
                <p className="text-xs text-gray-400 mb-3">Describe the video scene and mood. Leave blank for a cinematic romantic default.</p>
                <textarea className="input-field w-full resize-none" rows={4}
                    placeholder={`e.g. "Slow-motion rose petals falling over a mandap decorated with marigolds, golden hour light, traditional flute music impression"`}
                    value={videoPrompt} onChange={e => setVideoPrompt(e.target.value)} />
                <div className="mt-3 flex flex-wrap gap-2">
                    {['Cinematic Romantic', 'Floral Garden', 'Royal Palace', 'Beach Sunset', 'Temple Ceremony'].map(tag => (
                        <button key={tag} onClick={() => setVideoPrompt(tag + ' style, slow-motion cinematic wedding invitation video')}
                            className="text-xs px-3 py-1 rounded-full border border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors">{tag}</button>
                    ))}
                </div>

                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Video Duration</label>
                    <div className="flex gap-3">
                        {(['5', '10'] as const).map(d => (
                            <button key={d} onClick={() => setDuration(d)}
                                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${duration === d ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                                {d} seconds
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Info box */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">Video generation typically takes <strong>1–3 minutes</strong>. Please leave this page open while it processes.</p>
            </div>

            <button onClick={generate} disabled={loading} className="w-full py-4 text-lg flex items-center justify-center gap-3 shadow-lg disabled:opacity-60 disabled:cursor-not-allowed rounded-xl font-semibold text-white transition-all"
                style={{ background: loading ? '#9ca3af' : 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                {loading ? (
                    <><Loader2 size={22} className="animate-spin" /> {status || 'Generating...'}</>
                ) : (
                    <><Film size={22} /> Generate Video Invitation</>
                )}
            </button>

            {error && <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3"><AlertCircle size={18} className="shrink-0 mt-0.5" /><p className="text-sm">{error}</p></div>}

            {videoUrl && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><Video size={18} /></div>
                            <div><p className="font-semibold text-gray-900">Video Invitation Ready!</p><p className="text-xs text-gray-400">Generated with {VIDEO_MODELS.find(m => m.id === selectedModel)?.label}</p></div>
                        </div>
                        <button onClick={downloadVideo} className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-white text-sm" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                            <Download size={16} /> Download MP4
                        </button>
                    </div>
                    <div className="p-6 bg-gray-50 flex justify-center">
                        <video src={videoUrl} controls autoPlay loop className="max-h-[600px] rounded-xl shadow-xl" />
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────
export default function AI() {
    const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
    const [groomName, setGroomName] = useState('');
    const [brideName, setBrideName] = useState('');
    const [weddingDate, setWeddingDate] = useState('');
    const [venue, setVenue] = useState('');

    return (
        <div className="animate-fade-in max-w-4xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold font-display text-gray-900 flex items-center gap-3">
                    <Sparkles className="text-brand-600" size={30} />
                    AI Invitation Studio
                </h1>
                <p className="text-gray-500 mt-1">Generate stunning wedding invitations — image cards or cinematic videos — using AI</p>
            </header>

            {/* Tab Switcher */}
            <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('image')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'image' ? 'bg-white shadow text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <ImageIcon size={16} /> Image Invitation
                </button>
                <button
                    onClick={() => setActiveTab('video')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'video' ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <Film size={16} /> Video Invitation
                </button>
            </div>


            {/* Tab Content */}
            {activeTab === 'image'
                ? <ImageTab groomName={groomName} setGroomName={setGroomName} brideName={brideName} setBrideName={setBrideName} weddingDate={weddingDate} setWeddingDate={setWeddingDate} venue={venue} setVenue={setVenue} />
                : <VideoTab groomName={groomName} setGroomName={setGroomName} brideName={brideName} setBrideName={setBrideName} weddingDate={weddingDate} setWeddingDate={setWeddingDate} venue={venue} setVenue={setVenue} />
            }
        </div>
    );
}

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config';
import { Phone, Lock, ArrowRight, Loader2 } from 'lucide-react';

export default function Login() {
    const [mobile, setMobile] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mobile, password })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed');

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            toast.success('Welcome back!');
            navigate('/');
            window.location.reload(); // Quick way to reset state
        } catch (err: any) {
            toast.error(err.message);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col md:flex-row bg-white">
            {/* Branding Side */}
            <div className="hidden md:flex md:w-1/2 bg-brand-600 items-center justify-center p-12 text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <div className="absolute top-0 left-0 w-96 h-96 bg-white blur-3xl rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-white blur-3xl rounded-full translate-x-1/2 translate-y-1/2"></div>
                </div>
                <div className="relative z-10 max-w-md">
                    <h1 className="text-5xl font-display font-bold mb-6">ShaadiPlanner</h1>
                    <p className="text-xl text-brand-100 leading-relaxed italic">
                        "Organizing the most beautiful moments of your life, piece by piece."
                    </p>
                    <div className="mt-12 flex gap-4">
                        <div className="h-1 w-12 bg-white rounded-full"></div>
                        <div className="h-1 w-4 bg-brand-400 rounded-full"></div>
                        <div className="h-1 w-4 bg-brand-400 rounded-full"></div>
                    </div>
                </div>
            </div>

            {/* Form Side */}
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="w-full max-w-sm animate-fade-in">
                    <div className="md:hidden mb-8">
                        <h1 className="text-3xl font-display font-bold text-brand-600">ShaadiPlanner</h1>
                    </div>

                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h2>
                    <p className="text-gray-500 mb-8">Please enter your details to sign in</p>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-6 border border-red-100 animate-shake">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Indian Mobile Number</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                    <Phone size={18} />
                                </span>
                                <input
                                    type="tel"
                                    required
                                    placeholder="e.g. 9876543210"
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none"
                                    value={mobile}
                                    onChange={(e) => setMobile(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                                    <Lock size={18} />
                                </span>
                                <input
                                    type="password"
                                    required
                                    placeholder="••••••••"
                                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 transition-all hover:shadow-lg flex items-center justify-center gap-2 group"
                        >
                            {loading ? (
                                <Loader2 size={20} className="animate-spin" />
                            ) : (
                                <>
                                    Sign In
                                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-gray-600">
                        Don't have an account?{' '}
                        <Link to="/signup" className="text-brand-600 font-bold hover:underline">
                            Create Account
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

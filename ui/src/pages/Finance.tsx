import React, { useState, useEffect } from 'react';
import { Wallet, PieChart, Plus, Receipt } from 'lucide-react';
import { API_BASE_URL, authFetch } from '../config';

interface FinanceRecord {
    id: number;
    category: string;
    amount: number;
    description?: string;
    createdAt: string;
}

export default function Finance() {
    const [expenses, setExpenses] = useState<FinanceRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [category, setCategory] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    const fetchFinance = () => {
        setLoading(true);
        authFetch(`${API_BASE_URL}/api/finance`)
            .then(res => res.json())
            .then(data => {
                setExpenses(data);
                setLoading(false);
            });
    };

    useEffect(() => {
        fetchFinance();
    }, []);

    const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);

    const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!category || !amount) return;

        try {
            await authFetch(`${API_BASE_URL}/api/finance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category, amount, description })
            });
            fetchFinance();
            setCategory('');
            setAmount('');
            setDescription('');
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <div className="text-center mt-10">Loading Finances...</div>;

    return (
        <div className="animate-fade-in flex flex-col md:flex-row gap-8">

            <div className="flex-1">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold font-display text-gray-900">Finance Management</h1>
                    <p className="text-gray-500 mt-1">Track wedding budget and expenses</p>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                    <div className="card bg-gradient-to-br from-brand-600 to-brand-800 text-white border-none shadow-lg">
                        <h3 className="font-medium text-brand-100 mb-1 flex items-center gap-2">
                            <Wallet size={18} /> Total Spent
                        </h3>
                        <p className="text-4xl font-bold font-display">₹{totalSpent.toLocaleString()}</p>
                    </div>

                    <div className="card bg-white">
                        <h3 className="font-medium text-gray-500 mb-1 flex items-center gap-2">
                            <PieChart size={18} className="text-gray-400" /> Top Category
                        </h3>
                        {expenses.length > 0 ? (
                            <p className="text-2xl font-bold text-gray-900">{expenses[0].category}</p>
                        ) : (
                            <p className="text-xl text-gray-400">No expenses yet</p>
                        )}
                    </div>
                </div>

                <div className="card">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <Receipt size={20} className="text-brand-600" />
                        Recent Transactions
                    </h3>
                    <div className="space-y-4">
                        {expenses.map(exp => (
                            <div key={exp.id} className="flex justify-between items-center p-4 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors">
                                <div>
                                    <p className="font-medium text-gray-900">{exp.category}</p>
                                    <p className="text-sm text-gray-500">{exp.description || 'No description'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold text-gray-900">₹{exp.amount.toLocaleString()}</p>
                                    <p className="text-xs text-gray-400">{new Date(exp.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                        {expenses.length === 0 && (
                            <div className="text-center py-6 text-gray-500">No data to display</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Sidebar Form */}
            <div className="w-full md:w-80">
                <div className="card sticky top-8">
                    <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Plus size={18} className="text-brand-600" />
                        Add Expense
                    </h3>

                    <form onSubmit={handleAddExpense} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                            <input
                                type="text"
                                required
                                className="input-field"
                                placeholder="e.g. Venue, Catering"
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                            <input
                                type="number"
                                required
                                className="input-field"
                                placeholder="0.00"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                            <textarea
                                className="input-field"
                                rows={3}
                                placeholder="Details of expense..."
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                            ></textarea>
                        </div>

                        <button type="submit" className="btn-primary w-full shadow-md">
                            Save Expense
                        </button>
                    </form>
                </div>
            </div>

        </div>
    );
}

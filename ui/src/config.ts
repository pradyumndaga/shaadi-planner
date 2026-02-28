export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

import toast from 'react-hot-toast';

export const authFetch = async (url: string, options: RequestInit = {}) => {
    const token = localStorage.getItem('token');
    const headers = {
        ...options.headers,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        const path = window.location.pathname;
        if (path !== '/login' && path !== '/signup') {
            window.location.href = '/login';
        }
    }

    if (res.status >= 500) {
        toast.error('Server error. Please try again later.');
    }

    return res;
};

export const downloadWithToken = async (endpointPath: string) => {
    try {
        const res = await authFetch(`${API_BASE_URL}/api/user/download-token`);
        if (!res.ok) throw new Error('Failed to get download token');

        const data = await res.json();
        const hasQuery = endpointPath.includes('?');
        const url = `${API_BASE_URL}${endpointPath}${hasQuery ? '&' : '?'}token=${data.downloadToken}`;

        window.open(url, '_blank');
    } catch (err) {
        console.error(err);
        toast.error('Failed to initiate download');
    }
};

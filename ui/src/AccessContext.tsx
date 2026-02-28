import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { API_BASE_URL, authFetch } from './config';

interface AccessContextType {
    isReadOnly: boolean;
    isLoading: boolean;
}

const AccessContext = createContext<AccessContextType>({ isReadOnly: false, isLoading: true });

export function AccessProvider({ children }: { children: ReactNode }) {
    const [isReadOnly, setIsReadOnly] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            setIsLoading(false);
            return;
        }
        authFetch(`${API_BASE_URL}/api/user/share-code`)
            .then(res => res.json())
            .then(data => {
                setIsReadOnly(data.isReadOnly === true);
            })
            .catch(() => setIsReadOnly(false))
            .finally(() => setIsLoading(false));
    }, []);

    return (
        <AccessContext.Provider value={{ isReadOnly, isLoading }}>
            {children}
        </AccessContext.Provider>
    );
}

export function useAccess() {
    return useContext(AccessContext);
}

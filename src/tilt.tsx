import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type PermissionEvent = typeof DeviceOrientationEvent & {
    requestPermission?: () => Promise<'granted' | 'denied'>;
};
const TiltContext = createContext({ ready: false, needsPermission: false, enable: async () => false });

export const supportsTiltLayout = () => window.matchMedia('(any-pointer: coarse) and (prefers-reduced-motion: no-preference)').matches;

export function TiltProvider({ children }: { children: ReactNode }) {
    const [ready, setReady] = useState(false);
    const [granted, setGranted] = useState(false);
    const sensor = window.DeviceOrientationEvent as PermissionEvent | undefined;
    const needsPermission = Boolean(window.isSecureContext && sensor?.requestPermission && !granted);

    useEffect(() => {
        if (!window.isSecureContext || !sensor) return;
        const media = window.matchMedia('(any-pointer: coarse) and (prefers-reduced-motion: no-preference)');
        const sample = (event: DeviceOrientationEvent) => {
            if (media.matches && event.beta !== null && event.gamma !== null) {
                setReady(true);
                setGranted(true);
                window.removeEventListener('deviceorientation', sample);
            }
        };
        const reset = () => { setReady(false); if (media.matches) window.addEventListener('deviceorientation', sample); };
        if (media.matches) window.addEventListener('deviceorientation', sample);
        media.addEventListener('change', reset);
        return () => {
            media.removeEventListener('change', reset);
            window.removeEventListener('deviceorientation', sample);
        };
    }, [sensor]);

    const enable = async () => {
        if (!supportsTiltLayout()) return false;
        try {
            if (await sensor?.requestPermission?.() !== 'granted') return false;
            setGranted(true);
            return true;
        } catch { return false; }
    };
    return <TiltContext.Provider value={{ ready, needsPermission, enable }}>{children}</TiltContext.Provider>;
}

export const useTilt = () => useContext(TiltContext);

export function TiltPermission() {
    const { needsPermission, enable } = useTilt();
    const [denied, setDenied] = useState(false);
    if (!needsPermission) return null;
    return <div className="tilt-permission">
        <button type="button" className="pill" onClick={async () => setDenied(!await enable())}>Разрешить наклон телефона ↗</button>
        {denied && <p role="status">Доступ к датчикам не предоставлен.</p>}
    </div>;
}

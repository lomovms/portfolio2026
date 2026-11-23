import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

const SoundContext = createContext<{ enabled: boolean; toggle: () => void; context: RefObject<AudioContext | null> }>({ enabled: false, toggle: () => {}, context: { current: null } });
export const useSound = () => useContext(SoundContext);

export function SoundProvider({ children }: { children: ReactNode }) {
    const [enabled, setEnabled] = useState(false);
    const context = useRef<AudioContext | null>(null);
    useEffect(() => () => { void context.current?.close(); }, []);
    const toggle = () => {
        if (!context.current) context.current = new AudioContext();
        if (enabled) void context.current.suspend();
        else void context.current.resume();
        setEnabled(!enabled);
    };
    return <SoundContext.Provider value={{ enabled, toggle, context }}>{children}</SoundContext.Provider>;
}

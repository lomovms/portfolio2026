import { Component, useEffect, useMemo, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { View } from '@react-three/drei';
import * as THREE from 'three';

class GraphicsBoundary extends Component<{
    children: ReactNode;
}, {
    failed: boolean;
}> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    render() { return this.state.failed ? <div className="graphics-error" role="status">Для интерактивной 3D-сцены включите WebGL и аппаратное ускорение в браузере.</div> : this.props.children; }
}
function ClearViews() {
    const color = useMemo(() => new THREE.Color(), []);
    useFrame(({ gl }) => {
        const alpha = gl.getClearAlpha(); gl.getClearColor(color);
        gl.setScissorTest(false); gl.setClearColor(0, 0); gl.clear(true, true, true); gl.setClearColor(color, alpha);
    }, .75);
    return null;
}
export function Graphics({ source, home }: {
    source: RefObject<HTMLDivElement | null>;
    home: boolean;
}) {
    const [nearScene, setNearScene] = useState(true);
    useEffect(() => {
        if (!home) return;
        const regions = source.current?.querySelectorAll('.hero-stage,[data-astronaut-region]');
        const visible = new Set<Element>();
        const observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (entry.isIntersecting) visible.add(entry.target);
                else visible.delete(entry.target);
            }
            setNearScene(visible.size > 0);
        }, { rootMargin: '300px 0px' });
        regions?.forEach(region => observer.observe(region));
        return () => observer.disconnect();
    }, [home, source]);
    const active = !home || nearScene;
    return <GraphicsBoundary><Canvas aria-hidden="true" className="webgl-canvas" frameloop={active ? 'always' : 'demand'} shadows="soft" fallback={<div className="graphics-error">WebGL недоступен. Включите аппаратное ускорение браузера.</div>} eventSource={source as RefObject<HTMLElement>} eventPrefix="client" dpr={[1, 1.6]} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', visibility: active ? 'visible' : 'hidden' }}><ClearViews/><View.Port /></Canvas></GraphicsBoundary>;
}

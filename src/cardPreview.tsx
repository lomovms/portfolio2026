import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DepthPreview } from './DepthPreview';
import { projects } from './data';
import './style.css';
function Preview() {
    const [slug, setSlug] = useState('devin_ai');
    const project = projects.find(project => project.slug === slug)!;
    return <main style={{ padding: '24px', maxWidth: 820, margin: 'auto' }}>
        <h1 style={{ fontSize: 24 }}>Параллакс и фокус по глубине</h1>
        <label>Карточка <select aria-label="Карточка" value={slug} onChange={event => setSlug(event.target.value)}>{projects.map(project => <option key={project.slug} value={project.slug}>{project.title}</option>)}</select></label>
        <p>Перемещайте курсор между объектом и фоном: фокус следует за глубиной под курсором.</p>
        <div className="project-image" style={{ width: '100%', marginTop: 20 }}><DepthPreview key={slug} slug={slug} background={project.background}/></div>
        <p><a href="/projects/">← Каталог проектов</a></p>
        <details><summary>Карта глубины</summary><img src={`${import.meta.env.BASE_URL}assets/cards/${slug}-depth.png`} alt="Карта глубины: светлое ближе, тёмное дальше" style={{ width: '100%' }}/></details>
    </main>;
}
createRoot(document.getElementById('root')!).render(<Preview/>);

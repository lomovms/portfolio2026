import { lazy, Suspense, createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { expertise, portfolioWorks, projectPath } from './data';
import type { PortfolioWork } from './data';
import Tarot from './Tarot';
import { useSound } from './Sound';
import { assetPath } from './assetPath';
import { TiltPermission, TiltProvider, useTilt } from './tilt';
import './astronaut.css';
gsap.registerPlugin(ScrollTrigger);
const Graphics = lazy(async () => ({ default: (await import('./Graphics')).Graphics }));
const HeroScene = lazy(async () => ({ default: (await import('./Scenes')).HeroScene }));
const AstronautSequence = lazy(() => import('./AstronautSequence'));
const AstronautReview = lazy(async () => ({ default: (await import('./AstronautSequence')).AstronautReview }));

function AstronautPlaceholder() {
    return <section id="astronaut" className="astronaut-sequence" aria-label="Космическое путешествие астронавта">
        <div className="astro-sticky"><h2 className="astro-heading">Полёт</h2><div className="astro-device"><div className="astro-loading" role="status">ЗАГРУЖАЕМ СКАФАНДР</div></div></div>
    </section>;
}

function LazyAstronaut() {
    const anchor = useRef<HTMLDivElement>(null);
    const [near, setNear] = useState(false);
    useEffect(() => {
        const element = anchor.current;
        if (!element) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) { setNear(true); observer.disconnect(); }
        }, { rootMargin: '800px 0px' });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    return <div ref={anchor} data-astronaut-region>
        <Suspense fallback={<AstronautPlaceholder/>}>{near ? <AstronautSequence/> : <AstronautPlaceholder/>}</Suspense>
    </div>;
}

function Still({ name, background, gallery = false, eager = false, onReady }: {
    name: string; background: string; gallery?: boolean; eager?: boolean; onReady?: () => void;
}) {
    return <div className="scene static-scene" style={{ backgroundColor: background }}>
        <img src={assetPath(`assets/${gallery ? 'stills' : 'cards'}/${name}.webp`)} alt=""
            loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} decoding="async" onLoad={onReady} onError={onReady} width={1000} height={650}/>
    </div>;
}
const DepthPreview = lazy(async () => ({ default: (await import('./DepthPreview')).DepthPreview }));
const allProjects = portfolioWorks;
const githubProfile = 'https://github.com/lomovms';

function PortfolioImage({ work }: { work: PortfolioWork }) {
    const surface = useRef<HTMLDivElement>(null);
    const [near, setNear] = useState(false);
    const { ready: tilt } = useTilt();
    useEffect(() => {
        const element = surface.current;
        if (!element || near || (!tilt && !window.matchMedia('(any-hover: hover) and (prefers-reduced-motion: no-preference)').matches)) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting) return;
            setNear(true);
            observer.disconnect();
        }, { rootMargin: '180px' });
        observer.observe(element);
        return () => observer.disconnect();
    }, [tilt, near]);
    const poster = <div className="depth-preview"><img src={assetPath(`assets/cards/${work.slug}.webp`)} alt=""
        loading="lazy" decoding="async" width="1000" height="650" style={{ transform: 'scale(1.075)' }}/></div>;
    return <div ref={surface} className="portfolio-image" style={{ backgroundColor: work.background }}>
        <Suspense fallback={poster}>{near ? <DepthPreview slug={work.slug} background={work.background} portfolio tilt={tilt}/> : poster}</Suspense>
    </div>;
}
const NavigationContext = createContext<(path: string) => void>(() => { });
function LocalLink({ to, children, className = '', label }: {
    to: string;
    children: ReactNode;
    className?: string;
    label?: string;
}) {
    const go = useContext(NavigationContext);
    return <a href={`${import.meta.env.BASE_URL}${to.replace(/^\//, '')}`} className={className} aria-label={label} onClick={(event: MouseEvent<HTMLAnchorElement>) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return; event.preventDefault(); go(to); }}>{children}</a>;
}
function Pill({ to, children, dark = false }: {
    to: string;
    children: ReactNode;
    dark?: boolean;
}) { return <LocalLink to={to} className={`pill ${dark ? 'pill-dark' : ''}`}><span>{children}</span><span aria-hidden="true">↗</span></LocalLink>; }
function Crosshair({ text = 'ЛИСТАЙТЕ, ЧТОБЫ ОТКРЫТЬ БОЛЬШЕ' }: {
    text?: string;
}) { return <div className="crosshair"><span>+</span><span>+</span><small>{text}</small><span>+</span><span>+</span></div>; }
function Header({ onContact }: {
    onContact: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [darkHeader,setDarkHeader]=useState(false);
    const menu = useRef<HTMLDivElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);
    const { pathname } = useLocation();
    const { enabled, toggle } = useSound();
    const go = useContext(NavigationContext);
    useEffect(() => { setOpen(false); }, [pathname]);
    useEffect(()=>{
        const darkSections=new Set<Element>();
        const observer=new IntersectionObserver(entries=>{
            entries.forEach(entry=>{if(entry.isIntersecting)darkSections.add(entry.target);else darkSections.delete(entry.target);});
            setDarkHeader(darkSections.size>0);
        },{rootMargin:'0px 0px -90% 0px'});
        document.querySelectorAll('.about-intro,.tarot-section,.contact-scene,.imagination').forEach(section=>observer.observe(section));
        return()=>observer.disconnect();
    },[pathname]);
    useEffect(() => {
        if (!open)
            return;
        const key = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
                toggleRef.current?.focus();
            }
            if (event.key === 'Tab') {
                const items = menu.current?.querySelectorAll<HTMLElement>('a,button,input');
                if (!items?.length)
                    return;
                if (event.shiftKey && document.activeElement === items[0]) {
                    event.preventDefault();
                    toggleRef.current?.focus();
                }
                else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
                    event.preventDefault();
                    toggleRef.current?.focus();
                }
            }
        };
        window.addEventListener('keydown', key);
        return () => window.removeEventListener('keydown', key);
    }, [open]);
    useLayoutEffect(() => {
        if (open && menu.current) {
            gsap.fromTo(menu.current.children, { y: -16, opacity: 0 }, { y: 0, opacity: 1, duration: .45, stagger: .07, ease: 'power3.out' });
        }
    }, [open]);
    return <>
  <header className={`header ${darkHeader?'dark-header':''}`}><LocalLink to="/" className="logo" label="Lomov — на главную">LOMOV</LocalLink>
   {pathname.startsWith('/projects/') && pathname != '/projects/' && <button className="back-button" onClick={() => go('/projects/')}>↙ <span>НАЗАД</span></button>}
   <div className="header-actions"><button className={`sound-button ${enabled ? 'playing' : ''}`} onClick={toggle} aria-label={enabled ? 'Выключить звук' : 'Включить звук'} aria-pressed={enabled}><span>{enabled ? '∿' : '—'}</span></button><button className="talk-button" onClick={onContact}>ОБСУДИМ <i>•</i></button><button ref={toggleRef} className={`menu-button ${open ? 'is-open' : ''}`} aria-label={open ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={open} aria-controls="main-menu" onClick={() => setOpen(!open)}>{open ? 'ЗАКРЫТЬ' : 'МЕНЮ'} <i>{open ? '⋮' : '••'}</i></button></div>
  </header>
  {open && <><div className="menu-shade" onClick={() => setOpen(false)}/><div className="menu-panels" id="main-menu" ref={menu}><nav aria-label="Главная навигация">{[['/', 'ГЛАВНАЯ'], ['/about/', 'ОБО МНЕ'], ['/projects/', 'ПРОЕКТЫ']].map(([to, title]) => <LocalLink to={to} key={to} className={pathname.replace(/\/$/, '') === to.replace(/\/$/, '') ? 'active' : ''}>{title}<span>•</span></LocalLink>)}<button onClick={() => { setOpen(false); onContact(); }}>КОНТАКТЫ <span>↗</span></button></nav><a className="labs-button" href={githubProfile} target="_blank" rel="noreferrer">GitHub <span aria-hidden="true">↗</span></a></div></>}
 </>;
}
function Modal({ children, onClose, className = '' }: {
    children: ReactNode;
    onClose: () => void;
    className?: string;
}) {
    const box = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const previous = document.activeElement as HTMLElement;
        const y = window.scrollY;
        const old = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        box.current?.querySelector<HTMLElement>('button,a,input')?.focus();
        const key = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
            if (e.key === 'Tab') {
                const elements = box.current?.querySelectorAll<HTMLElement>('button,a,input');
                if (!elements?.length)
                    return;
                if (!e.shiftKey && document.activeElement === elements[elements.length - 1]) {
                    e.preventDefault();
                    elements[0].focus();
                }
                if (e.shiftKey && document.activeElement === elements[0]) {
                    e.preventDefault();
                    elements[elements.length - 1].focus();
                }
            }
        };
        window.addEventListener('keydown', key);
        return () => { document.body.style.overflow = old; window.removeEventListener('keydown', key); window.scrollTo({top:y,behavior:'instant'}); previous?.focus({preventScroll:true}); };
    }, [onClose]);
    return <div className={`modal ${className}`} role="dialog" aria-modal="true" ref={box} aria-label={className === 'reel-modal' ? 'Учебный шоу-рил' : 'Контакты'} onClick={e => { if (e.target === e.currentTarget)
        onClose(); }}>{children}<button className="modal-close" onClick={onClose} aria-label="Закрыть окно">ЗАКРЫТЬ ×</button></div>;
}
function Contact({ onClose }: {
    onClose: () => void;
}) {
    return <Modal onClose={onClose}><div className="contact-panel"><small>КОНТАКТЫ</small><h2>Обсудим проект?</h2><p>Интерактивный сайт, веб-графика или идея, которую хочется проверить в браузере.</p><a href={githubProfile} target="_blank" rel="noreferrer">Мой профиль на GitHub ↗</a></div></Modal>;
}
function Reel({ onClose }: {
    onClose: () => void;
}) {
    const [index, setIndex] = useState(0);
    const [playing, setPlaying] = useState(true);
    const items = allProjects;
    useEffect(() => { if (!playing)
        return; const timer = setInterval(() => setIndex(i => (i + 1) % items.length), 6000); return () => clearInterval(timer); }, [playing, items.length]);
    return <Modal onClose={onClose} className="reel-modal"><div className="reel-content"><Still name={items[index].slug} background={items[index].background}/><div className="reel-caption"><small>ПОДБОРКА РАБОТ</small><h2>{items[index].title}</h2></div><div className="reel-controls"><button onClick={() => setPlaying(!playing)}>{playing ? 'Ⅱ ПАУЗА' : '▶ ВОСПРОИЗВЕСТИ'}</button><div className="reel-progress">{items.map((p, i) => <button aria-label={`Сцена ${i + 1}: ${p.title}`} key={p.slug} className={index === i ? 'active' : ''} onClick={() => setIndex(i)}/>)}</div><span>{String(index + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}</span></div></div></Modal>;
}
function ProjectCard({ project, index }: { project: PortfolioWork; index: number }) {
    return <LocalLink to={projectPath(project)} className="project-card" label={`Открыть проект ${project.title}`}>
        <div className="project-image">
            <PortfolioImage work={project}/>
            <span className="card-open">↗</span><span className="card-index">{String(index + 1).padStart(2, '0')} — {allProjects.length}</span>
        </div>
        <p className="project-category">{project.caption}</p><h3><span className="card-title-arrow" aria-hidden="true">→</span><span>{project.title}</span></h3>
    </LocalLink>;
}
function ProjectGrid() {
    return <><TiltPermission/><div className="project-grid">{allProjects.map((project, index) => <ProjectCard key={project.slug} project={project} index={index}/>)}</div></>;
}
function Home({ onReel }: {
    onReel: () => void;
}) {
    const [loading, setLoading] = useState(true);
    const [posterReady, setPosterReady] = useState(false);
    useEffect(() => {
        const deadline = window.setTimeout(() => setLoading(false), 3500);
        return () => window.clearTimeout(deadline);
    }, []);
    useEffect(() => {
        if (!posterReady || !loading) return;
        const minimum = window.setTimeout(() => setLoading(false), 650);
        return () => window.clearTimeout(minimum);
    }, [posterReady, loading]);
    return <>
  {loading && <div className="preloader" role="status" aria-label="Загрузка главной"><span className="portfolio-loader-label">LOMOV</span><div className="loader-track"><span/></div></div>}
  <section className="home-hero page-padding"><h1>Креативный разработчик.<br className="desktop-break"/> Создаю интерактивные сайты<br className="desktop-break"/> и&nbsp;3D-графику для&nbsp;веба.</h1><div className="hero-stage"><div className="hero-poster"><Still name="hero" background="#15161c" gallery eager onReady={() => setPosterReady(true)}/></div><Suspense fallback={null}><HeroScene/></Suspense></div><Crosshair /></section>
  <section className="approach page-padding section-space"><div className="section-label reveal">МОЙ ПОДХОД</div><div className="approach-body"><h2 className="split-reveal">Соединяю дизайн, 3D и&nbsp;код, чтобы с&nbsp;идеей можно было взаимодействовать прямо в&nbsp;браузере.</h2><Pill to="/about/">Обо мне</Pill></div></section>
  <section className="reel-section page-padding"><button className="reel-preview" onClick={onReel} aria-label="Смотреть слайд-шоу"><Still name="grand_blue" background="#10141e"/><span className="reel-title">СМОТРЕТЬ<br />РАБОТЫ <span>↗</span></span><span className="reel-badge">▶</span></button><Crosshair text="ВООБРАЖЕНИЕ В ДВИЖЕНИИ"/></section>
  <section className="featured page-padding section-space"><div className="featured-heading"><h2 className="display-title reveal">Избранное</h2><p>Мои работы с&nbsp;объёмом, светом и&nbsp;движением — от персонажей до архитектуры.</p></div><ProjectGrid/><div className="all-projects"><Pill to="/projects/" dark>Все проекты <sup>{allProjects.length}</sup></Pill></div></section>
  <LazyAstronaut />
 </>;
}
function Projects() { return <section className="projects-page page-padding"><div className="projects-title"><h1>ПРОЕКТЫ</h1><div><span>{allProjects.length}</span><span>↘</span></div></div><ProjectGrid /></section>; }
function About() {
    return <>
  <section className="about-intro"><div className="about-sticky"><Still name="about" background="#090c10" gallery eager/><div className="about-grid-crosses" aria-hidden="true">+<span>+</span>+<span>+</span>+</div><h1 className="about-logo">LOMOV</h1><small className="about-scroll">ЛИСТАЙТЕ, ЧТОБЫ ИССЛЕДОВАТЬ</small><div className="about-words"><p>КРЕАТИВНЫЙ<br />РАЗРАБОТЧИК</p><p>ВЕБ, 3D<br />И ДВИЖЕНИЕ</p></div></div></section>
  <section className="about-description page-padding section-space"><small>ОБО МНЕ</small><h2 className="split-reveal">Я — Ломов, креативный разработчик. Работаю с&nbsp;3D, анимацией и&nbsp;интерактивом в&nbsp;браузере.<span>Мне интересно, как движение и&nbsp;реакция на&nbsp;жест меняют восприятие изображения.</span></h2></section>
  <section className="team page-padding">
    <div className="team-visual"><Still name="barbershop_batya" background="#10131d"/></div>
    <div className="team-info">
      <div className="team-topline"><span>КАК Я РАБОТАЮ</span></div>
      <h3>От образа к&nbsp;интерактиву</h3>
      <p>Начинаю с того, что должен почувствовать зритель. Затем собираю композицию, проверяю движение в браузере и оставляю те эффекты, которые помогают раскрыть идею.</p>
      <Pill to="/projects/">Смотреть проекты</Pill>
    </div>
  </section>
  <Tarot /><section className="expertise page-padding section-space"><h2 className="display-title reveal">Практика</h2><div className="expertise-intro"><p>ОТ ПЕРВОГО ЭСКИЗА<br />ДО РАБОТАЮЩЕГО САЙТА</p><span>s c t p</span></div><div className="expertise-cards">{expertise.map((e, i) => <article className={`expertise-card expertise-${i}`} key={e.title} tabIndex={0}><div><h3>{e.title}</h3><span>0{i + 1}</span></div><b>{e.letter}</b><ul>{e.items.map(item => <li key={item}>{item}</li>)}</ul><span className="expertise-bottom">{e.title}<span>↗</span></span></article>)}</div></section>
 </>;
}
function CaseStudy() {
    const { slug } = useParams();
    const container = useRef<HTMLElement>(null), track = useRef<HTMLDivElement>(null), progress = useRef<HTMLSpanElement>(null);
    const project = allProjects.find(p => p.slug === slug);
    useLayoutEffect(() => {
        if (!project || !container.current || !track.current)
            return;
        const media = gsap.matchMedia();
        media.add('(min-width: 701px)', () => {
            const distance = () => track.current!.scrollWidth - window.innerWidth;
            gsap.to(track.current, { x: () => -distance(), ease: 'none', scrollTrigger: { trigger: container.current, pin: true, start: 'top top', end: () => `+=${distance()}`, scrub: 1, invalidateOnRefresh: true, onUpdate: self => { if (progress.current)
                        progress.current.style.transform = `scaleX(${self.progress})`; } } });
        });
        return () => media.revert();
    }, [slug, project]);
    if (!project)
        return <NotFound />;
    const i = allProjects.indexOf(project), next = allProjects[(i + 1) % allProjects.length];
    return <article className="case-study"><section className="case-scroll" ref={container} aria-label="Горизонтальная история проекта"><div className="case-track" ref={track}>
  <section className="case-frame case-opening"><PortfolioImage work={project}/><TiltPermission/><div className="case-hero-title"><span>ПРОЕКТ {String(i + 1).padStart(2, '0')} / {allProjects.length}</span><h1>{project.title}</h1></div></section>
  <section className="case-frame case-meta"><small>О ПРОЕКТЕ / {String(i + 1).padStart(2, '0')}</small><h2>{project.title}</h2><div className="case-meta-grid"><div className="case-copy"><p>{project.description}</p></div><aside><div><h3>МОЯ РОЛЬ</h3>{project.services.map(s => <span key={s}>{s}</span>)}</div></aside></div></section>
  <LocalLink to={projectPath(next)} className="case-frame case-next"><Still name={next.slug} background={next.background}/><div><small>СЛЕДУЮЩИЙ ПРОЕКТ</small><h2>{next.title}</h2><span>↗</span></div></LocalLink>
 </div><div className="case-scrollbar"><span ref={progress}/></div><div className="case-direction"><span>ЛИСТАЙТЕ, ЧТОБЫ ИССЛЕДОВАТЬ</span><span>→</span></div></section></article>;
}
function Footer({ onContact }: {
    onContact: () => void;
}) {
    const { pathname } = useLocation();
    const next = pathname.startsWith('/about') ? '/projects/' : '/about/';
    return <>
  <section className="contact-scene" id="contact"><Still name="contact" background="#2026f6" gallery/><div className="contact-scene-copy"><small>ИНТЕРАКТИВ · 3D · ВЕБ</small><button onClick={onContact}>Обсудим<br />проект?<span>↗</span></button></div><div className="contact-scroll">ЛИСТАЙТЕ ДАЛЬШЕ <span>↓</span></div></section>
  <footer className="footer page-padding">
    <div className="portfolio-footer">
      <div><h2>Lomov</h2><p>Креативный разработчик</p></div>
      <a href={githubProfile} target="_blank" rel="noreferrer">GitHub ↗</a>
    </div>
    <div className="footer-bottom"><span>© Lomov</span><button className="footer-top" aria-label="Наверх" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑</button></div><LocalLink to={next} className="next-page"><span>ДАЛЬШЕ</span><h2>{next === '/about/' ? 'Обо мне' : 'Проекты'}</h2><span className="next-page-arrow">↗</span><small>СЛЕДУЮЩАЯ СТРАНИЦА</small><div className="next-page-crosses" aria-hidden="true"><span>+</span><span>+</span><span>+</span><span>+</span><span>+</span></div></LocalLink></footer>
 </>;
}
function NotFound() { return <section className="not-found page-padding"><span>404</span><h1>Страница не найдена.</h1><Pill to="/">Вернуться на главную</Pill></section>; }
export default function App() {
    const root = useRef<HTMLDivElement>(null);
    const curtain = useRef<HTMLDivElement>(null);
    const lock = useRef(false);
    const [contact, setContact] = useState(false), [reel, setReel] = useState(false);
    const location = useLocation(), navigate = useNavigate();
    const contactClose = useRef(() => setContact(false)).current;
    const reelClose = useRef(() => setReel(false)).current;
    const go = (path: string) => {
        if (lock.current)
            return;
        if (location.pathname.replace(/\/$/, '') === path.replace(/\/$/, '')) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        lock.current = true;
        setContact(false);
        setReel(false);
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        gsap.set(curtain.current, { transformOrigin: 'bottom' });
        gsap.to(curtain.current, { scaleY: 1, duration: reduced ? .01 : .5, ease: 'power3.inOut', onComplete: () => { navigate(path); window.scrollTo({top:0,left:0,behavior:'instant'}); requestAnimationFrame(() => { gsap.set(curtain.current, { transformOrigin: 'top' }); gsap.to(curtain.current, { scaleY: 0, duration: reduced ? .01 : .6, ease: 'power3.inOut', delay: .1, onComplete: () => { lock.current = false; } }); }); } });
    };
    useLayoutEffect(() => {
        window.scrollTo({top:0,left:0,behavior:'instant'});
        const project = allProjects.find(p => location.pathname.includes(p.slug));
        const theme = project?.background || '#f0f0fa';
        const rgb = theme.slice(1).match(/.{2}/g)!.map(value => parseInt(value, 16));
        const light = (rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722) > 145;
        document.documentElement.style.setProperty('--paper', theme);
        document.documentElement.style.setProperty('--ink', light ? '#08090b' : '#f5f5fa');
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme);
        const section = location.pathname.split('/')[1];
        const titles: Record<string, string> = { about: 'Обо мне', projects: 'Проекты', astronaut: 'Полёт астронавта', 'astronaut-review': 'Сцены полёта' };
        document.title = `Lomov — ${project?.title ?? (section ? titles[section] ?? 'Страница не найдена' : 'Креативный разработчик')}`;
        const timeout = setTimeout(() => ScrollTrigger.refresh(), 250);
        return () => clearTimeout(timeout);
    }, [location.pathname]);
    useEffect(() => {
        let distance = 0;
        const nextPage = (event: WheelEvent) => {
            if (contact || reel || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
                return;
            const atEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 5;
            distance = atEnd && event.deltaY > 0 ? distance + event.deltaY : 0;
            if (distance > 450) {
                const link = document.querySelector<HTMLAnchorElement>('.next-page');
                if (link) {
                    distance = 0;
                    go(link.getAttribute('href')!);
                }
            }
        };
        window.addEventListener('wheel', nextPage, { passive: true });
        return () => window.removeEventListener('wheel', nextPage);
    }, [location.pathname, contact, reel]);
    useLayoutEffect(() => {
        const ctx = gsap.context(() => {
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (reduced)
                return;
            gsap.utils.toArray<HTMLElement>('.reveal,.split-reveal').forEach(el => { gsap.fromTo(el, { y: 50, opacity: .15 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 92%', end: 'top 45%', scrub: 1 } }); });
            if (document.querySelector('.about-intro')) {
                const timeline = gsap.timeline({ scrollTrigger: { trigger: '.about-intro', start: 'top top', end: 'bottom bottom', scrub: 1 } });
                timeline.to('.about-logo', { yPercent: -110, opacity: 0, duration: 1 }).to('.about-scroll', { opacity: 0 }, 0).fromTo('.about-words', { opacity: 0, y: 120 }, { opacity: 1, y: 0, duration: 1 }, .55).to('.about-words', { y: -120, opacity: 0, duration: 1 }, 2.3);
            }
            if (document.querySelector('.tarot-section')) {
                gsap.fromTo('.tarot-card', { y: 200 }, { y: 0, stagger: .1, scrollTrigger: { trigger: '.tarot-section', start: 'top 90%', end: 'top 10%', scrub: 1 } });
            }
            if (document.querySelector('.imagination'))
                gsap.fromTo('.imagination-copy', { y: 100 }, { y: -100, scrollTrigger: { trigger: '.imagination', start: 'top bottom', end: 'bottom top', scrub: 1 } });
        }, root);
        return () => ctx.revert();
    }, [location.pathname]);
    return <TiltProvider><NavigationContext.Provider value={go}><div ref={root} className="app">{/^(?:\/|\/astronaut(?:-review)?\/?)$/.test(location.pathname) && <Suspense fallback={null}><Graphics source={root} home={location.pathname === '/'}/></Suspense>}<Header onContact={() => setContact(true)}/><main id="main" key={location.pathname}><Routes><Route path="/" element={<Home onReel={() => setReel(true)}/>}/><Route path="/astronaut-review" element={<Suspense fallback={<AstronautPlaceholder/>}><AstronautReview/></Suspense>}/><Route path="/astronaut" element={<Suspense fallback={<AstronautPlaceholder/>}><AstronautSequence standalone/></Suspense>}/><Route path="/about" element={<About />}/><Route path="/projects" element={<Projects />}/><Route path="/projects/:slug" element={<CaseStudy />}/><Route path="*" element={<NotFound />}/></Routes><Footer onContact={() => setContact(true)}/></main>{contact && <Contact onClose={contactClose}/>} {reel && <Reel onClose={reelClose}/>}<div className="page-curtain" ref={curtain} aria-hidden="true"><span>LOMOV</span></div><a href="#main" className="skip-link">Перейти к содержимому</a></div></NavigationContext.Provider></TiltProvider>;
}

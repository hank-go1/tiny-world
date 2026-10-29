'use client';

import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';
import { ArrowUpRight, CalendarDays, CloudLightning, CloudRain, Expand, Focus, House, MapPin, MessageCircle, Minus, Pause, Play, Plus, Sun, Trees, Users, X } from 'lucide-react';
import { WORLD, createResidents, directResident, places, residentActivity, residentProfile, snapResident, walkResidents, type Point, type Resident } from '@/lib/town/world';
import { clampCamera, createMap, drawWorld, hitPlace, type Camera, type Viewport } from '@/lib/town/render';
import { advanceTownTime, formatTownTime } from '@/lib/town/clock';
import { townDateKey } from '@/lib/town/calendar';
import { useTownCalendar } from '@/lib/town/use-calendar';
import TownCalendar from './calendar';
import TownChat, { type TownChatControls } from './chat';
import WeatherController from './weather';
import { weatherLabels, type TownWeather, type WeatherReaction } from '@/lib/town/weather';
import { rememberTownNews, type TownDecision } from '@/lib/town/decisions';
import styles from './town.module.css';

type Selection = { kind: 'resident' | 'place'; id: string } | null;
type Gesture = { start: Point; camera: Camera; resident?: Resident; moved: boolean };
const kindLabel = { home: 'A home on Maple Lane', cafe: 'Coffee & good company', bakery: 'Something fresh from the oven', grocer: 'Your neighborhood essentials', arcade: 'A little friendly competition', library: 'A quiet place to get lost', school: 'A place to grow', park: 'A breath of fresh air', camp: 'A night under the stars' };

export default function TownPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null), stageRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLCanvasElement | null>(null), residentsRef = useRef<Resident[]>([]);
  const cameraRef = useRef<Camera>({ x: WORLD.width / 2, y: WORLD.height / 2, zoom: .35 });
  const viewportRef = useRef<Viewport>({ width: 1, height: 1 });
  const gestureRef = useRef<Gesture | null>(null), pointersRef = useRef(new Map<number, Point>());
  const pinchRef = useRef<{ distance: number; zoom: number; anchor: Point } | null>(null);
  const [ready, setReady] = useState(false), [zoom, setZoom] = useState(.35), [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1), [weather, setWeather] = useState<TownWeather>('clear'), [selection, setSelection] = useState<Selection>(null);
  const [closed, setClosed] = useState<Set<string>>(new Set()), [roster, setRoster] = useState(false);
  const [following, setFollowing] = useState(false), [dragging, setDragging] = useState(false), [hovered, setHovered] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false), [canvasFailed, setCanvasFailed] = useState(false);
  const [townTime, setTownTime] = useState<number | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false), calendarStore = useTownCalendar();
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [news, setNews] = useState<string[]>([]);
  const chatButtonRef = useRef<HTMLButtonElement>(null), chatControllerRef = useRef<TownChatControls>(null);
  const [deciding, setDeciding] = useState(false), [weatherReaction, setWeatherReaction] = useState<WeatherReaction>({ status: 'idle' });
  const clockRef = useRef<{ timestamp: number; updatedAt: number; speed: number; paused: boolean } | null>(null);
  const liveRef = useRef({ paused, speed, weather, selection, closed, following, reducedMotion });
  useEffect(() => { liveRef.current = { paused, speed, weather, selection, closed, following, reducedMotion }; }, [paused, speed, weather, selection, closed, following, reducedMotion]);
  const hoverRef = useRef<string | null>(null);

  function fitZoom() {
    const v = viewportRef.current;
    return Math.min(v.width / WORLD.width, v.height / WORLD.height) * .96;
  }
  function toWorld(p: Point): Point {
    const c = cameraRef.current, v = viewportRef.current;
    return { x: c.x + (p.x - v.width / 2) / c.zoom, y: c.y + (p.y - v.height / 2) / c.zoom };
  }
  function localPoint(e: { clientX: number; clientY: number }): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function changeZoom(next: number, anchor?: Point) {
    const c = cameraRef.current, v = viewportRef.current, p = anchor ?? { x: v.width / 2, y: v.height / 2 }, world = toWorld(p);
    c.zoom = Math.max(fitZoom(), Math.min(2.5, next));
    c.x = world.x - (p.x - v.width / 2) / c.zoom; c.y = world.y - (p.y - v.height / 2) / c.zoom;
    clampCamera(c, v); setZoom(c.zoom);
  }
  function fitTown() {
    setFollowing(false); cameraRef.current = { x: WORLD.width / 2, y: WORLD.height / 2, zoom: fitZoom() }; setZoom(cameraRef.current.zoom);
  }
  function focusPoint(p: Point, amount = .9) {
    setFollowing(false);
    cameraRef.current = clampCamera({ x: p.x, y: p.y, zoom: Math.max(fitZoom(), amount) }, viewportRef.current);
    setZoom(cameraRef.current.zoom);
  }
  function selectPlace(id: string) {
    const p = places.find(p => p.id === id)!;
    setSelection({ kind: 'place', id }); setRoster(false); setChatOpen(false); focusPoint({ x: p.x, y: p.y + p.height / 2 }, .9);
  }
  function selectResident(id: string) {
    const p = residentsRef.current.find(p => p.id === id)!;
    setSelection({ kind: 'resident', id }); setRoster(false); focusPoint(p, 1.15);
  }
  function changeWeather(next: TownWeather) {
    if (next === weather || deciding) return;
    if (chatControllerRef.current?.reactToWeather(next, weather)) setWeather(next);
  }

  function applyDecisions(decisions: TownDecision[], announcement?: string) {
    if (decisions.some(d => d.choice.startsWith('go:') && closed.has(d.choice.slice(3)))) throw new Error('A destination closed while the decisions were being made. Please send the instruction again.');
    for (const decision of decisions) {
      const resident = residentsRef.current.find(p => p.id === decision.residentId)!;
      directResident(resident, decision.choice, residentsRef.current);
    }
    if (announcement) setNews(previous => rememberTownNews(previous, announcement));
  }

  useEffect(() => {
    const now = performance.now(), previous = clockRef.current;
    const timestamp = previous ? advanceTownTime(previous.timestamp, now - previous.updatedAt, previous.speed, previous.paused) : Date.now();
    const anchor = { timestamp, updatedAt: now, speed, paused }; clockRef.current = anchor;
    const update = () => {
      const current = clockRef.current!;
      setTownTime(Math.floor(advanceTownTime(current.timestamp, performance.now() - current.updatedAt, current.speed, current.paused) / 1000) * 1000);
    };
    update();
    const timer = window.setInterval(update, 250);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [paused, speed]);

  useEffect(() => {
    const canvas = canvasRef.current!, stage = stageRef.current!;
    const c = canvas.getContext('2d');
    if (!c) { setCanvasFailed(true); return; }
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(motion.matches); if (motion.matches) setPaused(true);
    const motionChange = () => { setReducedMotion(motion.matches); if (motion.matches) setPaused(true); };
    motion.addEventListener('change', motionChange);
    residentsRef.current = createResidents(); mapRef.current = createMap();
    let firstResize = true;
    const resize = () => {
      const rect = stage.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      const previousFit = Math.min(viewportRef.current.width / WORLD.width, viewportRef.current.height / WORLD.height) * .96;
      const wasFit = cameraRef.current.zoom <= previousFit + .005;
      viewportRef.current = { width: rect.width, height: rect.height };
      canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const minimum = Math.min(rect.width / WORLD.width, rect.height / WORLD.height) * .96;
      if (firstResize) {
        cameraRef.current.zoom = Math.max(rect.width / WORLD.width, rect.height / WORLD.height) * 1.04;
        firstResize = false;
      } else if (wasFit) cameraRef.current.zoom = minimum;
      cameraRef.current.zoom = Math.max(minimum, cameraRef.current.zoom);
      clampCamera(cameraRef.current, viewportRef.current); setZoom(cameraRef.current.zoom);
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(stage);
    const onWheel = (e: WheelEvent) => { e.preventDefault(); setFollowing(false); changeZoom(cameraRef.current.zoom * Math.exp(-e.deltaY * (e.deltaMode === 1 ? .035 : .002)), localPoint(e)); };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    let frame = 0, last = 0, time = 0, lastDraw = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000 || 0, .05); last = now;
      if (!document.hidden) {
        const live = liveRef.current;
        const moving = !live.paused && !live.reducedMotion;
        if (!live.paused) {
          time += dt * live.speed;
          if (moving) walkResidents(residentsRef.current.filter(p => p !== gestureRef.current?.resident), dt * live.speed);
        }
        if (live.following && live.selection?.kind === 'resident') {
          const p = residentsRef.current.find(p => p.id === live.selection?.id);
          if (p) { cameraRef.current.x = p.x; cameraRef.current.y = p.y; clampCamera(cameraRef.current, viewportRef.current); }
        }
        // Cap paint rate; the cached map is drawn once, not rebuilt each frame.
        if (now - lastDraw >= 1000 / 40) {
          drawWorld(c, mapRef.current!, cameraRef.current, viewportRef.current, residentsRef.current, time, live.selection?.id ?? null, hoverRef.current, live.closed, live.weather, moving);
          lastDraw = now;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); setReady(true);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); canvas.removeEventListener('wheel', onWheel); motion.removeEventListener('change', motionChange); mapRef.current = null; };
    // All event callbacks read mutable camera/viewport refs; React state uses liveRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    setCalendarOpen(false);
    e.currentTarget.focus({ preventScroll: true }); e.currentTarget.setPointerCapture(e.pointerId);
    const point = localPoint(e); pointersRef.current.set(e.pointerId, point); setFollowing(false);
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()], midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      pinchRef.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: cameraRef.current.zoom, anchor: toWorld(midpoint) };
      if (gestureRef.current?.resident) snapResident(gestureRef.current.resident, gestureRef.current.resident);
      gestureRef.current = null; setDragging(true); return;
    }
    const world = toWorld(point), radius = Math.max(19, 11 / cameraRef.current.zoom);
    const resident = [...residentsRef.current].reverse().find(p => Math.hypot(p.x - world.x, p.y - 10 - world.y) < radius);
    gestureRef.current = { start: point, camera: { ...cameraRef.current }, resident, moved: false };
    setDragging(true);
  }
  function pointerMove(e: PointerEvent<HTMLCanvasElement>) {
    const p = localPoint(e), g = gestureRef.current;
    if (pointersRef.current.has(e.pointerId)) pointersRef.current.set(e.pointerId, p);
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointersRef.current.values()], pinch = pinchRef.current, c = cameraRef.current, v = viewportRef.current;
      c.zoom = Math.max(fitZoom(), Math.min(2.5, pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / Math.max(1, pinch.distance)));
      c.x = pinch.anchor.x - ((a.x + b.x) / 2 - v.width / 2) / c.zoom; c.y = pinch.anchor.y - ((a.y + b.y) / 2 - v.height / 2) / c.zoom;
      clampCamera(c, v); setZoom(c.zoom); return;
    }
    if (g && pointersRef.current.has(e.pointerId)) {
      const dx = p.x - g.start.x, dy = p.y - g.start.y;
      if (Math.hypot(dx, dy) > 4) g.moved = true;
      if (g.moved && g.resident) {
        const world = toWorld(p); g.resident.x = world.x; g.resident.y = world.y; setSelection({ kind: 'resident', id: g.resident.id });
      } else if (g.moved) {
        cameraRef.current.x = g.camera.x - dx / g.camera.zoom; cameraRef.current.y = g.camera.y - dy / g.camera.zoom;
        clampCamera(cameraRef.current, viewportRef.current);
      }
      return;
    }
    const world = toWorld(p), resident = residentsRef.current.find(r => Math.hypot(r.x - world.x, r.y - 10 - world.y) < Math.max(19, 11 / cameraRef.current.zoom));
    const id = resident?.id ?? hitPlace(world)?.id ?? null;
    hoverRef.current = id; setHovered(id);
  }
  function pointerUp(e: PointerEvent<HTMLCanvasElement>, cancelled = false) {
    pointersRef.current.delete(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (pinchRef.current) {
      pinchRef.current = null;
      const remaining = [...pointersRef.current.values()][0];
      gestureRef.current = remaining ? { start: remaining, camera: { ...cameraRef.current }, moved: true } : null;
      setDragging(Boolean(remaining)); return;
    }
    const g = gestureRef.current;
    if (g?.resident && g.moved) snapResident(g.resident, g.resident);
    if (g && !g.moved && !cancelled) {
      const place = hitPlace(toWorld(localPoint(e)));
      setSelection(g.resident ? { kind: 'resident', id: g.resident.id } : place ? { kind: 'place', id: place.id } : null);
      setRoster(false);
    }
    gestureRef.current = null; setDragging(false);
  }
  function keyDown(e: KeyboardEvent<HTMLCanvasElement>) {
    const c = cameraRef.current, step = 120 / c.zoom;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', '+', '=', '-', '0', 'Escape', 'Home'].includes(e.key)) e.preventDefault();
    if (e.key.startsWith('Arrow')) setFollowing(false);
    if (e.key === 'ArrowUp') c.y -= step;
    if (e.key === 'ArrowDown') c.y += step;
    if (e.key === 'ArrowLeft') c.x -= step;
    if (e.key === 'ArrowRight') c.x += step;
    if (e.key === '+' || e.key === '=') changeZoom(c.zoom * 1.25);
    if (e.key === '-') changeZoom(c.zoom / 1.25);
    if (e.key === '0' || e.key === 'Home') fitTown();
    if (e.key === ' ') setPaused(p => !p);
    if (e.key === 'Escape') { setSelection(null); setRoster(false); setFollowing(false); setCalendarOpen(false); setChatOpen(false); }
    clampCamera(c, viewportRef.current);
  }

  const person = selection?.kind === 'resident' ? residentsRef.current.find(p => p.id === selection.id) : null;
  const place = selection?.kind === 'place' ? places.find(p => p.id === selection.id) : null;
  const hoverName = hovered?.startsWith('resident') ? residentsRef.current.find(p => p.id === hovered)?.name : places.find(p => p.id === hovered)?.name;
  const calendar = townTime === null ? null : formatTownTime(townTime);
  const today = townTime === null ? null : townDateKey(townTime);
  const hasOccasionToday = calendarStore.events.some(event => event.date === today);

  return <main className={styles.shell}>
    <header className={styles.header}>
      <div className={styles.identity}><span className={styles.brandIcon}><House size={22} strokeWidth={2.2} /></span><h1>TINY BLOCK</h1><span className={styles.separator} /><button className={styles.population} onClick={() => { setRoster(!roster); setCalendarOpen(false); setChatOpen(false); }} aria-label="Meet the 24 neighbors" aria-expanded={roster}><Users size={17} /><span>24 neighbors</span></button></div>
      <div className={styles.headerControls}><button ref={chatButtonRef} className={chatOpen ? styles.activeTool : ''} aria-label="Open town chat" aria-expanded={chatOpen} aria-controls="town-chat" title="Talk to the town" onClick={() => { setChatOpen(!chatOpen); setCalendarOpen(false); setRoster(false); setSelection(null); setFollowing(false); }}><MessageCircle size={19} /></button><span className={styles.weatherStatus}>{weather === 'storm' ? <CloudLightning size={17} /> : weather === 'rain' ? <CloudRain size={17} /> : <Sun size={18} />}<span>{weatherLabels[weather]}</span></span><button ref={calendarButtonRef} className={styles.clockTrigger} disabled={!calendar} aria-label="Open town calendar" aria-expanded={calendarOpen} aria-haspopup="dialog" aria-controls="town-calendar" onClick={() => { setCalendarOpen(!calendarOpen); setChatOpen(false); setSelection(null); setRoster(false); setFollowing(false); }}><span className={styles.calendarGlyph} aria-hidden="true"><CalendarDays size={16} />{hasOccasionToday && <i />}</span><time className={styles.clock} dateTime={calendar?.iso} aria-label="Town time" title={paused ? 'Town time is paused · GMT+7' : `${speed}× town time · GMT+7`}><strong>{calendar?.time ?? '--:--:--'}</strong><span>{calendar?.date ?? 'Town calendar'}</span></time></button><span className={styles.separator} /><button aria-label={paused ? 'Resume town' : 'Pause town'} title={paused ? 'Resume' : 'Pause'} onClick={() => setPaused(!paused)}>{paused ? <Play size={19} fill="currentColor" /> : <Pause size={19} fill="currentColor" />}</button><button className={styles.speed} title="Change town speed" aria-label={`Town speed ${speed} times. Click to change.`} onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 4 : 1)}>{speed}×</button><button className={styles.fullscreen} aria-label="Toggle fullscreen" title="Fullscreen" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void document.documentElement.requestFullscreen().catch(() => {}); }}><Expand size={19} /></button></div>
    </header>

    <div ref={stageRef} className={`${styles.stage} ${dragging ? styles.dragging : ''}`}>
      <canvas ref={canvasRef} className={styles.world} role="application" aria-label="Interactive town map. Drag to pan, scroll or pinch to zoom. Use arrow keys to move, plus and minus to zoom, zero to fit the town, and space to pause. Select residents from the neighbors menu or click buildings on the map." tabIndex={0} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={e => pointerUp(e)} onPointerCancel={e => pointerUp(e, true)} onPointerLeave={() => { hoverRef.current = null; setHovered(null); }} onKeyDown={keyDown} onDoubleClick={e => changeZoom(cameraRef.current.zoom * 1.6, localPoint(e))} style={{ cursor: dragging ? 'grabbing' : hovered ? 'pointer' : 'grab' }} />
      {!ready && <div className={styles.loading}>{canvasFailed ? 'This browser could not open the town map. Try a browser with Canvas support.' : 'Getting the town ready…'}</div>}

      <div className={styles.townStamp}><span className={styles.liveDot} /><div><strong>Maplebrook</strong><span>30 places. A little room to wander.</span></div></div>

      {hoverName && !dragging && <div className={styles.hoverName} aria-hidden="true"><MapPin size={13} />{hoverName}</div>}

      {!calendarOpen && !chatOpen && roster && <section className={styles.roster} aria-label="Neighbors"><div className={styles.panelHeading}><div><span className={styles.kicker}>THE LOCALS</span><h2>Meet the neighbors</h2></div><button onClick={() => setRoster(false)} aria-label="Close neighbors"><X size={18} /></button></div><p>A few familiar faces around town.</p><div className={styles.residentGrid}>{residentsRef.current.map(p => <button key={p.id} onClick={() => selectResident(p.id)}><span className={styles.avatarDot} style={{ background: p.color }} />{p.name}<ArrowUpRight size={14} /></button>)}</div></section>}

      {!calendarOpen && !chatOpen && (person || place) && <section className={styles.inspector} aria-label={person ? `${person.name} details` : `${place!.name} details`}>
        <button className={styles.closePanel} onClick={() => { setSelection(null); setFollowing(false); }} aria-label="Close details"><X size={17} /></button>
        {person ? <><div className={styles.personHeading}><span className={styles.portrait} style={{ '--shirt': person.color, '--skin': person.skin, '--hair': person.hair } as React.CSSProperties}><i /><b /></span><div><span className={styles.kicker}>YOUR NEIGHBOR</span><h2>{person.name}</h2><span className={styles.subtitle}>{residentActivity(person)}</span></div></div><p>{residentProfile(person).description} Lives at {places.find(p => p.id === person.home)?.name}. Drag {person.name} to a path to give them a new starting point.</p><div className={styles.panelActions}><button className={styles.primaryAction} onClick={() => { focusPoint(person, 1.3); setFollowing(!following); }}><Focus size={15} />{following ? 'Stop following' : 'Follow along'}</button><button onClick={() => selectPlace(person.home)}><House size={15} />Find home</button></div><span className={styles.previewNote}>Give a new instruction in town chat</span></> : <><span className={styles.placeIcon} style={{ background: `${place!.color}35`, color: place!.color }}>{place!.kind === 'home' ? <House size={27} /> : ['park', 'camp'].includes(place!.kind) ? <Trees size={27} /> : <MapPin size={27} />}</span><span className={styles.kicker}>{kindLabel[place!.kind]}</span><h2>{place!.name}</h2><p>{place!.description}</p><div className={styles.panelActions}><button className={styles.primaryAction} onClick={() => focusPoint({ x: place!.x, y: place!.y + place!.height / 2 }, 1.35)}><Plus size={15} />Take a closer look</button>{place!.kind !== 'home' && <button aria-pressed={closed.has(place!.id)} onClick={() => setClosed(previous => { const next = new Set(previous); if (next.has(place!.id)) next.delete(place!.id); else next.add(place!.id); return next; })}>{closed.has(place!.id) ? 'Reopen' : 'Close place'}</button>}</div></>}
      </section>}

      <TownChat controllerRef={chatControllerRef} onBusyChange={setDeciding} onWeatherReaction={setWeatherReaction} open={chatOpen} paused={paused} news={news} onClearNews={() => setNews([])} readTown={() => ({
        townTime: clockRef.current ? advanceTownTime(clockRef.current.timestamp, performance.now() - clockRef.current.updatedAt, clockRef.current.speed, clockRef.current.paused) : Date.now(),
        weather, news, closed: [...closed], residents: residentsRef.current.map(p => ({ id: p.id, x: p.x, y: p.y, activity: residentActivity(p), atPlace: p.plan?.arrived ? p.plan.placeId ?? null : null })),
      })} onDecisions={applyDecisions} onResident={id => { selectResident(id); setChatOpen(false); setFollowing(true); }} onClose={() => { setChatOpen(false); chatButtonRef.current?.focus(); }} />

      {calendarOpen && today && <TownCalendar today={today} store={calendarStore} onClose={() => { setCalendarOpen(false); calendarButtonRef.current?.focus(); }} />}

      <div className={styles.bottomBar}>
        <div className={styles.tools}><WeatherController weather={weather} busy={deciding} paused={paused} reaction={weatherReaction} onChange={changeWeather} onRetry={() => { if (!deciding) chatControllerRef.current?.reactToWeather(weather, weather); }} onShowReactions={() => { setChatOpen(true); setCalendarOpen(false); setRoster(false); setSelection(null); setFollowing(false); }} /></div>
        <div className={styles.zoomControls}><button aria-label="Zoom out" disabled={zoom <= fitZoom() + .001} onClick={() => changeZoom(cameraRef.current.zoom / 1.3)}><Minus size={19} /></button><button className={styles.zoomValue} onClick={fitTown} title="Fit whole town" aria-label={`Zoom ${Math.round(zoom * 100)} percent. Click to fit town.`}>{Math.round(zoom * 100)}<span>%</span></button><button aria-label="Zoom in" disabled={zoom >= 2.49} onClick={() => changeZoom(cameraRef.current.zoom * 1.3)}><Plus size={19} /></button><span className={styles.toolDivider} /><button aria-label="Fit town" title="Fit town (0)" onClick={fitTown}><Focus size={18} /></button></div>
      </div>
      <div className={styles.mapHint}><span>Drag to wander</span><i />Scroll to look closer<i /><span>Click to say hello</span></div>
    </div>
  </main>;
}

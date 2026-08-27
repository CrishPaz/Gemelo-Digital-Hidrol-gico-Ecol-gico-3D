/**
 * DigitalTwin3D - Visor geoespacial del Gemelo Digital de la Cuenca del Río Moche.
 *
 * El relieve NO es sintético: se reconstruye a partir del Modelo Digital de Elevación
 * real (SRTM / Copernicus GLO-30, vía AWS Terrain Tiles), la red de drenaje procede de
 * OpenStreetMap y las estaciones IoT se sitúan en sus coordenadas geográficas reales,
 * colgadas del terreno mediante muestreo bilineal del DEM.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Layers,
  Mountain,
  Droplets,
  Activity,
  ShieldAlert,
  Sparkles,
  Waves,
  Sun,
  Sunset,
  Moon,
  Loader2,
  AlertTriangle,
  Satellite,
  MapPin,
  Move3D,
  Database,
} from 'lucide-react';
import { MonitoringStation } from '../types';
import { BasinProjection } from '../services/geoProjection';
import {
  buildTerrainGeometry,
  computeSlopeMap,
  computeRiverDistance,
  computeLayerColors,
  buildRiverLines,
  buildRiverTubes,
  buildTerrainSkirt,
  planMeshSampling,
  TerrainLayer,
  LayerLegend,
} from '../services/terrainFactory';
import type { BasinGeodata } from '../hooks/useBasinGeodata';
import { useI18n } from '../providers/I18nProvider';

interface DigitalTwin3DProps {
  stations: MonitoringStation[];
  selectedStation: MonitoringStation | null;
  onSelectStation: (st: MonitoringStation) => void;
  activeLayer: TerrainLayer;
  onLayerChange: (layer: TerrainLayer) => void;
  geodata: BasinGeodata;
}

type LightingMode = 'day' | 'sunset' | 'night';
type CameraPreset = 'overview' | 'high' | 'mid' | 'low' | 'profile';

const LAYER_BUTTONS: Array<{ id: TerrainLayer; icon: typeof Mountain }> = [
  { id: 'elevation', icon: Mountain },
  { id: 'wqi', icon: Activity },
  { id: 'ndwi', icon: Satellite },
  { id: 'discharge', icon: Waves },
  { id: 'flood', icon: Droplets },
  { id: 'heavy_metals', icon: ShieldAlert },
];

const LIGHTING_BUTTONS: Array<{ id: LightingMode; icon: typeof Sun }> = [
  { id: 'day', icon: Sun },
  { id: 'sunset', icon: Sunset },
  { id: 'night', icon: Moon },
];

const EXAGGERATIONS = [1.5, 2.6, 4.0];

/** Ajustes atmosféricos por modo de iluminación. */
const LIGHTING_PRESETS: Record<
  LightingMode,
  {
    sun: THREE.Vector3;
    sunColor: number;
    sunIntensity: number;
    skyTop: THREE.Color;
    skyBottom: THREE.Color;
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    fogDensity: number;
    exposure: number;
  }
> = {
  day: {
    sun: new THREE.Vector3(-60, 78, 42),
    sunColor: 0xfff4e0,
    sunIntensity: 2.5,
    skyTop: new THREE.Color(0x2a5f9e),
    skyBottom: new THREE.Color(0xa9c8e8),
    hemiSky: 0x9fc4ee,
    hemiGround: 0x4a4034,
    hemiIntensity: 0.9,
    fogDensity: 0.0026,
    exposure: 1.05,
  },
  sunset: {
    sun: new THREE.Vector3(-96, 20, -18),
    sunColor: 0xffa457,
    sunIntensity: 2.9,
    skyTop: new THREE.Color(0x1d2b52),
    skyBottom: new THREE.Color(0xd97a45),
    hemiSky: 0xd08a5a,
    hemiGround: 0x2e2418,
    hemiIntensity: 0.65,
    fogDensity: 0.0038,
    exposure: 1.0,
  },
  night: {
    sun: new THREE.Vector3(52, 62, -46),
    sunColor: 0x9dbbe8,
    sunIntensity: 0.55,
    skyTop: new THREE.Color(0x04070f),
    skyBottom: new THREE.Color(0x111f38),
    hemiSky: 0x2b3f63,
    hemiGround: 0x080a10,
    hemiIntensity: 0.35,
    fogDensity: 0.0044,
    exposure: 1.25,
  },
};

/**
 * Rótulo de un hito ya resuelto en coordenadas de pantalla.
 *
 * Los nombres NO se dibujan como sprites dentro de la escena: un sprite escala con la
 * distancia (ilegible al alejarse, gigante al acercarse) y no sabe nada de los demás,
 * así que en la costa —donde Trujillo, Moche, Salaverry y Alto Salaverry están a pocos
 * kilómetros— los rótulos se apilaban unos sobre otros. Se proyectan a 2D y se pintan
 * en una capa HTML: tamaño constante, texto nítido y antisolapamiento por prioridad.
 */
interface Landmark {
  id: string;
  name: string;
  kind: 'city' | 'town' | 'village';
  population: number | null;
  elevation: number;
  world: THREE.Vector3;
}

const STATUS_COLORS: Record<string, number> = {
  active: 0x22c55e,
  warning: 0xf59e0b,
  offline: 0xef4444,
};

export const DigitalTwin3D: React.FC<DigitalTwin3DProps> = ({
  stations,
  selectedStation,
  onSelectStation,
  activeLayer,
  onLayerChange,
  geodata,
}) => {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Refs de la escena (persisten entre renders sin provocar re-render) ---
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const terrainRef = useRef<THREE.Mesh | null>(null);
  const stationGroupRef = useRef<THREE.Group | null>(null);
  const stationMapRef = useRef<Map<THREE.Object3D, MonitoringStation>>(new Map());
  const sunRef = useRef<THREE.DirectionalLight | null>(null);
  const hemiRef = useRef<THREE.HemisphereLight | null>(null);
  const skyRef = useRef<THREE.Mesh | null>(null);
  const riverGroupRef = useRef<THREE.Group | null>(null);
  const oceanRef = useRef<THREE.Mesh | null>(null);
  const skirtRef = useRef<THREE.Mesh | null>(null);
  const pmremRef = useRef<THREE.PMREMGenerator | null>(null);
  const envSceneRef = useRef<THREE.Scene | null>(null);
  const envRTRef = useRef<THREE.WebGLRenderTarget | null>(null);
  const rebuildEnvRef = useRef<(() => void) | null>(null);

  // Estado de la órbita de cámara (mutable, fuera de React para no re-renderizar)
  const orbitRef = useRef({
    theta: -0.62,
    phi: 0.92,
    radius: 132,
    target: new THREE.Vector3(0, 4, 0),
    // valores objetivo para interpolación suave
    tTheta: -0.62,
    tPhi: 0.92,
    tRadius: 132,
    tTarget: new THREE.Vector3(0, 4, 0),
    dragging: false,
    panning: false,
    lastX: 0,
    lastY: 0,
  });

  const [lightingMode, setLightingMode] = useState<LightingMode>('day');
  const [exaggeration, setExaggeration] = useState<number>(2.6);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('overview');
  const [hovered, setHovered] = useState<{ station: MonitoringStation; x: number; y: number } | null>(null);
  const [legend, setLegend] = useState<LayerLegend | null>(null);
  const [showLabels, setShowLabels] = useState(true);
  const [stats, setStats] = useState<{ verts: number; rivers: number; places: number } | null>(null);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);

  // Nodos DOM de los rótulos. Se posicionan escribiendo `transform` directamente en el
  // bucle de render: pasar por estado de React 60 veces por segundo sería inasumible.
  const labelNodesRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const landmarksRef = useRef<Landmark[]>([]);
  const projectionRef = useRef<BasinProjection | null>(null);
  const showLabelsRef = useRef(true);

  const { dem, hydrography, demPhase, error } = geodata;

  // El bucle de render lee estos refs; no puede depender del closure de React.
  landmarksRef.current = landmarks;
  showLabelsRef.current = showLabels;

  // Proyección geográfica ↔ escena. Se rehace solo si cambia el DEM o la exageración.
  const projection = useMemo(
    () => (dem ? new BasinProjection(dem, exaggeration) : null),
    [dem, exaggeration]
  );

  // El bucle de render necesita la proyección, pero se monta una sola vez y no puede
  // cerrar sobre el memo: se expone por ref.
  projectionRef.current = projection;

  // Plan de mallado: decima la malla visible manteniendo el DEM íntegro para muestreo.
  const sampling = useMemo(
    () => (dem ? planMeshSampling(dem.width, dem.height) : null),
    [dem]
  );

  // Mapas derivados del DEM: pendiente y distancia al cauce. Son caros, se memorizan.
  const slopeMap = useMemo(() => (projection ? computeSlopeMap(projection) : null), [projection]);
  const riverDistance = useMemo(() => {
    if (!projection || !hydrography) return null;
    return computeRiverDistance(projection, hydrography.rivers);
  }, [projection, hydrography]);

  // ---------------------------------------------------------------------------
  // 1. Montaje de la escena (una sola vez)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // near/far: el plano CERCANO es lo que domina la precisión del z-buffer. Con near=0.5
    // la resolución a distancia de órbita era ~0.002 unidades, y la costa se separa del mar
    // por milésimas (1 m de cota = 0.0028 u) => z-fighting garantizado en la orilla.
    // Subir near a 2 cuadruplica la precisión; el radio mínimo de órbita es 14, así que
    // no recorta nada visible.
    const camera = new THREE.PerspectiveCamera(
      42,
      Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
      2,
      1400
    );
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft está deprecado en r185
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- Cúpula de cielo con degradado (shader propio, sin texturas externas) ---
    const skyGeo = new THREE.SphereGeometry(800, 32, 20); // debe caber en far=1400
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x2a5f9e) },
        bottomColor: { value: new THREE.Color(0xa9c8e8) },
        offset: { value: 120 },
        exponent: { value: 0.75 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
          float t = pow(max(h, 0.0), exponent);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(sky);
    skyRef.current = sky;

    // ---- Mapa de entorno derivado del propio cielo ----
    // Sin esto, cualquier material con metalness (el agua) no tiene nada que reflejar:
    // en PBR el metal carece de componente difusa, así que el mar salía NEGRO, sobre
    // todo de noche. Generamos un entorno irradiado a partir de la misma cúpula —
    // comparte material, luego comparte uniforms— y lo regeneramos al cambiar la luz.
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmremRef.current = pmrem;

    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 24, 16), skyMat));
    envSceneRef.current = envScene;

    const rebuildEnvironment = () => {
      const gen = pmremRef.current;
      const es = envSceneRef.current;
      const sc = sceneRef.current;
      if (!gen || !es || !sc) return;
      envRTRef.current?.dispose();
      const rt = gen.fromScene(es);
      envRTRef.current = rt;
      sc.environment = rt.texture;
    };
    rebuildEnvRef.current = rebuildEnvironment;
    rebuildEnvironment();

    // --- Iluminación ---
    const hemi = new THREE.HemisphereLight(0x9fc4ee, 0x4a4034, 0.9);
    scene.add(hemi);
    hemiRef.current = hemi;

    const sun = new THREE.DirectionalLight(0xfff4e0, 2.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 400;
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.035;
    scene.add(sun);
    scene.add(sun.target);
    sunRef.current = sun;

    // --- Grupos que se rellenan cuando llegan los datos ---
    const riverGroup = new THREE.Group();
    scene.add(riverGroup);
    riverGroupRef.current = riverGroup;

    const stationGroup = new THREE.Group();
    scene.add(stationGroup);
    stationGroupRef.current = stationGroup;

    // ------------------------------------------------------------------
    // Controles de órbita (arrastre = rotar, botón derecho = desplazar, rueda = zoom)
    // ------------------------------------------------------------------
    const orbit = orbitRef.current;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) orbit.dragging = true;
      else if (e.button === 2) orbit.panning = true;
      orbit.lastX = e.clientX;
      orbit.lastY = e.clientY;
      container.setPointerCapture(e.pointerId);
    };

    const onPointerUp = (e: PointerEvent) => {
      orbit.dragging = false;
      orbit.panning = false;
      try { container.releasePointerCapture(e.pointerId); } catch { /* ignorado */ }
    };

    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - orbit.lastX;
      const dy = e.clientY - orbit.lastY;
      orbit.lastX = e.clientX;
      orbit.lastY = e.clientY;

      if (orbit.dragging) {
        orbit.tTheta -= dx * 0.005;
        orbit.tPhi = Math.min(1.52, Math.max(0.12, orbit.tPhi - dy * 0.004));
      } else if (orbit.panning) {
        const cam = cameraRef.current;
        if (cam) {
          const right = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0);
          const forward = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), right);
          const k = orbit.tRadius * 0.0016;
          orbit.tTarget.addScaledVector(right, -dx * k);
          orbit.tTarget.addScaledVector(forward, dy * k);

          // Con near=2 el paneo sin límite permitía meter la cámara dentro de una ladera y
          // ver geometría recortada. Se acota el objetivo a la extensión de la cuenca.
          const proj = projectionRef.current;
          if (proj) {
            const halfX = proj.sceneWidth * 0.75;
            const halfZ = proj.sceneDepth * 0.75;
            orbit.tTarget.x = Math.min(halfX, Math.max(-halfX, orbit.tTarget.x));
            orbit.tTarget.z = Math.min(halfZ, Math.max(-halfZ, orbit.tTarget.z));
          }
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbit.tRadius = Math.min(340, Math.max(14, orbit.tRadius * (1 + Math.sign(e.deltaY) * 0.09)));
    };

    const onContextMenu = (e: Event) => e.preventDefault();

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('contextmenu', onContextMenu);

    // ------------------------------------------------------------------
    // Selección / hover de estaciones por raycasting
    // ------------------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let movedSinceDown = 0;

    const pickStation = (e: MouseEvent): MonitoringStation | null => {
      const cam = cameraRef.current;
      const group = stationGroupRef.current;
      if (!cam || !group) return null;
      const rect = container.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, cam);
      const hits = raycaster.intersectObjects(group.children, true);
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          const st = stationMapRef.current.get(obj);
          if (st) return st;
          obj = obj.parent;
        }
      }
      return null;
    };

    const onMouseMoveHover = (e: MouseEvent) => {
      movedSinceDown += Math.abs(e.movementX) + Math.abs(e.movementY);
      if (orbit.dragging || orbit.panning) { setHovered(null); return; }
      const st = pickStation(e);
      const rect = container.getBoundingClientRect();
      setHovered(st ? { station: st, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
      container.style.cursor = st ? 'pointer' : 'grab';
    };

    const onMouseDownReset = () => { movedSinceDown = 0; };
    const onClickSelect = (e: MouseEvent) => {
      if (movedSinceDown > 6) return; // fue un arrastre, no un clic
      const st = pickStation(e);
      if (st) onSelectStation(st);
    };

    container.addEventListener('mousemove', onMouseMoveHover);
    container.addEventListener('mousedown', onMouseDownReset);
    container.addEventListener('click', onClickSelect);

    // ------------------------------------------------------------------
    // Colocación de rótulos: proyección, oclusión por relieve y antisolapamiento
    // ------------------------------------------------------------------
    const projected = new THREE.Vector3();
    const rayPoint = new THREE.Vector3();

    /**
     * ¿El relieve tapa este hito desde la cámara?
     *
     * En vez de lanzar rayos contra la malla (67 000 triángulos por rótulo y frame,
     * inviable), se recorre el segmento cámara→hito muestreando el DEM. Es el mismo
     * dato con el que se construyó el terreno, así que la prueba es fiel y cuesta
     * ~20 lecturas bilineales por rótulo.
     */
    const isOccludedByTerrain = (target: THREE.Vector3, camPos: THREE.Vector3): boolean => {
      const proj = projectionRef.current;
      if (!proj) return false;
      const STEPS = 18;
      for (let i = 2; i < STEPS; i++) {
        const t = i / STEPS;
        rayPoint.lerpVectors(target, camPos, t);
        const lon = proj.xToLon(rayPoint.x);
        const lat = proj.zToLat(rayPoint.z);
        if (!proj.contains(lon, lat)) continue;
        const terrainY = proj.elevationToY(proj.sampleElevation(lon, lat));
        // Margen para no ocultar por microrrelieve justo delante del punto
        if (terrainY > rayPoint.y + 0.12) return true;
      }
      return false;
    };

    const placedBoxes: Array<{ x: number; y: number; w: number; h: number }> = [];

    const placeLandmarkLabels = (cam: THREE.PerspectiveCamera, host: HTMLDivElement) => {
      const nodes = labelNodesRef.current;
      if (nodes.size === 0) return;

      const W = host.clientWidth;
      const H = host.clientHeight;
      placedBoxes.length = 0;

      // Las zonas que ocupan los paneles flotantes se marcan como ya ocupadas: así el
      // antisolapamiento las esquiva igual que a otro rótulo, en vez de dejar nombres
      // medio escondidos bajo la barra de capas o la leyenda.
      placedBoxes.push({ x: 0, y: 0, w: W, h: 56 });                    // barra de capas
      placedBoxes.push({ x: 0, y: H - 210, w: 300, h: 210 });           // leyenda
      placedBoxes.push({ x: W - 265, y: H - 190, w: 265, h: 190 });     // procedencia

      // Mayor población primero: si dos rótulos compiten, gana el hito más relevante.
      const ordered = [...landmarksRef.current].sort(
        (a, b) => (b.population ?? 0) - (a.population ?? 0)
      );

      for (const mark of ordered) {
        const el = nodes.get(mark.id);
        if (!el) continue;

        if (!showLabelsRef.current) {
          el.style.opacity = '0';
          el.style.visibility = 'hidden';
          continue;
        }

        projected.copy(mark.world).project(cam);

        // z > 1 significa que el punto quedó detrás de la cámara
        const behind = projected.z > 1;
        const sx = (projected.x * 0.5 + 0.5) * W;
        const sy = (-projected.y * 0.5 + 0.5) * H;

        const w = el.offsetWidth || 90;
        const h = el.offsetHeight || 22;
        const boxX = sx - w / 2;
        const boxY = sy - h - 14; // el rótulo va encima del punto, con hueco para la guía

        const outside = sx < -40 || sx > W + 40 || sy < -20 || sy > H + 40;
        let hide = behind || outside;

        if (!hide) hide = isOccludedByTerrain(mark.world, cam.position);

        const PAD = 3;
        const collides = (bx: number, by: number) => {
          for (const b of placedBoxes) {
            if (
              bx < b.x + b.w + PAD &&
              bx + w + PAD > b.x &&
              by < b.y + b.h + PAD &&
              by + h + PAD > b.y
            ) {
              return true;
            }
          }
          return false;
        };

        // Posición preferida encima del punto; si choca, se intenta debajo antes de
        // renunciar. Recolocar salva bastantes rótulos en la costa, donde los pueblos
        // están a pocos kilómetros unos de otros.
        let finalY = boxY;
        if (!hide && collides(boxX, finalY)) {
          const below = sy + 16;
          if (!collides(boxX, below)) finalY = below;
          else hide = true;
        }

        if (hide) {
          el.style.opacity = '0';
          el.style.visibility = 'hidden';
          continue;
        }

        placedBoxes.push({ x: boxX, y: finalY, w, h });
        el.style.visibility = 'visible';
        el.style.opacity = '1';
        el.style.transform = `translate3d(${Math.round(boxX)}px, ${Math.round(finalY)}px, 0)`;
      }
    };

    // ------------------------------------------------------------------
    // Bucle de render
    // ------------------------------------------------------------------
    let frameId = 0;
    // Reloj propio: THREE.Clock está deprecado en r185 y THREE.Timer vive en addons,
    // así que evitamos ambos con performance.now(), que es lo único que necesitamos.
    const startedAt = performance.now();
    let lastFrameAt = startedAt;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastFrameAt) / 1000);
      lastFrameAt = now;
      const t = (now - startedAt) / 1000;

      // Interpolación suave de la órbita (damping)
      const k = 1 - Math.pow(0.0016, dt);
      orbit.theta += (orbit.tTheta - orbit.theta) * k;
      orbit.phi += (orbit.tPhi - orbit.phi) * k;
      orbit.radius += (orbit.tRadius - orbit.radius) * k;
      orbit.target.lerp(orbit.tTarget, k);

      const cam = cameraRef.current;
      if (cam) {
        const sinPhi = Math.sin(orbit.phi);
        cam.position.set(
          orbit.target.x + orbit.radius * sinPhi * Math.sin(orbit.theta),
          orbit.target.y + orbit.radius * Math.cos(orbit.phi),
          orbit.target.z + orbit.radius * sinPhi * Math.cos(orbit.theta)
        );
        cam.lookAt(orbit.target);
      }

      // El océano ya no se anima: oscilar su opacidad cada frame era en sí mismo un titileo,
      // y exigía mantenerlo transparente (con el desorden de render que eso implicaba).
      // Leve titileo en las quebradas para sugerir escorrentía, sin tocar los tubos
      const rg = riverGroupRef.current;
      if (rg) {
        rg.children.forEach(child => {
          if (!(child as THREE.LineSegments).isLineSegments) return;
          const mat = (child as THREE.LineSegments).material as THREE.LineBasicMaterial;
          if (mat?.transparent) mat.opacity = 0.6 + Math.sin(t * 1.5) * 0.14;
        });
      }

      // Balizas de estaciones: pulso vertical y giro del anillo
      const sg = stationGroupRef.current;
      if (sg) {
        sg.children.forEach((marker, i) => {
          const ring = marker.getObjectByName('ring');
          if (ring) {
            ring.rotation.z += dt * 0.8;
            const s = 1 + Math.sin(t * 2.2 + i * 0.7) * 0.18;
            ring.scale.setScalar(s);
          }
          const beacon = marker.getObjectByName('beacon');
          if (beacon) {
            (beacon as THREE.Mesh).position.y = 3.4 + Math.sin(t * 2 + i) * 0.24;
          }
        });
      }

      // ----------------------------------------------------------------
      // Colocación de los rótulos de hitos en pantalla
      // ----------------------------------------------------------------
      if (cam) placeLandmarkLabels(cam, container);

      const r = rendererRef.current;
      const sc = sceneRef.current;
      if (r && sc && cam) r.render(sc, cam);
    };
    animate();

    // ------------------------------------------------------------------
    // Redimensionado
    // ------------------------------------------------------------------
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;
      const cam = cameraRef.current;
      const r = rendererRef.current;
      if (!cam || !r) return;
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
      r.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('contextmenu', onContextMenu);
      container.removeEventListener('mousemove', onMouseMoveHover);
      container.removeEventListener('mousedown', onMouseDownReset);
      container.removeEventListener('click', onClickSelect);

      scene.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else mat?.dispose();
      });
      envRTRef.current?.dispose();
      pmremRef.current?.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
    // El montaje debe ocurrir una sola vez; los datos entran por efectos separados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // 2. Construcción del terreno cuando llega (o cambia) el DEM
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !projection || !sampling) return;

    // Retirar terreno y océano previos
    if (terrainRef.current) {
      scene.remove(terrainRef.current);
      terrainRef.current.geometry.dispose();
      (terrainRef.current.material as THREE.Material).dispose();
      terrainRef.current = null;
    }
    if (oceanRef.current) {
      scene.remove(oceanRef.current);
      oceanRef.current.geometry.dispose();
      (oceanRef.current.material as THREE.Material).dispose();
      oceanRef.current = null;
    }
    if (skirtRef.current) {
      scene.remove(skirtRef.current);
      skirtRef.current.geometry.dispose();
      (skirtRef.current.material as THREE.Material).dispose();
      skirtRef.current = null;
    }

    const geometry = buildTerrainGeometry(projection, sampling);
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.94,
      metalness: 0.02,
      envMapIntensity: 0.35, // aporte ambiental sutil; más lavaría los colores del DEM
      flatShading: false,
    });
    const terrain = new THREE.Mesh(geometry, material);
    terrain.receiveShadow = true;
    // El terreno NO proyecta sombra sobre sí mismo: con exageración vertical de 2.6×
    // esas sombras serían geométricamente engañosas, y recorrer la malla completa en
    // el paso de sombras duplica el coste sin aportar información. El relieve ya se
    // lee por la iluminación real sobre las normales del DEM y el realce de laderas.
    terrain.castShadow = false;
    scene.add(terrain);
    terrainRef.current = terrain;

    // Bloque sólido: cierra los laterales del recorte del DEM y su fondo, para que
    // la cuenca se lea como una muestra extraída y no como una hoja flotante.
    const baseElevation = projection.dem.minElevation - 900;
    const skirtGeo = buildTerrainSkirt(projection, baseElevation, sampling);
    const skirt = new THREE.Mesh(
      skirtGeo,
      new THREE.MeshStandardMaterial({
        color: 0x2c3444,
        roughness: 0.96,
        metalness: 0.04,
        side: THREE.DoubleSide,
      })
    );
    skirt.receiveShadow = true;
    scene.add(skirt);
    skirtRef.current = skirt;

    // Océano Pacífico: muy extenso, para que su borde quede disuelto por la niebla
    // en lugar de cortar la escena con una arista recta.
    // Semiextensión 700 u. El tamaño NO influye en el parpadeo (el far pesa un 0.02 % en la
    // precisión de profundidad), pero sí en que el borde quede disuelto: con la cámara
    // desplazada hasta 340 u, un plano más corto dejaría asomar una arista recta donde la
    // niebla aún no llega. Cabe holgadamente en far=1400 (700 + 340 = 1040 u).
    const oceanGeo = new THREE.PlaneGeometry(projection.sceneWidth * 14, projection.sceneDepth * 14);

    // Opaco: evita el pase de transparencias y su escritura de profundidad condicionada.
    //
    // SIN polygonOffset a propósito. Llevaba `polygonOffsetFactor: 1`, y ese término es
    // proporcional a la PENDIENTE DE PROFUNDIDAD del polígono por píxel: en un plano casi
    // horizontal visto de forma rasante equivale a hundir el agua entre 17 y 116 m de cota
    // según ángulo y distancia, muchísimo más que los 6 m de separación real. El terreno
    // ganaba toda la plataforma sumergida y, como el sesgo depende de la cámara, la frontera
    // "gana mar / gana tierra" barría la pantalla al orbitar: ese era el parpadeo.
    // La separación geométrica de la lámina ya basta; un desempate solo sería admisible como
    // término constante (factor 0, units negativos), y hoy no hace falta.
    const oceanMat = new THREE.MeshStandardMaterial({
      color: 0x123f66,
      // metalness alto sin entorno deja el agua negra. Con el mapa del cielo ya hay algo
      // que reflejar, pero se mantiene bajo: el agua real es dieléctrica, no metálica.
      metalness: 0.15,
      roughness: 0.32,
      envMapIntensity: 1.4,
    });
    const ocean = new THREE.Mesh(oceanGeo, oceanMat);
    ocean.rotation.x = -Math.PI / 2;
    // El DEM Terrarium codifica el mar como cota 0.0 EXACTA en miles de celdas. Dejar la
    // lámina en elevationToY(0) la vuelve matemáticamente COINCIDENTE con esa sábana del
    // terreno: con Δz = 0 no decide la geometría sino el redondeo del rasterizador, y al
    // orbitar la frontera "gana mar / gana tierra" barre la pantalla. Ningún par near/far
    // arregla una coplanaridad exacta; hay que separarlas físicamente.
    // 6.35 m y no 6: geodata.ts redondea las cotas a 0.1 m, así que todas son múltiplos
    // exactos de 0.1 y un llano costero de exactamente 6.0 m volvería a ser coplanario.
    // Un valor fuera de esa retícula hace la coincidencia imposible por construcción.
    // Contrapartida documentada: la línea de costa entra ~1 celda (≈195 m) tierra adentro y
    // se pierde la equivalencia y=0 <-> 0 m s.n.m. NO es un escenario de inundación.
    const SEA_SURFACE_M = 6.35;
    ocean.position.y = projection.elevationToY(SEA_SURFACE_M);
    // Nada proyecta sombra sobre el mar: el terreno tiene castShadow=false y los mástiles
    // de estación están en tierra, dentro de un frustum de sombra de ±80/±70 frente a un
    // plano de 1400 u. Recibirlas costaba una consulta al shadow map por fragmento en la
    // mayor superficie de pantalla, a cambio de nada.
    ocean.receiveShadow = false;
    scene.add(ocean);
    oceanRef.current = ocean;

    // Encuadre inicial proporcional al tamaño real de la cuenca
    const orbit = orbitRef.current;
    const midY = projection.elevationToY((projection.dem.maxElevation + projection.dem.minElevation) / 2);
    orbit.tTarget.set(0, midY * 0.5, 0);
    orbit.tRadius = projection.sceneWidth * 1.32;

    setStats(s => ({
      verts: sampling.meshWidth * sampling.meshHeight,
      rivers: s?.rivers ?? 0,
      places: s?.places ?? 0,
    }));
  }, [projection, sampling]);

  // ---------------------------------------------------------------------------
  // 3. Recoloreado por capa temática (barato: solo toca el atributo de color)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const terrain = terrainRef.current;
    if (!terrain || !projection || !slopeMap || !sampling) return;

    const { colors, legend: newLegend } = computeLayerColors(activeLayer, {
      projection,
      stations,
      slope: slopeMap,
      riverDistance,
      sampling,
    });

    terrain.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrain.geometry.attributes.color.needsUpdate = true;
    setLegend(newLegend);
  }, [activeLayer, projection, slopeMap, riverDistance, stations, sampling]);

  // ---------------------------------------------------------------------------
  // 4. Red hidrográfica real (OSM) colgada del relieve
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const group = riverGroupRef.current;
    if (!group || !projection || !hydrography) return;

    while (group.children.length) {
      const child = group.children.pop()!;
      const line = child as THREE.Line;
      line.geometry?.dispose();
      (line.material as THREE.Material)?.dispose();
    }

    // Quebradas y afluentes menores: líneas finas, bastan para insinuar la red.
    const { tributaries } = buildRiverLines(projection, hydrography.rivers);
    if (tributaries) {
      group.add(
        new THREE.LineSegments(
          tributaries,
          new THREE.LineBasicMaterial({ color: 0x5cc4f0, transparent: true, opacity: 0.6 })
        )
      );
    }

    // Cauces con nombre: tubos con volumen real, jerarquizados por importancia.
    const named = hydrography.rivers.filter(r => r.waterway === 'river');
    const isTrunk = (name: string) => /moche|grande|san lorenzo/i.test(name);

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.6,
      roughness: 0.25,
      metalness: 0.1,
    });
    const branchMat = new THREE.MeshStandardMaterial({
      color: 0x3b8fc4,
      emissive: 0x0b3550,
      emissiveIntensity: 0.35,
      roughness: 0.4,
      metalness: 0.05,
    });

    for (const tube of buildRiverTubes(projection, named.filter(r => isTrunk(r.name)), {
      radius: 0.34,
      liftMeters: 34,
    })) {
      group.add(new THREE.Mesh(tube, trunkMat));
    }
    for (const tube of buildRiverTubes(projection, named.filter(r => !isTrunk(r.name)), {
      radius: 0.17,
      liftMeters: 28,
      minPoints: 14,
    })) {
      group.add(new THREE.Mesh(tube, branchMat));
    }

    setStats(s => ({
      verts: s?.verts ?? 0,
      rivers: hydrography.rivers.length,
      places: hydrography.places.length,
    }));
  }, [projection, hydrography]);

  // ---------------------------------------------------------------------------
  // 5. Estaciones IoT y rótulos de localidades, en coordenadas reales
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const group = stationGroupRef.current;
    if (!group || !projection) return;

    while (group.children.length) {
      const child = group.children.pop()!;
      child.traverse(o => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach(x => x.dispose());
        else mat?.dispose();
      });
    }
    stationMapRef.current.clear();

    for (const st of stations) {
      const { lat, lng } = st.coordinates;
      if (!projection.contains(lng, lat)) continue;

      const [x, y, z] = projection.project(lng, lat, 0);
      const marker = new THREE.Group();
      marker.position.set(x, y, z);

      const isSelected = selectedStation?.id === st.id;
      const color = STATUS_COLORS[st.status] ?? 0x22c55e;

      // Mástil
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 3.4, 6),
        new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.5, metalness: 0.4 })
      );
      mast.position.y = 1.7;
      mast.castShadow = true;
      marker.add(mast);

      // Baliza superior
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(isSelected ? 0.85 : 0.62, 18, 14),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: isSelected ? 1.5 : 0.85,
          roughness: 0.3,
        })
      );
      beacon.name = 'beacon';
      beacon.position.y = 3.4;
      marker.add(beacon);

      // Anillo pulsante en la base
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.95, 1.35, 28),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: isSelected ? 0.75 : 0.4,
          side: THREE.DoubleSide,
        })
      );
      ring.name = 'ring';
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.08;
      marker.add(ring);

      // Halo vertical para la estación seleccionada
      if (isSelected) {
        const halo = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.14, 7, 8),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28 })
        );
        halo.position.y = 3.5;
        marker.add(halo);
      }

      group.add(marker);
      marker.traverse(o => stationMapRef.current.set(o, st));
      stationMapRef.current.set(marker, st);
    }

  }, [projection, stations, selectedStation]);

  // ---------------------------------------------------------------------------
  // 5b. Hitos geográficos: posiciones de mundo para la capa de rótulos HTML
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!projection || !hydrography) {
      setLandmarks([]);
      return;
    }

    const top = [...hydrography.places]
      .filter(p => projection.contains(p.lon, p.lat))
      .filter(p => p.name && p.name.trim() && p.name !== 'Sin nombre')
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
      .slice(0, 14)
      .map<Landmark>(p => {
        const elevation = projection.sampleElevation(p.lon, p.lat);
        const [x, y, z] = projection.project(p.lon, p.lat, 90);
        return {
          id: `place-${p.id}`,
          name: p.name,
          kind: (p.kind === 'city' || p.kind === 'town' ? p.kind : 'village'),
          population: p.population,
          elevation: Math.round(elevation),
          world: new THREE.Vector3(x, y, z),
        };
      });

    setLandmarks(top);
  }, [projection, hydrography]);

  // ---------------------------------------------------------------------------
  // 6. Iluminación y atmósfera
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const preset = LIGHTING_PRESETS[lightingMode];
    const scene = sceneRef.current;
    const sun = sunRef.current;
    const hemi = hemiRef.current;
    const sky = skyRef.current;
    const renderer = rendererRef.current;
    if (!scene || !sun || !hemi || !sky || !renderer) return;

    sun.position.copy(preset.sun);
    sun.color.setHex(preset.sunColor);
    sun.intensity = preset.sunIntensity;
    sun.target.position.set(0, 0, 0);
    sun.target.updateMatrixWorld();

    hemi.color.setHex(preset.hemiSky);
    hemi.groundColor.setHex(preset.hemiGround);
    hemi.intensity = preset.hemiIntensity;

    const skyMat = sky.material as THREE.ShaderMaterial;
    skyMat.uniforms.topColor.value.copy(preset.skyTop);
    skyMat.uniforms.bottomColor.value.copy(preset.skyBottom);

    scene.fog = new THREE.FogExp2(preset.skyBottom.getHex(), preset.fogDensity);
    renderer.toneMappingExposure = preset.exposure;

    // El cielo cambió de color: hay que rehacer el entorno o el agua seguiría
    // reflejando la atmósfera del modo anterior.
    rebuildEnvRef.current?.();
  }, [lightingMode]);

  // ---------------------------------------------------------------------------
  // 7. Encuadres predefinidos sobre lugares reales de la cuenca
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!projection) return;
    const orbit = orbitRef.current;

    const focusOn = (lon: number, lat: number, radius: number, phi: number, theta: number) => {
      const [x, y, z] = projection.project(lon, lat, 0);
      orbit.tTarget.set(x, y, z);
      orbit.tRadius = radius;
      orbit.tPhi = phi;
      orbit.tTheta = theta;
    };

    switch (cameraPreset) {
      case 'high': // Cabecera minera de Quiruvilca
        focusOn(-78.33, -7.98, 34, 0.85, -0.5);
        break;
      case 'mid': // Otuzco y valles interandinos
        focusOn(-78.58, -7.90, 42, 0.9, -0.9);
        break;
      case 'low': // Trujillo, campiña de Moche y desembocadura
        focusOn(-79.01, -8.14, 40, 0.88, -0.2);
        break;
      case 'profile': // Perfil longitudinal Andes → Pacífico
        orbit.tTarget.set(0, projection.elevationToY(1400), 0);
        orbit.tRadius = projection.sceneWidth * 1.15;
        orbit.tPhi = 1.38;
        orbit.tTheta = -Math.PI / 2;
        break;
      case 'overview':
      default:
        orbit.tTarget.set(0, projection.elevationToY(1200), 0);
        orbit.tRadius = projection.sceneWidth * 1.32;
        orbit.tPhi = 0.92;
        orbit.tTheta = -0.62;
        break;
    }
  }, [cameraPreset, projection]);

  // ---------------------------------------------------------------------------
  // Render de la interfaz
  // ---------------------------------------------------------------------------
  const isLoading = demPhase === 'loading' || demPhase === 'idle';
  const hasFailed = demPhase === 'error';

  return (
    <div className="relative w-full flex-1 min-h-[340px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl">
      <div ref={containerRef} className="w-full h-full" style={{ cursor: 'grab' }} />

      {/* Capa de rótulos de hitos: HTML sobre el canvas. Tamaño constante y texto
          nítido a cualquier distancia; el bucle de render solo escribe `transform`. */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {landmarks.map(mark => {
          const isCity = mark.kind === 'city';
          const isTown = mark.kind === 'town';
          return (
            <div
              key={mark.id}
              ref={el => {
                if (el) labelNodesRef.current.set(mark.id, el);
                else labelNodesRef.current.delete(mark.id);
              }}
              className="absolute top-0 left-0 will-change-transform"
              style={{ visibility: 'hidden', opacity: 0, transition: 'opacity 140ms linear' }}
            >
              <div
                className={`flex items-center gap-1.5 rounded-md border backdrop-blur-sm whitespace-nowrap ${
                  isCity
                    ? 'px-2 py-1 bg-slate-950/80 border-amber-500/50'
                    : isTown
                      ? 'px-1.5 py-0.5 bg-slate-950/75 border-slate-500/40'
                      : 'px-1.5 py-0.5 bg-slate-950/65 border-slate-600/30'
                }`}
                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.95)' }}
              >
                <span
                  className={`rounded-full shrink-0 ${
                    isCity ? 'w-1.5 h-1.5 bg-amber-400' : 'w-1 h-1 bg-sky-300'
                  }`}
                />
                <span
                  className={`font-semibold tracking-tight ${
                    isCity
                      ? 'text-[12px] text-amber-100'
                      : isTown
                        ? 'text-[11px] text-slate-100'
                        : 'text-[10px] text-slate-300'
                  }`}
                >
                  {mark.name}
                </span>
                {isCity && (
                  <span className="text-[9px] font-mono text-amber-300/80 border-l border-amber-500/30 pl-1.5">
                    {mark.elevation} m
                  </span>
                )}
              </div>
              {/* Guía vertical hasta el punto exacto del terreno */}
              <div
                className={`mx-auto w-px ${isCity ? 'h-3.5 bg-amber-400/70' : 'h-3 bg-sky-300/50'}`}
              />
            </div>
          );
        })}
      </div>

      {/* ---------- Estado de carga / error ---------- */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm z-20">
          <Loader2 className="w-8 h-8 text-sky-400 animate-spin mb-4" />
          <p className="text-sm font-semibold text-slate-200">{t('twin.loading')}</p>
          <p className="text-xs text-slate-500 mt-1.5">
            {t('twin.loadingSource')}
          </p>
        </div>
      )}

      {hasFailed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 z-20 px-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-400 mb-3" />
          <p className="text-sm font-semibold text-slate-200">
            {t('twin.error')}
          </p>
          <p className="text-xs text-slate-400 mt-1.5 max-w-md">{error}</p>
          <button
            onClick={geodata.reload}
            className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
          >
            {t('twin.retry')}
          </button>
        </div>
      )}

      {/* ---------- Barra superior: capas temáticas ---------- */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-start justify-between gap-2 pointer-events-none z-10">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700/80 shadow-lg pointer-events-auto">
          {LAYER_BUTTONS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onLayerChange(id)}
              className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors flex items-center gap-1.5 ${
                activeLayer === id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t(`layer.${id}`)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Encuadres */}
          <div className="flex items-center gap-1 p-1 bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700/80 shadow-lg">
            {(['overview', 'high', 'mid', 'low', 'profile'] as CameraPreset[]).map(id => (
              <button
                key={id}
                onClick={() => setCameraPreset(id)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                  cameraPreset === id
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t(`view.${id}`)}
              </button>
            ))}
          </div>

          {/* Iluminación */}
          <div className="flex items-center gap-1 p-1 bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700/80 shadow-lg">
            {LIGHTING_BUTTONS.map(({ id, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setLightingMode(id)}
                title={t(`light.${id}`)}
                className={`p-1.5 rounded transition-colors ${
                  lightingMode === id
                    ? 'bg-slate-700 text-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Panel inferior izquierdo: leyenda de la capa ---------- */}
      {legend && !isLoading && (
        <div className="absolute bottom-3 left-3 z-10 max-w-xs p-3 bg-slate-900/92 backdrop-blur-md rounded-xl border border-slate-700/70 shadow-xl">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[11px] font-bold text-slate-100">{t(legend.titleKey)}</span>
          </div>
          <div className="space-y-1">
            {legend.entries.map(entry => (
              <div key={entry.labelKey} className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0 border border-slate-600/50"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-[10px] text-slate-300 leading-tight">{t(entry.labelKey)}</span>
              </div>
            ))}
          </div>
          {legend.noteKey && (
            <p className="text-[9px] text-slate-500 mt-2 leading-snug border-t border-slate-800 pt-1.5">
              {t(legend.noteKey)}
            </p>
          )}
        </div>
      )}

      {/* ---------- Panel inferior derecho: exageración, rótulos y procedencia ---------- */}
      {!isLoading && dem && (
        <div className="absolute bottom-3 right-3 z-10 flex flex-col items-end gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700/80 shadow-lg">
            <Move3D className="w-3.5 h-3.5 text-slate-400 ml-1" />
            <span className="text-[10px] text-slate-400 mr-1">{t('twin.relief')}</span>
            {EXAGGERATIONS.map(v => (
              <button
                key={v}
                onClick={() => setExaggeration(v)}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                  exaggeration === v ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {v}×
              </button>
            ))}
            <button
              onClick={() => setShowLabels(v => !v)}
              title={t('twin.toggleLabels')}
              className={`p-1.5 rounded transition-colors ml-1 ${
                showLabels ? 'bg-slate-700 text-sky-300' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-3 py-2 bg-slate-900/92 backdrop-blur-md rounded-xl border border-slate-700/70 shadow-xl text-right">
            <div className="flex items-center justify-end gap-1.5 mb-1">
              <Database className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-bold text-emerald-400">{t('twin.provenance')}</span>
            </div>
            <p className="text-[9px] text-slate-400 font-mono leading-relaxed">
              DEM {dem.width}×{dem.height} · z{dem.zoom} · {dem.tilesResolved}/{dem.tilesRequested} {t('twin.tiles')}
              <br />
              {t('twin.elevationRange')} {dem.minElevation.toFixed(0)}–{dem.maxElevation.toFixed(0)} {t('station.masl')} · {t('twin.exaggeration')} {exaggeration}×
              <br />
              {(dem.spanMetersX / 1000).toFixed(1)} × {(dem.spanMetersY / 1000).toFixed(1)} km
              {stats && stats.rivers > 0 && (
                <>
                  <br />
                  {stats.rivers} {t('twin.reaches')} · {stats.places} {t('twin.places')}
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* ---------- Tooltip de estación ---------- */}
      {hovered && (
        <div
          className="absolute z-30 pointer-events-none px-3 py-2 bg-slate-900/95 backdrop-blur-md rounded-lg border border-slate-600 shadow-2xl min-w-[190px]"
          style={{
            left: Math.min(hovered.x + 14, (containerRef.current?.clientWidth ?? 400) - 210),
            top: Math.max(8, hovered.y - 70),
          }}
        >
          <div className="text-[11px] font-bold text-slate-100">{hovered.station.name}</div>
          <div className="text-[9px] text-slate-400 mb-1.5">
            {hovered.station.subbasin} · {hovered.station.coordinates.elevation} {t('station.masl')}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
            <span className="text-slate-400">{t('station.discharge')}</span>
            <span className="text-sky-300 font-mono text-right">
              {hovered.station.currentValues.discharge.toFixed(2)} m³/s
            </span>
            <span className="text-slate-400">{t('station.wqi')}</span>
            <span
              className={`font-mono text-right ${
                hovered.station.currentValues.wqi >= 72 ? 'text-emerald-300' : 'text-amber-300'
              }`}
            >
              {hovered.station.currentValues.wqi.toFixed(1)}
            </span>
            <span className="text-slate-400">{t('station.ph')}</span>
            <span className="text-slate-200 font-mono text-right">
              {hovered.station.currentValues.ph.toFixed(1)}
            </span>
            <span className="text-slate-400">{t('station.lead')}</span>
            <span
              className={`font-mono text-right ${
                hovered.station.currentValues.heavy_metals_lead > 0.0025
                  ? 'text-red-300'
                  : 'text-emerald-300'
              }`}
            >
              {hovered.station.currentValues.heavy_metals_lead.toFixed(3)} mg/L
            </span>
          </div>
        </div>
      )}

      {/* ---------- Ayuda de navegación ---------- */}
      {!isLoading && (
        <div className="absolute top-1/2 left-3 -translate-y-1/2 z-10 opacity-0 hover:opacity-100 transition-opacity">
          <div className="p-2 bg-slate-900/90 rounded-lg border border-slate-700 text-[9px] text-slate-400 space-y-0.5">
            <div>{t('twin.help.rotate')}</div>
            <div>{t('twin.help.pan')}</div>
            <div>{t('twin.help.zoom')}</div>
          </div>
        </div>
      )}
    </div>
  );
};

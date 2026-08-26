/**
 * DigitalTwin3D - Visor 3D Geoespacial del Gemelo Digital de Cuenca
 * Renderizado WebGL con Three.js: Terreno DEM realista, Red fluvial animada,
 * Estaciones IoT interactivas con balizas dinámicas y draping espectral.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { MonitoringStation } from '../types';
import { MOCHE_RIVER_COORDINATES_3D } from '../data/mocheBasinData';
import { Layers, Eye, Compass, Mountain, Droplets, Activity, Maximize2, ShieldAlert, Sparkles } from 'lucide-react';

interface DigitalTwin3DProps {
  stations: MonitoringStation[];
  selectedStation: MonitoringStation | null;
  onSelectStation: (st: MonitoringStation) => void;
  activeLayer: 'elevation' | 'wqi' | 'ndwi' | 'discharge' | 'flood' | 'heavy_metals';
  onLayerChange: (layer: 'elevation' | 'wqi' | 'ndwi' | 'discharge' | 'flood' | 'heavy_metals') => void;
}

export const DigitalTwin3D: React.FC<DigitalTwin3DProps> = ({
  stations,
  selectedStation,
  onSelectStation,
  activeLayer,
  onLayerChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const terrainMeshRef = useRef<THREE.Mesh | null>(null);
  const riverMeshRef = useRef<THREE.Mesh | null>(null);
  const stationObjectsRef = useRef<Map<string, THREE.Group>>(new Map());

  const [hoveredStation, setHoveredStation] = useState<MonitoringStation | null>(null);
  const [cameraPreset, setCameraPreset] = useState<'overview' | 'high' | 'mid' | 'low'>('overview');
  const [showContours, setShowContours] = useState<boolean>(true);
  const [waterParticlesActive, setWaterParticlesActive] = useState<boolean>(true);
  const [lightingMode, setLightingMode] = useState<'day' | 'sunset' | 'night'>('day');

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Escena y Niebla Atmosférica
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(lightingMode === 'night' ? 0x050b14 : lightingMode === 'sunset' ? 0x1a1224 : 0x0c1524);
    scene.fog = new THREE.FogExp2(scene.background.getHex(), 0.008);
    sceneRef.current = scene;

    // 2. Cámara Perspectiva
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 1000);
    camera.position.set(0, 48, 62);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 3. Renderizador WebGL
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    container.replaceChildren(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Iluminación Ambiental y Sol Direccional
    const ambientLight = new THREE.AmbientLight(
      lightingMode === 'night' ? 0x1e293b : lightingMode === 'sunset' ? 0xfdba74 : 0xe2e8f0,
      lightingMode === 'night' ? 0.6 : 1.2
    );
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(
      lightingMode === 'sunset' ? 0xff7733 : 0xffffff,
      lightingMode === 'night' ? 0.4 : 2.0
    );
    sunLight.position.set(40, 60, 30);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);

    // 5. Creación de Malla DEM del Terreno (Cuenca del Río Moche)
    // Generación matemática de relieve andino con pendiente hacia la costa
    const gridCols = 120;
    const gridRows = 120;
    const terrainGeo = new THREE.PlaneGeometry(80, 80, gridCols - 1, gridRows - 1);
    terrainGeo.rotateX(-Math.PI / 2);

    const pos = terrainGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); // Eje X: Costa (-35) a Sierra (+35)
      const z = pos.getZ(i); // Eje Z: Norte (-35) a Sur (+35)

      // Función de elevación: Gradiente regional + Ruido fractal de cordillera
      const elevationGradient = ((x + 35) / 70) * 14.0; // 0m a 4100m
      const mountainNoise1 = Math.sin(x * 0.18) * Math.cos(z * 0.18) * 3.2;
      const mountainNoise2 = Math.sin(x * 0.45 + 1.2) * Math.cos(z * 0.35) * 1.4;
      const valleyCarving = -Math.exp(-Math.pow((z - (x * 0.65 - 3)) / 5.5, 2)) * 4.0; // Cauce del río Moche

      const y = Math.max(0.1, elevationGradient + mountainNoise1 + mountainNoise2 + valleyCarving);
      pos.setY(i, y);

      // Asignación de colores por capa (Elevation, NDWI, WQI)
      let r = 0.15, g = 0.25, b = 0.2; // Valle fértil base

      if (activeLayer === 'elevation') {
        const normY = y / 16.0;
        if (normY < 0.15) {
          // Costa árida y valle bajo
          r = 0.65; g = 0.58; b = 0.42;
        } else if (normY < 0.45) {
          // Valles interandinos verdes (Otuzco/Simbal)
          r = 0.22; g = 0.48; b = 0.26;
        } else if (normY < 0.75) {
          // Puna y pastizales altoandinos
          r = 0.45; g = 0.42; b = 0.32;
        } else {
          // Rocas altas y cumbres (Quiruvilca)
          r = 0.75; g = 0.75; b = 0.82;
        }
      } else if (activeLayer === 'wqi') {
        // Mapa de calor WQI regional
        const wqiSim = Math.max(20, Math.min(95, 85 - (x < 0 ? Math.abs(x) * 1.2 : 0) - (y > 10 ? 15 : 0)));
        if (wqiSim >= 70) {
          r = 0.05; g = 0.65; b = 0.35; // Verde
        } else if (wqiSim >= 50) {
          r = 0.85; g = 0.65; b = 0.15; // Ámbar
        } else {
          r = 0.85; g = 0.25; b = 0.2; // Rojo
        }
      } else if (activeLayer === 'ndwi') {
        // Satelital NDWI
        const ndwiSim = Math.max(-0.4, 0.4 - Math.abs(z - (x * 0.65 - 3)) / 8.0);
        if (ndwiSim > 0.1) {
          r = 0.05; g = 0.45; b = 0.85; // Agua
        } else if (ndwiSim > -0.1) {
          r = 0.15; g = 0.55; b = 0.35; // Vegetación húmeda
        } else {
          r = 0.65; g = 0.55; b = 0.4; // Suelo seco
        }
      } else if (activeLayer === 'flood') {
        // Mancha de Inundación y Riesgo Hidráulico en Cuenca Baja
        const distToRiver = Math.abs(z - (x * 0.65 - 3));
        const isLowValley = x < -10; // Costa / Laredo / Moche
        if (isLowValley && distToRiver < 7.0) {
          r = 0.1; g = 0.3; b = 0.9; // Inundación activa
        } else if (isLowValley && distToRiver < 12.0) {
          r = 0.9; g = 0.45; b = 0.1; // Zona de amortiguamiento y riesgo
        } else {
          r = 0.45; g = 0.45; b = 0.4; // Terreno no inundable
        }
      } else if (activeLayer === 'heavy_metals') {
        // Pluma de Contaminación de Metales Pesados desde Cabecera
        const distToRiver = Math.abs(z - (x * 0.65 - 3));
        const isHighBasin = x > 8; // Quiruvilca / Shorey / Otuzco
        if (isHighBasin && distToRiver < 5.0) {
          r = 0.92; g = 0.15; b = 0.2; // Alta toxicidad DAM (Pb, As, pH ácido)
        } else if (distToRiver < 6.0) {
          r = 0.88; g = 0.65; b = 0.15; // Atenuación progresiva
        } else {
          r = 0.25; g = 0.45; b = 0.3; // Calidad recuperada
        }
      } else {
        // Descarga
        r = 0.12; g = 0.35; b = 0.55;
      }

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    terrainGeo.computeVertexNormals();
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.1,
      wireframe: false,
      flatShading: true,
    });

    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);
    terrainMeshRef.current = terrainMesh;

    // 6. Curvas de Nivel (Contour Lines)
    if (showContours) {
      const contourMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 });
      const wireframe = new THREE.LineSegments(new THREE.WireframeGeometry(terrainGeo), contourMat);
      terrainMesh.add(wireframe);
    }

    // 7. Red Fluvial 3D (Río Moche y Afluentes)
    const curvePoints = MOCHE_RIVER_COORDINATES_3D.map(pt => new THREE.Vector3(pt.x, pt.y + 0.35, pt.z));
    const riverCurve = new THREE.CatmullRomCurve3(curvePoints);
    const riverGeo = new THREE.TubeGeometry(riverCurve, 80, 0.42, 10, false);

    const riverMat = new THREE.MeshStandardMaterial({
      color: activeLayer === 'wqi' ? 0x10b981 : 0x0ea5e9,
      roughness: 0.1,
      metalness: 0.8,
      emissive: activeLayer === 'wqi' ? 0x064e3b : 0x0369a1,
      emissiveIntensity: 0.45,
    });

    const riverMesh = new THREE.Mesh(riverGeo, riverMat);
    scene.add(riverMesh);
    riverMeshRef.current = riverMesh;

    // Partículas de flujo de agua
    const particleCount = 120;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);

    for (let p = 0; p < particleCount; p++) {
      const t = p / particleCount;
      const pt = riverCurve.getPoint(t);
      particlePositions[p * 3] = pt.x;
      particlePositions[p * 3 + 1] = pt.y + 0.15;
      particlePositions[p * 3 + 2] = pt.z;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0xbae6fd,
      size: 0.65,
      transparent: true,
      opacity: 0.85,
    });
    const riverParticles = new THREE.Points(particleGeo, particleMat);
    scene.add(riverParticles);

    // 8. Creación de Balizas 3D para Estaciones IoT
    const stationMap = new THREE.Group();
    scene.add(stationMap);

    stations.forEach(st => {
      const group = new THREE.Group();
      group.position.set(st.grid3D.x, st.grid3D.y + 1.2, st.grid3D.z);

      // Color según estado y cumplimiento
      const beaconColor = !st.ecaCompliance.isCompliant
        ? 0xef4444 // Rojo (Alerta ECA)
        : st.status === 'warning'
        ? 0xf59e0b // Ámbar
        : 0x10b981; // Verde

      // Mástil vertical
      const mastGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.2, 8);
      const mastMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
      const mast = new THREE.Mesh(mastGeo, mastMat);
      mast.position.y = 1.1;
      group.add(mast);

      // Baliza esférica luminosa
      const beaconGeo = new THREE.SphereGeometry(0.55, 16, 16);
      const beaconMat = new THREE.MeshStandardMaterial({
        color: beaconColor,
        emissive: beaconColor,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.y = 2.2;
      group.add(beacon);

      // Anillo de pulso exterior
      const ringGeo = new THREE.RingGeometry(0.7, 0.95, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: beaconColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 2.2;
      group.add(ring);

      (group as any).userData = { station: st, ring };
      stationMap.add(group);
      stationObjectsRef.current.set(st.id, group);
    });

    // 9. Animación y Raycasting Interactivo
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(stationMap.children, true);

      if (intersects.length > 0) {
        let rootGroup = intersects[0].object;
        while (rootGroup.parent && rootGroup.parent !== stationMap) {
          rootGroup = rootGroup.parent;
        }
        if ((rootGroup as any).userData?.station) {
          setHoveredStation((rootGroup as any).userData.station);
          container.style.cursor = 'pointer';
          return;
        }
      }
      setHoveredStation(null);
      container.style.cursor = 'grab';
    };

    const handleClick = () => {
      if (hoveredStation) {
        onSelectStation(hoveredStation);
      }
    };

    container.addEventListener('mousemove', handlePointerMove);
    container.addEventListener('click', handleClick);

    // Controles manuales de órbita simplificados
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };
    let cameraAngle = 0.8;
    let cameraDistance = 75;
    let cameraHeight = 45;

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMoveDrag = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMousePos.x;
      const deltaY = e.clientY - prevMousePos.y;
      prevMousePos = { x: e.clientX, y: e.clientY };

      cameraAngle += deltaX * 0.006;
      cameraHeight = Math.max(12, Math.min(85, cameraHeight - deltaY * 0.12));
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraDistance = Math.max(25, Math.min(120, cameraDistance + e.deltaY * 0.04));
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMoveDrag);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    // Loop de renderizado
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Animación suave de cámara
      const targetCamX = Math.sin(cameraAngle) * cameraDistance;
      const targetCamZ = Math.cos(cameraAngle) * cameraDistance;
      camera.position.x += (targetCamX - camera.position.x) * 0.08;
      camera.position.y += (cameraHeight - camera.position.y) * 0.08;
      camera.position.z += (targetCamZ - camera.position.z) * 0.08;
      camera.lookAt(0, 4, 0);

      // Animación de anillos de pulso en balizas
      stationObjectsRef.current.forEach(group => {
        const ring = (group as any).userData?.ring;
        if (ring) {
          const scale = 1.0 + Math.sin(elapsedTime * 3.5) * 0.35;
          ring.scale.set(scale, scale, scale);
        }
      });

      // Animación de partículas de flujo de agua
      if (waterParticlesActive && riverParticles) {
        const posAttr = riverParticles.geometry.attributes.position;
        for (let p = 0; p < particleCount; p++) {
          const t = (p / particleCount + (elapsedTime * 0.06)) % 1.0;
          const pt = riverCurve.getPoint(1.0 - t); // Fluye de cumbre (t=0) a costa (t=1)
          posAttr.setXYZ(p, pt.x, pt.y + 0.18, pt.z);
        }
        posAttr.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mousemove', handlePointerMove);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMoveDrag);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [activeLayer, showContours, waterParticlesActive, lightingMode]);

  // Manejador de preajustes de cámara
  const applyPreset = (preset: 'overview' | 'high' | 'mid' | 'low') => {
    setCameraPreset(preset);
    if (!cameraRef.current) return;
    if (preset === 'overview') {
      cameraRef.current.position.set(0, 55, 68);
    } else if (preset === 'high') {
      cameraRef.current.position.set(38, 28, -20);
    } else if (preset === 'mid') {
      cameraRef.current.position.set(10, 20, 8);
    } else if (preset === 'low') {
      cameraRef.current.position.set(-26, 14, 34);
    }
  };

  return (
    <div className="relative w-full h-[520px] lg:h-[620px] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl">
      {/* Canvas 3D */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Barra de Control Flotante Superior (Capas y Variables) */}
      <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Selector de Capas */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700/80 shadow-lg pointer-events-auto">
          <button
            onClick={() => onLayerChange('elevation')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeLayer === 'elevation'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Mountain className="w-3.5 h-3.5" />
            Topografía DEM
          </button>
          <button
            onClick={() => onLayerChange('wqi')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeLayer === 'wqi'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Calidad ICA/WQI
          </button>
          <button
            onClick={() => onLayerChange('ndwi')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeLayer === 'ndwi'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Droplets className="w-3.5 h-3.5" />
            Satelital NDWI
          </button>
          <button
            onClick={() => onLayerChange('flood')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeLayer === 'flood'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Inundación 3D
          </button>
          <button
            onClick={() => onLayerChange('heavy_metals')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeLayer === 'heavy_metals'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Metales Pb/As
          </button>
        </div>

        {/* Controles de Vista y Cámara */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-1 p-1 bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700/80">
            <button
              onClick={() => applyPreset('overview')}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                cameraPreset === 'overview' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              General
            </button>
            <button
              onClick={() => applyPreset('high')}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                cameraPreset === 'high' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              C. Alta (4000m)
            </button>
            <button
              onClick={() => applyPreset('mid')}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                cameraPreset === 'mid' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              C. Media
            </button>
            <button
              onClick={() => applyPreset('low')}
              className={`px-2.5 py-1 text-xs rounded transition-colors ${
                cameraPreset === 'low' ? 'bg-slate-700 text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              C. Baja (Costa)
            </button>
          </div>

          {/* Toggle Iluminación / Curvas */}
          <button
            onClick={() => setShowContours(!showContours)}
            title="Activar/Desactivar Curvas de Nivel"
            className={`p-2 rounded-lg border transition-colors ${
              showContours ? 'bg-slate-800 text-blue-400 border-blue-500/50' : 'bg-slate-900/90 text-slate-400 border-slate-700'
            }`}
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Leyenda Dinámica Inferior Izquierda */}
      <div className="absolute bottom-4 left-4 p-3 bg-slate-900/95 backdrop-blur-md rounded-lg border border-slate-800 text-xs text-slate-300 max-w-xs shadow-xl pointer-events-auto">
        <div className="font-semibold text-slate-100 flex items-center gap-1.5 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          {activeLayer === 'elevation' && 'Relieve y Cota Topográfica DEM'}
          {activeLayer === 'wqi' && 'Índice de Calidad de Agua (ICA-MINAM)'}
          {activeLayer === 'ndwi' && 'Índice Espectral Sentinel-2 (NDWI)'}
          {activeLayer === 'flood' && 'Zonificación de Inundación y Desborde'}
          {activeLayer === 'heavy_metals' && 'Pluma de Dispersión de Metales (DAM)'}
        </div>

        {activeLayer === 'elevation' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-slate-200" /> Cabecera Quiruvilca (3950 m)
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-600" /> Valles Interandinos (600 - 2500 m)
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-600" /> Valle Bajo y Costa (0 - 120 m)
              </span>
            </div>
          </div>
        )}

        {activeLayer === 'wqi' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500" /> Buena / Excelente (70-100)</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500" /> Regular / Aceptable (50-69)</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500" /> Alerta / Mala (&lt;50)</span>
            </div>
          </div>
        )}

        {activeLayer === 'ndwi' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-500" /> Cuerpo de Agua Abierto</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-700" /> Vegetación Hidromórfica</span>
            </div>
          </div>
        )}

        {activeLayer === 'flood' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-600" /> Lámina Inundable Activa</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500" /> Zona de Amortiguamiento</span>
            </div>
          </div>
        )}

        {activeLayer === 'heavy_metals' && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500" /> Pluma Crítica DAM ($Pb, As$)</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500" /> Atenuación Progresiva</span>
            </div>
          </div>
        )}
      </div>

      {/* Tooltip Emergente al hacer Hover en una Estación */}
      {hoveredStation && (
        <div className="absolute top-20 right-4 p-3.5 bg-slate-900/95 backdrop-blur-md rounded-xl border border-blue-500/40 text-xs text-slate-200 shadow-2xl w-64 animate-fade-in pointer-events-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm text-blue-400">{hoveredStation.name}</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                hoveredStation.ecaCompliance.isCompliant
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-red-950 text-red-300 border border-red-800'
              }`}
            >
              {hoveredStation.ecaCompliance.isCompliant ? 'ECA Cumple' : 'Alerta ECA'}
            </span>
          </div>

          <div className="space-y-1 text-slate-300 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Subcuenca:</span>
              <span className="font-medium">{hoveredStation.subbasin}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Caudal Q actual:</span>
              <span className="font-bold text-sky-400">{hoveredStation.currentValues.discharge.toFixed(2)} m³/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Índice WQI / ICA:</span>
              <span className="font-bold text-emerald-400">{hoveredStation.currentValues.wqi.toFixed(1)}/100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Oxígeno Disuelto:</span>
              <span>{hoveredStation.currentValues.do.toFixed(1)} mg/L</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">pH / Turbidez:</span>
              <span>{hoveredStation.currentValues.ph.toFixed(1)} / {hoveredStation.currentValues.turbidity.toFixed(0)} NTU</span>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-800 text-[10px] text-blue-300 flex items-center justify-between">
            <span>Click para ver telemetría detallada</span>
            <span>📍 {hoveredStation.coordinates.elevation} m</span>
          </div>
        </div>
      )}
    </div>
  );
};

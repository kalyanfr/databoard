import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { countryMeta, flagEmoji, flagUrl } from "@/lib/geo";
import {
  createCountryBordersGeometry,
  createGraticuleGeometry,
  latLngToVector,
  latLngToRotation,
} from "@/lib/globeBorders";
import { renderChoroplethCanvas } from "@/lib/choropleth";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

const RADIUS = 1.0;
const SURFACE = RADIUS * 1.002;
const STEM_HEIGHT = 18; // Height of vertical pin stem in px
const CAMERA_VFOV = 38; // Field of view in degrees

// Key hub connections for flight / network arcs
const NETWORK_LINKS = [
  { from: "US", to: "GB" },
  { from: "GB", to: "DE" },
  { from: "DE", to: "IN" },
  { from: "IN", to: "AU" },
  { from: "US", to: "JP" },
  { from: "US", to: "BR" },
  { from: "BR", to: "GB" },
];

/**
 * Dynamically computes camera distance using exact spherical bounding geometry
 * to guarantee that the 3D globe sphere, atmosphere halo, and flag pins
 * are completely circular and NEVER cropped on any side (left, right, top, bottom).
 */
function getFitDistance(aspect, vFOV = CAMERA_VFOV) {
  const halfVFOVRad = THREE.MathUtils.degToRad(vFOV / 2);
  const tanHalfVFOV = Math.tan(halfVFOVRad);
  const tanHalfHFOV = tanHalfVFOV * Math.max(0.1, aspect);
  const halfHFOVRad = Math.atan(tanHalfHFOV);

  const sinHalfVFOV = Math.sin(halfVFOVRad);
  const sinHalfHFOV = Math.sin(halfHFOVRad);

  // Exact spherical bounding radius: 1.0 (globe) + atmosphere halo + flag pins + safety padding
  const boundingRadius = 1.28;
  const distV = boundingRadius / Math.max(0.01, sinHalfVFOV);
  const distH = boundingRadius / Math.max(0.01, sinHalfHFOV);

  return Math.max(distV, distH, 4.1);
}

function disposeHierarchy(node) {
  if (!node) return;
  for (let i = node.children.length - 1; i >= 0; i -= 1) {
    disposeHierarchy(node.children[i]);
  }
  node.geometry?.dispose();
  if (Array.isArray(node.material)) {
    node.material.forEach((m) => m?.dispose());
  } else {
    node.material?.dispose();
  }
  if (node.parent) node.parent.remove(node);
}

function CountryFlagBadge({ code, name, flag, url, className }) {
  const [failed, setFailed] = useState(false);
  const src = url || (code ? flagUrl(code, 80) : null);

  if (!failed && src) {
    return (
      <img
        src={src}
        alt={name || code}
        className={cn("h-full w-full object-cover select-none pointer-events-none", className)}
        loading="eager"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span className="text-xs font-black uppercase tracking-tight select-none leading-none">
      {flag || code}
    </span>
  );
}

/**
 * High-fidelity 3D Globe with choropleth continents, specular ocean,
 * curved network arcs, and screen-projected circular country flag pins.
 */
export default function GlobeMap({
  markers = [],
  autoRotate = true,
  selectedCountry = null,
  onSelectCountry = null,
  zoomLevel = 1.0,
}) {
  const hostRef = useRef(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Controls are mirrored into refs so the animation loop reads live values
  // without the WebGL scene being torn down and rebuilt on every toggle.
  const zoomRef = useRef(zoomLevel);
  const autoRotateRef = useRef(autoRotate);
  const selectedRef = useRef(selectedCountry);

  useEffect(() => {
    zoomRef.current = zoomLevel;
  }, [zoomLevel]);
  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);
  useEffect(() => {
    selectedRef.current = selectedCountry;
  }, [selectedCountry]);

  const stateRef = useRef({
    globe: null,
    globeMesh: null,
    camera: null,
    renderer: null,
    baseDistance: 4.2,
    targetRotX: 0,
    targetRotY: 0.6,
    isInteracting: false,
    pointerDown: false,
    prevPointer: { x: 0, y: 0 },
    velX: 0,
    velY: 0.0018,
    activePins: [],
  });

  const [pinPositions, setPinPositions] = useState([]);
  const [hoveredCountry, setHoveredCountry] = useState(null);

  // Strictly use live real visitors — zero default or mock pins when empty
  const effectiveMarkerList = useMemo(() => {
    return (markers || []).filter((r) => countryMeta(r?.country) && (Number(r?.visitors) > 0 || Number(r?.events) > 0));
  }, [markers]);

  // Compute total visitors for percentages
  const totalVisitors = useMemo(
    () => effectiveMarkerList.reduce((sum, r) => sum + (Number(r.visitors) || 0), 0),
    [effectiveMarkerList],
  );

  // Filter valid countries with geo coordinates and generate pins
  const validPins = useMemo(() => {
    return effectiveMarkerList
      .filter((row) => countryMeta(row.country))
      .map((row) => {
        const meta = countryMeta(row.country);
        const visitors = Number(row.visitors) || 0;
        const code = String(row.country).toUpperCase();
        const percent = totalVisitors > 0 ? ((visitors / totalVisitors) * 100).toFixed(1) : 0;
        const surfacePos = latLngToVector(meta.lat, meta.lng, SURFACE);
        return {
          code,
          name: meta.name,
          lat: meta.lat,
          lng: meta.lng,
          visitors,
          percent,
          flag: flagEmoji(row.country),
          flagUrl: flagUrl(row.country, 80),
          surfacePos,
        };
      })
      .slice(0, 10);
  }, [effectiveMarkerList, totalVisitors]);

  // Keep active pins ref updated for projection loop
  useEffect(() => {
    stateRef.current.activePins = validPins;
  }, [validPins]);

  // Handle selected country orientation focus
  useEffect(() => {
    if (!selectedCountry) return;
    const meta = countryMeta(selectedCountry);
    if (!meta) return;
    const { x, y } = latLngToRotation(meta.lat, meta.lng);
    stateRef.current.targetRotX = x * 0.7;
    stateRef.current.targetRotY = y;
  }, [selectedCountry]);

  // Main Three.js Scene Setup
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const width = Math.max(10, host.clientWidth);
    const height = Math.max(10, host.clientHeight);
    const aspect = width / height;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA_VFOV, aspect, 0.1, 100);

    // Compute initial fit distance to prevent any side or top clipping
    const initialBaseDist = getFitDistance(aspect, CAMERA_VFOV);
    stateRef.current.baseDistance = initialBaseDist;
    camera.position.set(0, 0, initialBaseDist);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    const canvas = renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.touchAction = "none";
    canvas.className = "cursor-grab active:cursor-grabbing";
    host.appendChild(canvas);

    // Root Globe Group
    const globe = new THREE.Group();
    globe.rotation.z = -0.16; // Subtle axial tilt
    globe.rotation.y = 0.55;
    scene.add(globe);

    // 1. Generate Choropleth Canvas Texture (Layered Ocean & Contoured Continents)
    const choroplethCanvas = renderChoroplethCanvas(effectiveMarkerList, 2048, 1024, isDark);
    let globeMesh = null;
    let canvasTexture = null;

    if (choroplethCanvas) {
      canvasTexture = new THREE.CanvasTexture(choroplethCanvas);
      canvasTexture.colorSpace = THREE.SRGBColorSpace;
      canvasTexture.wrapS = THREE.RepeatWrapping;
      canvasTexture.wrapT = THREE.ClampToEdgeWrapping;

      // High-contrast, beautifully sculpted 3D globe material for both light and dark mode
      const globeMat = new THREE.MeshPhongMaterial({
        map: canvasTexture,
        shininess: isDark ? 36 : 45,
        specular: isDark ? 0x445566 : 0x2563eb,
        emissive: isDark ? 0x070c18 : 0x1e293b,
        emissiveIntensity: isDark ? 0.2 : 0.08,
      });

      const globeGeo = new THREE.SphereGeometry(RADIUS, 64, 64);
      globeMesh = new THREE.Mesh(globeGeo, globeMat);
      globe.add(globeMesh);
      stateRef.current.globeMesh = globeMesh;
    }

    // 2. Crisp 3D Country Vector Borders
    const bordersGeo = createCountryBordersGeometry(SURFACE);
    const bordersMat = new THREE.LineBasicMaterial({
      color: isDark ? 0xffffff : 0x2563eb,
      transparent: true,
      opacity: isDark ? 0.8 : 0.45,
      linewidth: 1,
    });
    const bordersMesh = new THREE.LineSegments(bordersGeo, bordersMat);
    globe.add(bordersMesh);

    // 3. Precision Graticule Lines (Equator, Tropics, Meridians)
    const graticuleGeo = createGraticuleGeometry(SURFACE * 1.0008);
    const graticuleMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: isDark ? 0.18 : 0.16,
    });
    const graticuleMesh = new THREE.LineSegments(graticuleGeo, graticuleMat);
    globe.add(graticuleMesh);

    // 4. Atmospheric Outer Rim Glow Sphere
    const haloGeo = new THREE.SphereGeometry(RADIUS * 1.02, 48, 48);
    const haloMat = new THREE.MeshBasicMaterial({
      color: isDark ? 0x38bdf8 : 0x3b82f6,
      transparent: true,
      opacity: isDark ? 0.18 : 0.14,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    const haloMesh = new THREE.Mesh(haloGeo, haloMat);
    globe.add(haloMesh);

    // 5. Curved 3D Network Arcs with Animated Photons & Surface Nodes
    const arcGroup = new THREE.Group();
    globe.add(arcGroup);
    const arcAnimators = [];

    const liveCodes = new Set((markers || []).map((m) => m?.country).filter(Boolean));
    const activeLinks = NETWORK_LINKS.filter(
      (link) => liveCodes.has(link.from) || liveCodes.has(link.to)
    );
    activeLinks.forEach((link, idx) => {
      const metaFrom = countryMeta(link.from);
      const metaTo = countryMeta(link.to);
      if (!metaFrom || !metaTo) return;

      const p1 = latLngToVector(metaFrom.lat, metaFrom.lng, SURFACE);
      const p2 = latLngToVector(metaTo.lat, metaTo.lng, SURFACE);

      const dist = p1.distanceTo(p2);
      const mid = p1.clone().add(p2).multiplyScalar(0.5);
      const altitude = RADIUS * (1 + 0.14 + dist * 0.12);
      mid.normalize().multiplyScalar(altitude);

      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      const curvePoints = curve.getPoints(44);

      // Arc line
      const lineGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
      });
      const arcLine = new THREE.Line(lineGeo, lineMat);
      arcGroup.add(arcLine);

      // Surface Anchor Nodes
      [p1, p2].forEach((pos) => {
        const nodeGeo = new THREE.SphereGeometry(0.016, 12, 12);
        const nodeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
        nodeMesh.position.copy(pos);
        arcGroup.add(nodeMesh);

        // Surface ring
        const ringGeo = new THREE.RingGeometry(0.022, 0.028, 20);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.position.copy(pos.clone().multiplyScalar(1.002));
        ringMesh.lookAt(pos.clone().multiplyScalar(2));
        arcGroup.add(ringMesh);
      });

      // Animated traveling photon particle
      const photonGeo = new THREE.SphereGeometry(0.018, 12, 12);
      const photonMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        blending: THREE.AdditiveBlending,
      });
      const photon = new THREE.Mesh(photonGeo, photonMat);
      arcGroup.add(photon);

      arcAnimators.push({
        curve,
        mesh: photon,
        speed: 0.35 + (idx % 3) * 0.08,
        offset: (idx * 0.23) % 1,
      });
    });

    // 6. Balanced Lighting Setup: Soft Sun + Ambient + Fill (No Glare Blowout)
    const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 1.3 : 1.05);
    scene.add(ambientLight);

    // Primary gentle sun light (creates clean, subtle specular highlight)
    const dirLight = new THREE.DirectionalLight(0xffffff, isDark ? 1.25 : 0.85);
    dirLight.position.set(5.0, 4.5, 3.5);
    scene.add(dirLight);

    // Subtle atmospheric rim fill from opposite angle
    const rimLight = new THREE.DirectionalLight(0x93c5fd, isDark ? 0.65 : 0.45);
    rimLight.position.set(-3.5, -2.0, -3.0);
    scene.add(rimLight);

    // Store state in ref
    stateRef.current.globe = globe;
    stateRef.current.camera = camera;
    stateRef.current.renderer = renderer;

    // Interaction Handlers (Mouse & Touch Drag)
    const onPointerDown = (e) => {
      stateRef.current.pointerDown = true;
      stateRef.current.isInteracting = true;
      stateRef.current.prevPointer = { x: e.clientX, y: e.clientY };
      stateRef.current.velX = 0;
      stateRef.current.velY = 0;
    };

    const onPointerMove = (e) => {
      if (!stateRef.current.pointerDown) return;
      const dx = e.clientX - stateRef.current.prevPointer.x;
      const dy = e.clientY - stateRef.current.prevPointer.y;
      stateRef.current.prevPointer = { x: e.clientX, y: e.clientY };

      const rotFactor = 0.005;
      globe.rotation.y += dx * rotFactor;
      globe.rotation.x = THREE.MathUtils.clamp(
        globe.rotation.x + dy * rotFactor,
        -0.85,
        0.85,
      );

      stateRef.current.velY = dx * rotFactor;
      stateRef.current.velX = dy * rotFactor;
    };

    const onPointerUp = () => {
      stateRef.current.pointerDown = false;
      setTimeout(() => {
        stateRef.current.isInteracting = false;
      }, 1500);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    // Resize Observer with dynamic distance fitting
    const resizeObserver = new ResizeObserver(() => {
      if (!host || !renderer || !camera) return;
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w === 0 || h === 0) return;
      const newAspect = w / h;
      camera.aspect = newAspect;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);

      // Recompute fit distance to guarantee zero edge clipping
      stateRef.current.baseDistance = getFitDistance(newAspect, CAMERA_VFOV);
    });
    resizeObserver.observe(host);

    // Animation Loop
    let animId = null;
    const clock = new THREE.Clock();
    const tempVec = new THREE.Vector3();
    const camDir = new THREE.Vector3();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Camera distance with fit guarantee + user zoom
      const currentBaseDist = stateRef.current.baseDistance || 4.2;
      const targetDist = currentBaseDist / THREE.MathUtils.clamp(zoomRef.current, 0.75, 1.5);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetDist, 0.08);

      // Handle rotation and inertia
      if (stateRef.current.pointerDown) {
        // Dragging directly controls globe
      } else if (stateRef.current.isInteracting) {
        // Inertia dampening
        globe.rotation.y += stateRef.current.velY;
        globe.rotation.x = THREE.MathUtils.clamp(
          globe.rotation.x + stateRef.current.velX,
          -0.85,
          0.85,
        );
        stateRef.current.velY *= 0.94;
        stateRef.current.velX *= 0.94;
      } else {
        // Auto-rotation when active
        if (autoRotateRef.current) {
          globe.rotation.y += 0.0035;
        }
        // Smooth lerp to target focus if set
        if (selectedRef.current) {
          globe.rotation.y = THREE.MathUtils.lerp(
            globe.rotation.y,
            stateRef.current.targetRotY,
            0.05,
          );
          globe.rotation.x = THREE.MathUtils.lerp(
            globe.rotation.x,
            stateRef.current.targetRotX,
            0.05,
          );
        }
      }

      // Animate arc traveling photon particles
      arcAnimators.forEach(({ curve, mesh, speed, offset }) => {
        const t = (elapsedTime * speed + offset) % 1;
        mesh.position.copy(curve.getPoint(t));
      });

      // Project 3D country pin locations onto 2D screen coordinates
      const activePins = stateRef.current.activePins || [];
      if (activePins.length > 0) {
        const projected = [];
        const hostWidth = host.clientWidth;
        const hostHeight = host.clientHeight;
        camera.getWorldDirection(camDir);

        for (let i = 0; i < activePins.length; i += 1) {
          const pin = activePins[i];
          tempVec.copy(pin.surfacePos);
          tempVec.applyMatrix4(globe.matrixWorld);

          // Dot product test: only render pins on the side facing the camera
          const surfaceNormal = tempVec.clone().normalize();
          const toCamera = camera.position.clone().sub(tempVec).normalize();
          const dot = surfaceNormal.dot(toCamera);

          if (dot > 0.08) {
            tempVec.project(camera);
            const x = ((tempVec.x + 1) / 2) * hostWidth;
            const y = ((-tempVec.y + 1) / 2) * hostHeight;

            projected.push({
              code: pin.code,
              name: pin.name,
              visitors: pin.visitors,
              percent: pin.percent,
              flag: pin.flag,
              flagUrl: pin.flagUrl,
              x,
              y,
              dot,
            });
          }
        }
        setPinPositions(projected);
      } else {
        setPinPositions([]);
      }

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      disposeHierarchy(globe);
      canvasTexture?.dispose();
      renderer.dispose();
      stateRef.current.globeMesh = null;
      if (host.contains(canvas)) {
        host.removeChild(canvas);
      }
    };
  }, [isDark]);

  // Refresh the choropleth texture when live visitor data changes, without
  // rebuilding the whole WebGL scene (the realtime page polls every few seconds).
  useEffect(() => {
    const globeMesh = stateRef.current.globeMesh;
    if (!globeMesh) return;
    const nextCanvas = renderChoroplethCanvas(effectiveMarkerList, 2048, 1024, isDark);
    if (!nextCanvas) return;
    const texture = new THREE.CanvasTexture(nextCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    const previous = globeMesh.material.map;
    globeMesh.material.map = texture;
    globeMesh.material.needsUpdate = true;
    if (previous) previous.dispose();
  }, [effectiveMarkerList, isDark]);

  return (
    <div className="relative h-full w-full select-none" ref={hostRef}>
      {/* 1. Soft Realistic Pedestal Drop Shadow underneath the floating globe */}
      <div
        className={cn(
          "pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 h-14 w-[54%] rounded-[100%] blur-2xl",
          isDark ? "bg-white/5" : "bg-primary/10"
        )}
        aria-hidden="true"
      />
      <div
        className={cn(
          "pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2 h-8 w-[38%] rounded-[100%] blur-lg",
          isDark ? "bg-white/10" : "bg-slate-900/15"
        )}
        aria-hidden="true"
      />

      {/* 2. Projected Country Flag Pins Layer */}
      {pinPositions.map((pin) => {
        const isHovered = hoveredCountry === pin.code;
        const isSelected = selectedCountry === pin.code;

        return (
          <div
            key={pin.code}
            style={{
              transform: `translate3d(${pin.x}px, ${pin.y}px, 0)`,
              zIndex: isSelected ? 40 : isHovered ? 30 : 20,
              opacity: THREE.MathUtils.clamp((pin.dot - 0.08) * 3, 0.4, 1.0),
            }}
            className="pointer-events-none absolute left-0 top-0 will-change-transform"
          >
            {/* Pulsing Surface Contact Anchor */}
            <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.9)] animate-ping" />
            <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full border border-white bg-primary" />

            {/* Vertical Stem connecting surface anchor to pin badge */}
            <div
              style={{ height: `${STEM_HEIGHT}px` }}
              className="absolute left-[-0.5px] bottom-0 w-[1.5px] bg-gradient-to-t from-white/90 to-white/40 shadow-xs"
            />

            {/* Floating Circular Pin Badge */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectCountry?.(pin.code);
              }}
              onMouseEnter={() => setHoveredCountry(pin.code)}
              onMouseLeave={() => setHoveredCountry(null)}
              style={{ bottom: `${STEM_HEIGHT}px` }}
              className={cn(
                "pointer-events-auto absolute -translate-x-1/2 flex items-center justify-center rounded-full transition-all duration-150 active:scale-90",
                "h-7 w-7 border-2 shadow-lg backdrop-blur-md cursor-pointer overflow-hidden bg-white dark:bg-card",
                isSelected
                  ? "border-primary ring-4 ring-primary/30 scale-125 z-30"
                  : isHovered
                    ? "border-primary ring-2 ring-primary/40 scale-115 z-20"
                    : "border-white hover:scale-110 shadow-black/25"
              )}
              title={`${pin.name}: ${pin.visitors.toLocaleString()} active visitors (${pin.percent}%)`}
              aria-label={`${pin.name}: ${pin.visitors.toLocaleString()} active visitors (${pin.percent}%)`}
            >
              <CountryFlagBadge
                code={pin.code}
                name={pin.name}
                flag={pin.flag}
                url={pin.flagUrl}
              />
            </button>

            {/* Live Interactive Hover / Selected Tooltip Card */}
            {(isHovered || isSelected) && (
              <div
                style={{ bottom: `${STEM_HEIGHT + 34}px` }}
                className={cn(
                  "pointer-events-auto absolute -translate-x-1/2 whitespace-nowrap rounded-xl border px-3 py-1.5 shadow-xl transition-all duration-150 animate-in fade-in zoom-in-95",
                  isDark
                    ? "border-border/80 bg-card/95 text-foreground shadow-black/60"
                    : "border-border bg-card/95 text-foreground shadow-slate-900/15"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="h-4 w-5.5 shrink-0 overflow-hidden rounded-xs border border-border/60 shadow-xs">
                    <CountryFlagBadge
                      code={pin.code}
                      name={pin.name}
                      flag={pin.flag}
                      url={pin.flagUrl}
                    />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold leading-none tracking-tight">{pin.name}</span>
                      <span className="rounded bg-primary/15 px-1 py-0.2 text-[9px] font-semibold text-primary">
                        {pin.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                      <span className="font-semibold text-foreground tabular-nums">
                        {pin.visitors.toLocaleString()}
                      </span>
                      <span>visitors</span>
                      <span>•</span>
                      <span className="text-primary font-medium tabular-nums">{pin.percent}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

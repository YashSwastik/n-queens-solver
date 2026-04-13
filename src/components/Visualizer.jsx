import { useSearchParams, useNavigate } from "react-router-dom";
import { Suspense, useState, useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// Pre-warm queen GLB (no longer need chessboard.glb)
useGLTF.preload("/models/queen.glb");

// ─── Layout constants ─────────────────────────────────────────────────────────
const TILE_SIZE  = 1.0;    // one world unit per tile
const TILE_H     = 0.15;   // tile box height — thick enough to see from any angle
const SURFACE_Y  = TILE_H / 2; // y of the top tile surface (tiles centred at y=0)
const BORDER_PAD = 0.6;    // extra width beyond the grid on each side for the frame
const BORDER_H   = 0.22;   // frame box height (taller than tiles, peeks below)
// NOTE: module-level Three.js objects are NOT created here — they must be
// inside useMemo / components to survive HMR and avoid stale-state bugs.

// ─── N-Queens backtracking solver ─────────────────────────────────────────────
function solveNQueens(n) {
  const solutions = [];
  const cols = new Set(), d1 = new Set(), d2 = new Set();
  function bt(row, p) {
    if (row === n) { solutions.push([...p]); return; }
    for (let c = 0; c < n; c++) {
      if (cols.has(c) || d1.has(row - c) || d2.has(row + c)) continue;
      cols.add(c); d1.add(row - c); d2.add(row + c);
      p[row] = c;
      bt(row + 1, p);
      cols.delete(c); d1.delete(row - c); d2.delete(row + c);
    }
  }
  bt(0, Array(n).fill(0));
  return solutions;
}

// ─── Queen position helper ────────────────────────────────────────────────────
// Same formula used by both the board and each queen — guaranteed alignment.
function tileCenter(idx, n) {
  return (idx - n / 2) * TILE_SIZE + TILE_SIZE / 2;
}

// ─── ProceduralBoard ─────────────────────────────────────────────────────────
// Generates a proper NxN alternating-color grid + frame — all via useMemo so
// Three.js objects are never stale across HMR / remounts.
function ProceduralBoard({ n }) {
  // Geometries
  const tileGeom  = useMemo(() => new THREE.BoxGeometry(TILE_SIZE, TILE_H, TILE_SIZE), []);
  const frameGeom = useMemo(() => {
    const fw = n * TILE_SIZE + BORDER_PAD * 2;
    return new THREE.BoxGeometry(fw, BORDER_H, fw);
  }, [n]);

  // Materials — created once, pure black/white for maximum chess contrast
  const matLight  = useMemo(() => new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.6 }), []);
  const matDark   = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.6 }), []);
  const matFrame  = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d4b896", roughness: 0.5 }), []);

  // Tile positions + colors — recomputed only when n changes
  const tiles = useMemo(() => {
    const arr = [];
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        arr.push({
          x: (col - n / 2) * TILE_SIZE + TILE_SIZE / 2,
          z: (row - n / 2) * TILE_SIZE + TILE_SIZE / 2,
          light: (row + col) % 2 === 0,
        });
      }
    }
    return arr;
  }, [n]);

  // Frame sits flush below tiles:
  // tiles top at +TILE_H/2, tiles bottom at -TILE_H/2
  // frame centred so its top = tile bottom → frame y = -(TILE_H/2 + BORDER_H/2)
  const frameY = -(TILE_H / 2 + BORDER_H / 2);

  return (
    <group>
      {/* Frame / border behind & below the grid */}
      <mesh geometry={frameGeom} material={matFrame} position={[0, frameY, 0]} receiveShadow />

      {/* NxN tile grid — each tile a flat box, centred at (0,0,0) */}
      {tiles.map(({ x, z, light }, i) => (
        <mesh
          key={i}
          geometry={tileGeom}
          material={light ? matLight : matDark}
          position={[x, 0, z]}
          receiveShadow
        />
      ))}
    </group>
  );
}

// ─── buildQueenClone ─────────────────────────────────────────────────────────
// Clones the queen GLB — NO material overrides, original color preserved.
function buildQueenClone(scene) {
  const s = scene.clone(true);

  const box0 = new THREE.Box3().setFromObject(s);
  const sz   = new THREE.Vector3();
  box0.getSize(sz);

  // Scale queen to 78% of tile height
  s.scale.setScalar(0.78 / (sz.y || 1));

  // Center XZ, sit base at local y = 0
  const box1 = new THREE.Box3().setFromObject(s);
  const ctr  = new THREE.Vector3();
  box1.getCenter(ctr);
  s.position.x -= ctr.x;
  s.position.z -= ctr.z;
  s.position.y -= box1.min.y;

  // Enable shadows — do NOT touch materials
  s.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  return s;
}

// ─── Easing ──────────────────────────────────────────────────────────────────
function easeOutCubic(t) {
  return 1 - Math.pow(1 - Math.min(t, 1), 3);
}

// ─── QueenPiece ───────────────────────────────────────────────────────────────
// animMode = "drop"  → falls from above on mount (staggered by dropDelay ms)
// animMode = "lerp"  → slides smoothly when targetX / targetZ change
function QueenPiece({ targetX, targetZ, animMode, dropDelay }) {
  const { scene } = useGLTF("/models/queen.glb");
  const groupRef  = useRef();

  // One clone per queen — never rebuilt during Prev/Next navigation
  const cloned = useMemo(() => buildQueenClone(scene), [scene]);

  const DROP_H    = SURFACE_Y + 10;  // start 10 units above the board
  const DROP_DUR  = 0.65;            // seconds for the drop
  const delayS    = (dropDelay ?? 0) / 1000;

  const elapsed  = useRef(0);
  const dropDone = useRef(animMode !== "drop");

  const curX = useRef(targetX);
  const curZ = useRef(targetZ);
  const tgtX = useRef(targetX);
  const tgtZ = useRef(targetZ);

  useEffect(() => {
    tgtX.current = targetX;
    tgtZ.current = targetZ;
  }, [targetX, targetZ]);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;

    // Lerp XZ in all modes (handles "lerp" navigation; no-op during drop since tgt===cur)
    const k = 1 - Math.pow(0.005, delta); // ~0.9 s settle
    curX.current += (tgtX.current - curX.current) * k;
    curZ.current += (tgtZ.current - curZ.current) * k;

    if (animMode === "drop" && !dropDone.current) {
      elapsed.current += delta;

      if (elapsed.current < delayS) {
        g.visible = false;
        g.position.set(curX.current, DROP_H, curZ.current);
        return;
      }

      g.visible = true;
      const t = (elapsed.current - delayS) / DROP_DUR;
      const y = DROP_H + (SURFACE_Y - DROP_H) * easeOutCubic(t);
      g.position.set(curX.current, y, curZ.current);

      if (t >= 1) {
        dropDone.current = true;
        g.position.set(curX.current, SURFACE_Y, curZ.current);
      }
    } else {
      g.visible = true;
      g.position.set(curX.current, SURFACE_Y, curZ.current);
    }
  });

  return (
    <group ref={groupRef} position={[targetX, DROP_H, targetZ]} visible={false}>
      <primitive object={cloned} />
    </group>
  );
}

// ─── ChessScene ───────────────────────────────────────────────────────────────
function ChessScene({ n, solution, animMode, mountKey }) {
  return (
    <>
      {/* Lighting — ambient raised so dark tiles stay visible; directional for depth */}
      <ambientLight intensity={0.75} color="#ffffff" />
      <directionalLight
        position={[n * 0.7, n * 2.0, n * 0.7]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={n * 8}
        shadow-camera-left={-(n + 2)}
        shadow-camera-right={n + 2}
        shadow-camera-top={n + 2}
        shadow-camera-bottom={-(n + 2)}
      />
      <directionalLight position={[-n * 0.5, n * 0.8, -n * 0.5]} intensity={0.25} color="#c8d8ff" />
      <pointLight position={[0, n * 2, 0]} intensity={0.5} color="#fff8e0" distance={n * 10} decay={2} />

      {/* Dynamically generated board — no GLB needed */}
      <ProceduralBoard n={n} />

      {/* Queens — one per row, keyed so they remount only on N change */}
      {solution.map((col, row) => (
        <QueenPiece
          key={`${mountKey}-${row}`}
          targetX={tileCenter(col, n)}
          targetZ={tileCenter(row, n)}
          animMode={animMode}
          dropDelay={row * 110}
        />
      ))}

      <OrbitControls
        enableDamping
        dampingFactor={0.06}
        minDistance={n * 0.9}
        maxDistance={n * 4.5}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, SURFACE_Y * 0.5, 0]}
      />
    </>
  );
}

// ─── CameraRig ───────────────────────────────────────────────────────────────
// Camera positioned at ~65° above horizontal so tiles read as squares, not lines.
function CameraRig({ n }) {
  const { camera } = useThree();
  useEffect(() => {
    const h = n * 2.2;   // high enough to see the whole board as a clear grid
    const d = n * 1.1;   // relatively close — steep overhead-ish angle
    camera.position.set(0, h, d);
    camera.lookAt(0, 0, 0);
  }, [n]); // eslint-disable-line
  return null;
}

// ─── Visualizer page ─────────────────────────────────────────────────────────
export default function Visualizer() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();

  const rawN = parseInt(searchParams.get("n") ?? "8");
  const n    = Math.max(1, Math.min(20, isNaN(rawN) ? 8 : rawN));

  const solutions = useMemo(() => solveNQueens(n), [n]);
  const [idx,      setIdx]      = useState(0);
  const [animMode, setAnimMode] = useState("drop");
  const [mountKey, setMountKey] = useState(0);

  useEffect(() => {
    setIdx(0);
    setAnimMode("drop");
    setMountKey((k) => k + 1);
  }, [n]);

  const prev = () => { setAnimMode("lerp"); setIdx((i) => (i - 1 + solutions.length) % solutions.length); };
  const next = () => { setAnimMode("lerp"); setIdx((i) => (i + 1) % solutions.length); };

  const current = solutions[idx] ?? [];

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#080810", position: "relative", overflow: "hidden" }}>

      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, n * 2.2, n * 1.1], fov: 45 }}
        style={{ position: "absolute", inset: 0 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={["#080810"]} />
        <fog attach="fog" args={["#080810", n * 4, n * 10]} />
        <CameraRig n={n} />
        {/* ProceduralBoard is pure Three.js — no Suspense needed for the board */}
        {/* useGLTF for queen still needs Suspense */}
        <Suspense fallback={null}>
          {solutions.length > 0 && (
            <ChessScene
              n={n}
              solution={current}
              animMode={animMode}
              mountKey={mountKey}
            />
          )}
        </Suspense>
      </Canvas>

      {/* ── Top bar ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, padding: "18px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "linear-gradient(to bottom, rgba(8,8,16,0.92) 65%, transparent)",
        zIndex: 10, fontFamily: "'Inter', sans-serif",
      }}>
        <button id="back-btn" onClick={() => navigate("/")}
          style={navBtn}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, navBtnHover)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, navBtn)}>
          ← Back
        </button>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
          <span style={{ fontSize: "0.6rem", letterSpacing: "0.32em", color: "rgba(226,201,126,0.5)", textTransform: "uppercase", fontFamily: "'Inter', sans-serif" }}>
            N-Queens Visualizer
          </span>
          <span style={{ fontSize: "1.12rem", fontWeight: 700, color: "#f5e6b0", fontFamily: "'Inter', sans-serif" }}>
            {n} × {n} Board
          </span>
        </div>

        <span style={{ color: "rgba(255,255,255,0.28)", fontSize: "0.78rem", fontFamily: "'Inter', sans-serif" }}>
          {solutions.length === 0
            ? "No solutions"
            : `${solutions.length} solution${solutions.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* ── Bottom controls ── */}
      {solutions.length > 0 && (
        <div style={{
          position: "absolute", bottom: "28px", left: "50%", transform: "translateX(-50%)",
          zIndex: 10, display: "flex", alignItems: "center", gap: "18px",
          background: "rgba(10,10,18,0.84)", border: "1px solid rgba(226,201,126,0.17)",
          borderRadius: "22px", padding: "13px 26px",
          backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
          fontFamily: "'Inter', sans-serif",
          boxShadow: "0 8px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}>
          <button id="prev-btn" onClick={prev} style={ctrlBtn}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, ctrlBtnHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, ctrlBtn)}>
            ← Prev
          </button>

          <div style={{ textAlign: "center", minWidth: "96px" }}>
            <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#e2c97e", lineHeight: 1 }}>
              {idx + 1}
              <span style={{ fontSize: "0.7rem", color: "rgba(226,201,126,0.4)", fontWeight: 400 }}>
                {" "}/ {solutions.length}
              </span>
            </div>
            <div style={{ fontSize: "0.58rem", letterSpacing: "0.2em", color: "rgba(255,255,255,0.26)", textTransform: "uppercase", marginTop: "3px" }}>
              Solution
            </div>
          </div>

          <button id="next-btn" onClick={next} style={ctrlBtn}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, ctrlBtnHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, ctrlBtn)}>
            Next →
          </button>
        </div>
      )}

      {/* No solutions */}
      {solutions.length === 0 && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Inter', sans-serif", color: "rgba(255,255,255,0.38)", fontSize: "1.15rem",
        }}>
          No solutions exist for N = {n}
        </div>
      )}

      {/* Placement mini-map */}
      {solutions.length > 0 && n <= 12 && (
        <div style={{
          position: "absolute", top: "76px", right: "22px", zIndex: 10,
          background: "rgba(10,10,20,0.76)", border: "1px solid rgba(226,201,126,0.12)",
          borderRadius: "14px", padding: "12px 14px", backdropFilter: "blur(14px)",
          fontFamily: "'Inter', sans-serif",
        }}>
          <div style={{ fontSize: "0.57rem", letterSpacing: "0.22em", color: "rgba(226,201,126,0.42)", textTransform: "uppercase", marginBottom: "8px" }}>
            Placement
          </div>
          <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", maxWidth: `${n * 23}px` }}>
            {current.map((col, row) => (
              <div key={row} style={{
                width: "20px", height: "20px", borderRadius: "4px",
                background: (row + col) % 2 === 0 ? "rgba(240,217,181,0.22)" : "rgba(181,136,99,0.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "9px", color: "#e2c97e",
              }}>♛</div>
            ))}
          </div>
        </div>
      )}

      {/* Orbit hint */}
      <div style={{
        position: "absolute", bottom: "86px", left: "50%", transform: "translateX(-50%)",
        fontSize: "0.6rem", color: "rgba(255,255,255,0.18)", letterSpacing: "0.15em",
        textTransform: "uppercase", zIndex: 10, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap",
      }}>
        Drag to orbit · Scroll to zoom
      </div>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');`}</style>
    </div>
  );
}

// ── Style tokens ──────────────────────────────────────────────────────────────
const navBtn = {
  padding: "8px 17px", fontSize: "0.83rem", fontWeight: 600, fontFamily: "'Inter', sans-serif",
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "10px", color: "rgba(255,255,255,0.62)", cursor: "pointer", transition: "all 0.14s ease",
};
const navBtnHover = { ...navBtn, background: "rgba(255,255,255,0.12)", color: "#fff" };

const ctrlBtn = {
  padding: "9px 21px", fontSize: "0.86rem", fontWeight: 700, fontFamily: "'Inter', sans-serif",
  background: "rgba(226,201,126,0.07)", border: "1px solid rgba(226,201,126,0.2)",
  borderRadius: "12px", color: "#e2c97e", cursor: "pointer", transition: "all 0.14s ease",
};
const ctrlBtnHover = { ...ctrlBtn, background: "rgba(226,201,126,0.17)", boxShadow: "0 0 14px rgba(201,162,39,0.26)" };

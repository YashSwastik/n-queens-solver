import { useEffect, useRef, useState } from "react";

const TOTAL_FRAMES = 240;
const FRAME_BASE = "/frames/ezgif-frame-";

function padded(n) {
  return String(n).padStart(3, "0");
}

/**
 * ScrollCanvas
 * @param {function} onProgress  - called with scroll progress 0→1 on every scroll event
 */
export default function ScrollCanvas({ onProgress }) {
  const canvasRef = useRef(null);
  const imagesRef = useRef([]);
  const frameIndexRef = useRef(0);
  const rafRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  // ── Preload all 240 frames ──────────────────────────────────────────────────
  useEffect(() => {
    let loadedCount = 0;
    const images = Array(TOTAL_FRAMES);

    const onDone = () => {
      imagesRef.current = images;
      setLoaded(true);
    };

    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      const idx = i - 1;
      img.src = `${FRAME_BASE}${padded(i)}.png`;

      const tick = () => {
        images[idx] = img;
        loadedCount++;
        setLoadProgress(Math.round((loadedCount / TOTAL_FRAMES) * 100));
        if (loadedCount === TOTAL_FRAMES) onDone();
      };

      img.onload = tick;
      img.onerror = tick; // still count so we never stall
    }
  }, []);

  // ── Draw a single frame (contain-fit) ──────────────────────────────────────
  const drawFrame = (index) => {
    const canvas = canvasRef.current;
    const images = imagesRef.current;
    if (!canvas) return;

    const img = images[index];
    if (!img) return;

    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    const iW = img.naturalWidth || img.width;
    const iH = img.naturalHeight || img.height;
    if (!iW || !iH) return;

    const scale = Math.min(W / iW, H / iH);
    const drawW = iW * scale;
    const drawH = iH * scale;
    ctx.drawImage(img, (W - drawW) / 2, (H - drawH) / 2, drawW, drawH);
  };

  // ── Scroll → frame index ────────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;

    const onScroll = () => {
      const scrollTop = window.scrollY;
      const maxScroll = document.body.scrollHeight - window.innerHeight;
      const progress = maxScroll > 0 ? Math.max(0, Math.min(1, scrollTop / maxScroll)) : 0;

      // Notify parent (Landing) about scroll progress for scrolltelling
      onProgress?.(progress);

      const frameIndex = Math.min(
        Math.floor(progress * TOTAL_FRAMES),
        TOTAL_FRAMES - 1
      );

      if (frameIndex !== frameIndexRef.current) {
        frameIndexRef.current = frameIndex;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => drawFrame(frameIndex));
      }
    };

    drawFrame(0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [loaded, onProgress]);

  // ── Resize → redraw ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;

    const onResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      drawFrame(frameIndexRef.current);
    };

    // Set initial size
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    drawFrame(0);

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [loaded]);

  // ── Initial canvas size (before load completes) ────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: 0,
          background: "#0a0a0f",
        }}
      />

      {/* Loading overlay */}
      {!loaded && (
        <div style={{
          position: "fixed",
          top: 0, left: 0,
          width: "100vw", height: "100vh",
          zIndex: 50,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "#0a0a0f",
          gap: "1.5rem",
          fontFamily: "'Inter', sans-serif",
        }}>
          <div style={{
            fontSize: "1rem", letterSpacing: "0.18em",
            textTransform: "uppercase", color: "#e2c97e",
          }}>
            Loading… {loadProgress}%
          </div>
          <div style={{
            width: "220px", height: "3px",
            background: "rgba(255,255,255,0.08)",
            borderRadius: "9999px", overflow: "hidden",
          }}>
            <div style={{
              width: `${loadProgress}%`, height: "100%",
              background: "linear-gradient(90deg, #c9a227, #e2c97e)",
              borderRadius: "9999px",
              transition: "width 0.15s ease",
            }} />
          </div>
        </div>
      )}
    </>
  );
}

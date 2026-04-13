import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ScrollCanvas from "./ScrollCanvas";

// ── Scrolltelling section definitions ────────────────────────────────────────
// Each section has: the scroll range it's active in, heading, subtext, and
// which side of the viewport to anchor to.
const SECTIONS = [
  {
    // 0% – 35%: fade in quickly, hold long, fade near 35%
    start: 0.0,  fadeInEnd: 0.06, fadeOutStart: 0.28, end: 0.35,
    heading: "N-Queens Visualizer",
    sub: "A visual journey through logic",
    align: "left",
  },
  {
    // 25% – 60%
    start: 0.25, fadeInEnd: 0.31, fadeOutStart: 0.54, end: 0.60,
    heading: "Understand the problem",
    sub: "Every queen must be safe",
    align: "left",
  },
  {
    // 50% – 80%
    start: 0.50, fadeInEnd: 0.56, fadeOutStart: 0.74, end: 0.80,
    heading: "Watch the board evolve",
    sub: "Step into the algorithm",
    align: "right",
  },
  {
    // 75% – 100%
    start: 0.75, fadeInEnd: 0.81, fadeOutStart: 0.94, end: 1.00,
    heading: "Solutions come alive",
    sub: "See logic in motion",
    align: "left",
  },
];

/**
 * Given current scroll progress and a section definition,
 * returns { opacity, translateY } for CSS animation.
 */
function sectionStyle(progress, section) {
  const { start, fadeInEnd, fadeOutStart, end } = section;

  let opacity = 0;
  let ty = 24;

  if (progress < start || progress > end) return { opacity: 0, ty: 24 };

  if (progress <= fadeInEnd) {
    // Fade in
    const t = easeInOut((progress - start) / Math.max(0.001, fadeInEnd - start));
    opacity = t;
    ty = 24 * (1 - t);
  } else if (progress <= fadeOutStart) {
    // Hold at full opacity
    opacity = 1;
    ty = 0;
  } else {
    // Fade out
    const t = easeInOut((progress - fadeOutStart) / Math.max(0.001, end - fadeOutStart));
    opacity = 1 - t;
    ty = -16 * t;
  }

  return { opacity, ty };
}

function easeInOut(t) {
  t = Math.max(0, Math.min(1, t));
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** CTA section opacity: fades in after 92% scroll */
function ctaOpacity(progress) {
  if (progress < 0.92) return 0;
  return Math.min(1, (progress - 0.92) / 0.06);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Landing() {
  const [n, setN] = useState(8);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();

  // Stable callback ref so ScrollCanvas doesn't re-subscribe on every render
  const onProgress = useCallback((p) => setProgress(p), []);

  const handleSolve = () => {
    const val = parseInt(n);
    if (!isNaN(val) && val >= 1 && val <= 20) {
      navigate(`/visualizer?n=${val}`);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSolve();
  };

  const ctaVisible = ctaOpacity(progress);

  return (
    <div style={{ position: "relative", height: "400vh", background: "transparent" }}>

      {/* Frame-based scroll animation */}
      <ScrollCanvas onProgress={onProgress} />

      {/* ── Sticky viewport layer (scrolltelling + scroll hint) ── */}
      <div style={{
        position: "sticky",
        top: 0,
        height: "100vh",
        zIndex: 5,
        pointerEvents: "none",
      }}>

        {/* Scroll-hint: hide after first 10% */}
        <div style={{
          position: "absolute",
          bottom: "36px",
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "6px",
          opacity: Math.max(0, 1 - progress / 0.1) * 0.55,
          transition: "opacity 0.3s",
          pointerEvents: "none",
        }}>
          <div style={{
            width: "1px", height: "40px",
            background: "linear-gradient(to bottom, rgba(226,201,126,0), rgba(226,201,126,0.9))",
            animation: "scrollPulse 1.8s ease-in-out infinite",
          }} />
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: "0.62rem", letterSpacing: "0.28em",
            textTransform: "uppercase", color: "rgba(226,201,126,0.8)",
          }}>Scroll</span>
        </div>

        {/* Scrolltelling text panels */}
        {SECTIONS.map((section, i) => {
          const { opacity, ty } = sectionStyle(progress, section);
          const isRight = section.align === "right";

          return (
            <div key={i} style={{
              position: "absolute",
              bottom: "12vh",
              ...(isRight ? { right: "6vw" } : { left: "6vw" }),
              maxWidth: "min(420px, 42vw)",
              transform: `translateY(${ty}px)`,
              opacity,
              transition: "none", // driven by scroll, not CSS transition
              pointerEvents: "none",
            }}>
              {/* Subtle left border accent */}
              <div style={{
                position: "absolute",
                left: isRight ? "auto" : "-16px",
                right: isRight ? "-16px" : "auto",
                top: "4px",
                width: "2px",
                height: "calc(100% - 8px)",
                background: "linear-gradient(to bottom, #c9a227, rgba(201,162,39,0))",
                borderRadius: "2px",
              }} />

              <p style={{
                margin: "0 0 6px",
                fontFamily: "'Inter', sans-serif",
                fontSize: "0.65rem",
                fontWeight: 600,
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "rgba(226,201,126,0.6)",
              }}>
                {String(i + 1).padStart(2, "0")} / 04
              </p>

              <h2 style={{
                margin: "0 0 12px",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 800,
                fontSize: "clamp(2rem, 4.5vw, 3.4rem)",
                lineHeight: 1.08,
                letterSpacing: "-0.03em",
                color: "#ffffff",
                textShadow: "0 2px 24px rgba(0,0,0,0.8)",
              }}>
                {section.heading}
              </h2>

              <p style={{
                margin: 0,
                fontFamily: "'Inter', sans-serif",
                fontSize: "clamp(0.95rem, 1.8vw, 1.15rem)",
                color: "rgba(255,255,255,0.72)",
                lineHeight: 1.5,
                fontWeight: 400,
                textShadow: "0 1px 12px rgba(0,0,0,0.7)",
              }}>
                {section.sub}
              </p>
            </div>
          );
        })}
      </div>

      {/* ── Bottom CTA section — NOT sticky, lives at page bottom ── */}
      <div style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 6,
        pointerEvents: ctaVisible > 0.05 ? "auto" : "none",
        opacity: ctaVisible,
        // No transition — opacity is driven by scroll state
      }}>
        {/* Glass card */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.6rem",
          padding: "2.8rem 3.2rem",
          background: "rgba(8,8,16,0.72)",
          border: "1px solid rgba(226,201,126,0.18)",
          borderRadius: "24px",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}>
          {/* Crown */}
          <div style={{
            fontSize: "2.4rem",
            lineHeight: 1,
            filter: "drop-shadow(0 0 18px rgba(201,162,39,0.5))",
          }}>♛</div>

          <div style={{ textAlign: "center" }}>
            <h1 style={{
              margin: "0 0 8px",
              fontFamily: "'Inter', sans-serif",
              fontWeight: 800,
              fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
              background: "linear-gradient(135deg, #f5e6b0, #c9a227 60%, #e2c97e)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}>
              Place the Queens.<br />Rule the Board.
            </h1>
            <p style={{
              margin: 0,
              fontFamily: "'Inter', sans-serif",
              color: "rgba(255,255,255,0.38)",
              fontSize: "clamp(0.85rem, 1.6vw, 1rem)",
            }}>
              Choose your board size and explore every solution.
            </p>
          </div>

          {/* N input + button */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <span style={{
                position: "absolute", left: "14px",
                fontFamily: "'Inter', sans-serif",
                fontSize: "0.78rem", fontWeight: 600,
                letterSpacing: "0.08em",
                color: "rgba(226,201,126,0.65)",
                pointerEvents: "none", userSelect: "none",
              }}>N =</span>
              <input
                id="n-input"
                type="number"
                min={1} max={20}
                value={n}
                onChange={(e) => setN(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{
                  paddingLeft: "48px", paddingRight: "14px",
                  paddingTop: "13px", paddingBottom: "13px",
                  width: "130px",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "1.1rem", fontWeight: 700,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(226,201,126,0.28)",
                  borderRadius: "13px",
                  color: "#f5e6b0", outline: "none",
                  appearance: "textfield", MozAppearance: "textfield",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "rgba(226,201,126,0.65)";
                  e.target.style.boxShadow = "0 0 0 3px rgba(201,162,39,0.14)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "rgba(226,201,126,0.28)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>

            <button
              id="see-solutions-btn"
              onClick={handleSolve}
              style={{
                padding: "13px 26px",
                fontFamily: "'Inter', sans-serif",
                fontSize: "0.92rem", fontWeight: 700,
                letterSpacing: "0.03em",
                background: "linear-gradient(135deg, #c9a227, #e2c97e)",
                border: "none", borderRadius: "13px",
                color: "#0a0a0f", cursor: "pointer",
                boxShadow: "0 4px 20px rgba(201,162,39,0.38)",
                transition: "transform 0.14s ease, box-shadow 0.14s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px) scale(1.02)";
                e.currentTarget.style.boxShadow = "0 8px 28px rgba(201,162,39,0.55)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0) scale(1)";
                e.currentTarget.style.boxShadow = "0 4px 20px rgba(201,162,39,0.38)";
              }}
            >
              See Solutions ♛
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        input[type=number]::-webkit-outer-spin-button,
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        @keyframes scrollPulse {
          0%, 100% { opacity: 0.15; transform: scaleY(0.8); }
          50% { opacity: 1; transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}

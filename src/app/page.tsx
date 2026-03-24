"use client";

import React, { Suspense, useEffect, useState, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract } from "wagmi";
import { useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { TRK_GAME_ADDRESS } from "../config";
import TRKGameABI from "../abis/TRKRouter.json";
import RegistrationPanel from "../components/RegistrationPanel";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#03050a] text-white">
          Loading TRK...
        </div>
      }
    >
      <ReferralHandler />
      <Home />
    </Suspense>
  );
}

function ReferralHandler() {
  const searchParams = useSearchParams();
  const [captured, setCaptured] = useState<string | null>(null);
  const [displayCode, setDisplayCode] = useState("");

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      let displayValue = ref;
      let storageValue = ref;
      if (ref.includes("_")) {
        const parts = ref.split("_");
        displayValue = parts[0];
        storageValue = `0x${parts[1]}`;
      } else if (ref.startsWith("0x")) {
        displayValue = `${ref.slice(0, 6)}...${ref.slice(-4)}`;
      }
      localStorage.setItem("referral", storageValue);
      setCaptured(storageValue);
      setDisplayCode(displayValue);
      const t = setTimeout(() => setCaptured(null), 5000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  return (
    <AnimatePresence>
      {captured && (
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          className="fixed top-24 right-4 z-50 pointer-events-none"
        >
          <div className="bg-gradient-to-r from-emerald-600/90 to-green-600/90 backdrop-blur-md border border-green-400/50 text-white px-6 py-4 rounded-2xl shadow-lg flex items-center gap-4">
            <div className="bg-white/20 p-2 rounded-full">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <p className="font-bold text-lg leading-none mb-1">
                Referral Applied!
              </p>
              <p className="text-xs text-green-100 font-mono tracking-wide bg-black/20 px-2 py-1 rounded inline-block">
                CODE: {displayCode}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Home() {
  const { isConnected, address } = useAccount();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: userData } = useReadContract({
    address: TRK_GAME_ADDRESS,
    abi: TRKGameABI.abi,
    functionName: "users",
    args: [address],
    query: { enabled: isConnected && !!address },
  });
  const isRegistered = !!(
    (userData as any[])?.[0] && (userData as any[])[0] > BigInt(0)
  );

  // Particle canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let animId: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      a: number;
    }[] = [];
    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 0.5,
        a: Math.random(),
      });
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(212,175,55,${p.a * 0.5})`;
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  // Reveal on scroll
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("visible");
        });
      },
      { threshold: 0.1 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div
      style={{
        fontFamily: "'Rajdhani', sans-serif",
        background: "#03050a",
        color: "#e8eaf0",
        overflowX: "hidden",
        minHeight: "100vh",
      }}
    >
      {/* Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Rajdhani:wght@300;400;500;600;700&family=Share+Tech+Mono&display=swap');
        :root {
          --gold: #d4af37; --gold-light: #f5d97a; --gold-dim: #8b6914;
          --cyan: #00d4ff; --cyan-dim: #006680;
          --green: #00ff9d; --red: #ff4757;
          --bg-void: #03050a; --bg-deep: #080c14; --bg-card: #0d1321;
          --border: rgba(212,175,55,0.18); --border-cyan: rgba(0,212,255,0.18);
          --text: #e8eaf0; --text-muted: #7a8099; --radius: 12px;
          --glow-gold: 0 0 20px rgba(212,175,55,0.35);
          --glow-cyan: 0 0 20px rgba(0,212,255,0.35);
          --glow-green: 0 0 20px rgba(0,255,157,0.35);
        }
        .trk-orbitron { font-family: 'Orbitron', sans-serif !important; }
        .trk-mono { font-family: 'Share Tech Mono', monospace !important; }
        .reveal { opacity: 0; transform: translateY(40px); transition: all 0.7s ease; }
        .reveal.visible { opacity: 1; transform: translateY(0); }
        @keyframes trkBounce { 0%,100%{transform:rotate(45deg) translateY(0)} 50%{transform:rotate(45deg) translateY(6px)} }
        @keyframes trkFadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes trkGlow { 0%,100%{text-shadow:0 0 20px rgba(212,175,55,0.4)} 50%{text-shadow:0 0 50px rgba(212,175,55,0.8)} }
        .trk-bounce { animation: trkBounce 1.5s infinite; }
        .trk-glow { animation: trkGlow 2s infinite; }
        .trk-fade-1 { animation: trkFadeUp 0.8s ease both; }
        .trk-fade-2 { animation: trkFadeUp 0.9s 0.1s ease both; }
        .trk-fade-3 { animation: trkFadeUp 1s 0.2s ease both; }
        .trk-fade-4 { animation: trkFadeUp 1s 0.3s ease both; }
        .trk-fade-5 { animation: trkFadeUp 1s 0.4s ease both; }
        .trk-fade-6 { animation: trkFadeUp 1s 0.5s ease both; }
        .tech-card { padding:28px; border-radius:var(--radius); border:1px solid var(--border); background:var(--bg-card); position:relative; overflow:hidden; transition:all 0.4s; }
        .tech-card::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,var(--gold),transparent); transform:scaleX(0); transition:transform 0.4s; }
        .tech-card:hover { transform:translateY(-4px); border-color:rgba(212,175,55,0.35); box-shadow:var(--glow-gold); }
        .tech-card:hover::before { transform:scaleX(1); }
        .feat-card { padding:28px 24px; border-radius:var(--radius); border:1px solid var(--border-cyan); background:rgba(0,212,255,0.04); text-align:center; transition:all 0.3s; }
        .feat-card:hover { border-color:var(--cyan); box-shadow:var(--glow-cyan); transform:translateY(-4px); }
        .income-card { border-radius:var(--radius); border:1px solid var(--border); background:var(--bg-card); overflow:hidden; transition:all 0.4s; }
        .income-card:hover { transform:translateY(-6px); box-shadow:0 20px 60px rgba(0,0,0,0.6); }
        .phase-card { border-radius:var(--radius); padding:28px; text-align:center; border:1px solid rgba(0,255,157,0.2); background:rgba(0,255,157,0.04); transition:all 0.3s; }
        .phase-card:hover { border-color:var(--green); box-shadow:var(--glow-green); transform:translateY(-4px); }
        .ref-card { border-radius:var(--radius); padding:24px; text-align:center; border:1px solid var(--border); background:var(--bg-card); transition:all 0.3s; }
        .ref-card:hover { border-color:var(--gold); transform:translateY(-4px); }
        .sec-card { padding:24px; border-radius:var(--radius); text-align:center; border:1px solid var(--border); background:var(--bg-card); transition:all 0.3s; }
        .sec-card:hover { border-color:var(--green); transform:translateY(-3px); }
        .road-item { display:flex; gap:28px; align-items:flex-start; padding:28px 0; position:relative; }
        .tbl-wrap { overflow-x:auto; border-radius:var(--radius); border:1px solid var(--border); }
        .tbl-wrap table { width:100%; border-collapse:collapse; }
        .tbl-wrap thead tr { background:rgba(212,175,55,0.08); }
        .tbl-wrap thead th { padding:14px 18px; text-align:left; font-family:'Share Tech Mono',monospace; font-size:0.72rem; letter-spacing:2px; color:var(--gold); text-transform:uppercase; border-bottom:1px solid var(--border); white-space:nowrap; }
        .tbl-wrap tbody tr { border-bottom:1px solid rgba(255,255,255,0.04); transition:background 0.2s; }
        .tbl-wrap tbody tr:last-child { border-bottom:none; }
        .tbl-wrap tbody tr:hover { background:rgba(212,175,55,0.04); }
        .tbl-wrap td { padding:13px 18px; font-size:0.95rem; color:var(--text); white-space:nowrap; }
        .tbl-dark thead tr { background:rgba(0,212,255,0.08); }
        .tbl-dark thead th { color:var(--cyan); }
        .tbl-green thead tr { background:rgba(0,255,157,0.06); }
        .tbl-green thead th { color:var(--green); }
        .info-box { border-radius:var(--radius); padding:24px 28px; display:flex; gap:16px; align-items:flex-start; margin:24px 0; }
        .info-gold { border:1px solid rgba(212,175,55,0.25); background:rgba(212,175,55,0.05); }
        .info-cyan { border:1px solid rgba(0,212,255,0.25); background:rgba(0,212,255,0.05); }
        .info-green { border:1px solid rgba(0,255,157,0.2); background:rgba(0,255,157,0.05); }
        .info-red { border:1px solid rgba(255,71,87,0.25); background:rgba(255,71,87,0.05); }
        .draw-card { border-radius:var(--radius); overflow:hidden; border:1px solid; }
        .draw-gold { border-color:rgba(212,175,55,0.4); }
        .draw-silver { border-color:rgba(160,160,200,0.35); }
        .tier-card { border-radius:var(--radius); padding:32px; border:2px solid; }
        .tier-10 { border-color:rgba(0,212,255,0.4); background:rgba(0,212,255,0.05); }
        .tier-100 { border-color:rgba(212,175,55,0.5); background:rgba(212,175,55,0.06); }
        ::-webkit-scrollbar { width:6px; }
        ::-webkit-scrollbar-track { background:var(--bg-deep); }
        ::-webkit-scrollbar-thumb { background:var(--gold-dim); border-radius:3px; }
        ::-webkit-scrollbar-thumb:hover { background:var(--gold); }
        @media(max-width:900px){
          .two-col,.tier-grid,.draw-grid{grid-template-columns:1fr!important;}
          .three-col,.phase-grid{grid-template-columns:1fr 1fr!important;}
          .ref-tier-grid{grid-template-columns:1fr 1fr!important;}
        }
        @media(max-width:600px){
          .three-col,.phase-grid,.ref-tier-grid{grid-template-columns:1fr!important;}
        }
      `}</style>

      {/* Canvas BG */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
          pointerEvents: "none",
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(212,175,55,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(212,175,55,0.03) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div style={{ position: "relative", zIndex: 10 }}>
        {/* HERO */}
        <HeroSection
          isConnected={isConnected}
          address={address}
          isRegistered={isRegistered}
        />

        {/* STATS BAR */}
        <StatsBar />

        {/* INTRO */}
        <IntroSection />
        <Divider />

        {/* PRACTICE */}
        <PracticeSection />
        <Divider />

        {/* ACTIVATION */}
        <ActivationSection />
        <Divider />

        {/* 7 INCOME STREAMS */}
        <IncomeSection />
        <Divider />

        {/* LUCKY DRAW */}
        <LuckyDrawSection />
        <Divider />

        {/* ROADMAP */}
        <RoadmapSection />
        <Divider />

        {/* SECURITY */}
        <SecuritySection />

        {/* REGISTRATION (if connected but not registered) */}
        {isConnected && !isRegistered && (
          <div
            style={{ maxWidth: 560, margin: "0 auto", padding: "0 20px 80px" }}
          >
            <div
              style={{
                background: "rgba(13,19,33,0.95)",
                backdropFilter: "blur(20px)",
                border: "1px solid var(--border)",
                borderRadius: 20,
                padding: 40,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background:
                    "linear-gradient(90deg,var(--gold),var(--gold-dim))",
                }}
              />
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <h3
                  className="trk-orbitron"
                  style={{
                    fontSize: "1.3rem",
                    color: "var(--gold)",
                    marginBottom: 8,
                  }}
                >
                  Final Step: Registration
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                  Create your on-chain identity to claim your bonus.
                </p>
              </div>
              <RegistrationPanel />
            </div>
          </div>
        )}

        {/* FOOTER */}
        <footer
          style={{
            padding: "48px 40px",
            textAlign: "center",
            borderTop: "1px solid var(--border)",
            background: "var(--bg-deep)",
          }}
        >
          <div
            className="trk-orbitron trk-glow"
            style={{
              fontWeight: 900,
              fontSize: "1.5rem",
              color: "var(--gold)",
              letterSpacing: 4,
              marginBottom: 12,
            }}
          >
            ⛓ TRK
          </div>
          <div
            style={{
              fontSize: "0.9rem",
              color: "var(--text-muted)",
              letterSpacing: 2,
              marginBottom: 28,
            }}
          >
            REAL CASH GAME ECOSYSTEM · BINANCE SMART CHAIN
          </div>
          <div
            style={{
              display: "flex",
              gap: 16,
              justifyContent: "center",
              flexWrap: "wrap",
              marginBottom: 28,
            }}
          >
            <Badge color="gold">🎮 7 Income Streams</Badge>
            <Badge color="cyan">🛡️ No-Loss Cashback</Badge>
            <Badge color="green">💎 Real USDT Earnings</Badge>
          </div>
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              maxWidth: 600,
              margin: "0 auto",
              lineHeight: 1.7,
            }}
          >
            TRK is a decentralized smart contract ecosystem. Participation
            involves financial risk. Only invest what you can afford to lose.
            Not financial advice.
          </p>
        </footer>
      </div>
    </div>
  );
}

// ─── HERO ───────────────────────────────────────────────────────────────────
function HeroSection({
  isConnected,
  address,
  isRegistered,
}: {
  isConnected: boolean;
  address?: string;
  isRegistered: boolean;
}) {
  return (
    <div
      id="hero"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "120px 40px 80px",
        position: "relative",
      }}
    >
      <div
        className="trk-mono trk-fade-1"
        style={{
          fontSize: "0.78rem",
          color: "var(--cyan)",
          letterSpacing: 4,
          textTransform: "uppercase",
          border: "1px solid var(--border-cyan)",
          padding: "6px 18px",
          borderRadius: 100,
          marginBottom: 32,
          display: "inline-block",
        }}
      >
        ⛓ BEP-20 · BINANCE SMART CHAIN · DECENTRALIZED
      </div>
      <h1
        className="trk-orbitron trk-fade-2"
        style={{
          fontSize: "clamp(2.8rem,7vw,6.5rem)",
          fontWeight: 900,
          lineHeight: 1,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            color: "var(--gold)",
            textShadow: "0 0 40px rgba(212,175,55,0.5)",
          }}
        >
          TRK
        </span>
        <br />
        <span style={{ color: "var(--text)" }}>BLOCKCHAIN</span>
      </h1>
      <div
        className="trk-orbitron trk-fade-3"
        style={{
          fontSize: "clamp(0.9rem,2vw,1.4rem)",
          color: "var(--cyan)",
          letterSpacing: 6,
          marginBottom: 40,
        }}
      >
        ® Real Cash Game Ecosystem
      </div>
      <div
        className="trk-fade-4"
        style={{
          fontSize: "1.15rem",
          color: "var(--text-muted)",
          letterSpacing: 3,
          fontWeight: 500,
          marginBottom: 56,
        }}
      >
        <span style={{ color: "var(--gold)" }}>Play Smart</span> &nbsp;•&nbsp;{" "}
        <span style={{ color: "var(--gold)" }}>Earn Sustainably</span>{" "}
        &nbsp;•&nbsp; <span style={{ color: "var(--gold)" }}>Win Forever</span>
      </div>
      <div
        className="trk-fade-5"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          justifyContent: "center",
          marginBottom: 60,
        }}
      >
        <Badge color="gold">🎮 7 Income Streams</Badge>
        <Badge color="cyan">🛡️ No-Loss Cashback</Badge>
        <Badge color="green">💎 Real USDT Earnings</Badge>
        <Badge color="gold">🎰 Lucky Draw Jackpots</Badge>
        <Badge color="cyan">⚡ Auto Smart Payouts</Badge>
      </div>
      <div
        className="trk-fade-6"
        style={{
          display: "flex",
          gap: 20,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {isConnected ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                padding: "16px 32px",
                background: "rgba(0,255,157,0.08)",
                border: "1px solid rgba(0,255,157,0.3)",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: "var(--green)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#000",
                  fontWeight: 700,
                }}
              >
                ✓
              </div>
              <div style={{ textAlign: "left" }}>
                <div
                  style={{
                    color: "var(--green)",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    letterSpacing: 2,
                  }}
                >
                  WALLET CONNECTED
                </div>
                <div
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.8rem",
                    fontFamily: "monospace",
                  }}
                >
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </div>
              </div>
            </div>
            {!isRegistered && (
              <p style={{ color: "var(--gold)", fontSize: "0.85rem" }}>
                ↓ Complete registration below
              </p>
            )}
          </div>
        ) : (
          <>
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <button
                  onClick={openConnectModal}
                  style={{
                    padding: "16px 40px",
                    borderRadius: 8,
                    fontFamily: "'Orbitron',sans-serif",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    letterSpacing: 2,
                    cursor: "pointer",
                    background:
                      "linear-gradient(135deg,var(--gold),var(--gold-dim))",
                    color: "#000",
                    border: "none",
                    boxShadow: "0 0 30px rgba(212,175,55,0.4)",
                    transition: "all 0.3s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.boxShadow =
                      "0 0 50px rgba(212,175,55,0.7)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.boxShadow =
                      "0 0 30px rgba(212,175,55,0.4)")
                  }
                >
                  🚀 CONNECT WALLET
                </button>
              )}
            </ConnectButton.Custom>
            <a
              href="#income"
              style={{
                padding: "16px 40px",
                borderRadius: 8,
                fontFamily: "'Orbitron',sans-serif",
                fontWeight: 700,
                fontSize: "0.85rem",
                letterSpacing: 2,
                cursor: "pointer",
                background: "transparent",
                color: "var(--cyan)",
                border: "1px solid var(--cyan)",
                textDecoration: "none",
                transition: "all 0.3s",
              }}
            >
              📊 View Income
            </a>
          </>
        )}
      </div>
    </div>
  );
}

// ─── STATS BAR ───────────────────────────────────────────────────────────────
function StatsBar() {
  const stats = [
    { num: "100", label: "USDT Practice Bonus" },
    { num: "8×", label: "Win Multiplier" },
    { num: "7", label: "Income Streams" },
    { num: "0.5%", label: "Daily Cashback" },
    { num: "10%", label: "Lucky Draw Win Rate" },
  ];
  return (
    <div
      style={{
        padding: "32px 40px",
        background:
          "linear-gradient(90deg,rgba(212,175,55,0.05),rgba(0,212,255,0.05),rgba(212,175,55,0.05))",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        justifyContent: "center",
        gap: 60,
        flexWrap: "wrap",
      }}
    >
      {stats.map((s) => (
        <div key={s.label} style={{ textAlign: "center" }}>
          <span
            className="trk-orbitron"
            style={{
              fontWeight: 900,
              fontSize: "2rem",
              color: "var(--gold)",
              textShadow: "var(--glow-gold)",
              display: "block",
            }}
          >
            {s.num}
          </span>
          <span
            style={{
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── DIVIDER ─────────────────────────────────────────────────────────────────
function Divider() {
  return (
    <div
      style={{
        height: 1,
        background:
          "linear-gradient(90deg,transparent,var(--gold),transparent)",
        opacity: 0.3,
      }}
    />
  );
}

// ─── BADGE ───────────────────────────────────────────────────────────────────
function Badge({
  color,
  children,
}: {
  color: "gold" | "cyan" | "green";
  children: React.ReactNode;
}) {
  const map = {
    gold: {
      border: "var(--gold)",
      color: "var(--gold)",
      bg: "rgba(212,175,55,0.07)",
    },
    cyan: {
      border: "var(--cyan)",
      color: "var(--cyan)",
      bg: "rgba(0,212,255,0.07)",
    },
    green: {
      border: "var(--green)",
      color: "var(--green)",
      bg: "rgba(0,255,157,0.07)",
    },
  };
  const s = map[color];
  return (
    <span
      style={{
        padding: "10px 22px",
        borderRadius: 8,
        fontWeight: 600,
        fontSize: "0.9rem",
        letterSpacing: 1,
        border: `1px solid ${s.border}`,
        color: s.color,
        background: s.bg,
        backdropFilter: "blur(10px)",
      }}
    >
      {children}
    </span>
  );
}

// ─── SECTION HEADER ──────────────────────────────────────────────────────────
function SectionHeader({
  label,
  title,
  desc,
}: {
  label: string;
  title: React.ReactNode;
  desc?: string;
}) {
  return (
    <div className="reveal" style={{ marginBottom: 64 }}>
      <span
        className="trk-mono"
        style={{
          fontSize: "0.72rem",
          color: "var(--cyan)",
          letterSpacing: 4,
          textTransform: "uppercase",
          marginBottom: 12,
          display: "block",
        }}
      >
        {label}
      </span>
      <h2
        className="trk-orbitron"
        style={{
          fontSize: "clamp(1.6rem,3.5vw,2.8rem)",
          fontWeight: 700,
          lineHeight: 1.2,
          marginBottom: 16,
        }}
      >
        {title}
      </h2>
      {desc && (
        <p
          style={{
            fontSize: "1.05rem",
            color: "var(--text-muted)",
            maxWidth: 680,
            lineHeight: 1.8,
          }}
        >
          {desc}
        </p>
      )}
    </div>
  );
}

// ─── INTRO SECTION ───────────────────────────────────────────────────────────
function IntroSection() {
  return (
    <section
      id="intro"
      style={{ padding: "100px 40px", maxWidth: 1200, margin: "0 auto" }}
    >
      <SectionHeader
        label="// Introduction"
        title={
          <>
            Next-Gen Decentralized
            <br />
            <span style={{ color: "var(--gold)" }}>Gaming & Rewards</span>
          </>
        }
        desc="TRK Blockchain is a real-cash gaming ecosystem built on Binance Smart Chain (BEP-20) featuring transparent smart contracts, automated payouts, referral-powered growth, and a Sustainable No-Loss Cashback Architecture — protecting capital while enabling continuous income opportunities."
      />
      <div
        className="reveal"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 20,
          marginBottom: 48,
        }}
      >
        {[
          {
            icon: "⛓",
            label: "Blockchain",
            val: "Binance Smart Chain (BEP-20)",
          },
          { icon: "💵", label: "Currency", val: "USDT → TRK Token (Future)" },
          { icon: "📜", label: "Smart Contracts", val: "Fully Automated" },
          {
            icon: "🔐",
            label: "Wallet Type",
            val: "MetaMask / Trust Wallet / SafePal",
          },
        ].map((c) => (
          <div key={c.label} className="tech-card">
            <span
              style={{ fontSize: "2rem", marginBottom: 16, display: "block" }}
            >
              {c.icon}
            </span>
            <div
              className="trk-mono"
              style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                letterSpacing: 3,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              {c.label}
            </div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{c.val}</div>
          </div>
        ))}
      </div>
      <div
        className="reveal"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 20,
          marginBottom: 48,
        }}
      >
        {[
          {
            icon: "🌐",
            title: "100% Decentralized",
            text: "No central authority, fully on-chain governance and logic",
          },
          {
            icon: "⚡",
            title: "Instant Payouts",
            text: "Automated smart contract payouts — zero manual interference",
          },
          {
            icon: "🔍",
            title: "On-Chain Transparent",
            text: "Every transaction verifiable on the public blockchain",
          },
          {
            icon: "🔒",
            title: "Secure Ownership",
            text: "Self-custody wallets — you hold your own keys and assets",
          },
        ].map((f) => (
          <div key={f.title} className="feat-card">
            <span
              style={{ fontSize: "2.2rem", marginBottom: 14, display: "block" }}
            >
              {f.icon}
            </span>
            <div
              className="trk-orbitron"
              style={{
                fontWeight: 700,
                fontSize: "0.85rem",
                color: "var(--cyan)",
                letterSpacing: 1,
                marginBottom: 8,
              }}
            >
              {f.title}
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                lineHeight: 1.5,
              }}
            >
              {f.text}
            </div>
          </div>
        ))}
      </div>
      <div className="info-box info-gold reveal">
        <span style={{ fontSize: "1.4rem", flexShrink: 0, marginTop: 2 }}>
          🎯
        </span>
        <div
          style={{
            fontSize: "0.95rem",
            lineHeight: 1.7,
            color: "var(--text-muted)",
          }}
        >
          <strong style={{ color: "var(--text)" }}>Our Vision:</strong> Build
          the world's most secure, fair, and sustainable real-cash blockchain
          gaming ecosystem — where players win, teams grow, capital is
          protected, and income never stops.
        </div>
      </div>
    </section>
  );
}

// ─── PRACTICE SECTION ────────────────────────────────────────────────────────
function PracticeSection() {
  return (
    <section
      id="practice"
      style={{ padding: "100px 40px", maxWidth: 1200, margin: "0 auto" }}
    >
      <SectionHeader
        label="// Part 1 — Registration"
        title={
          <>
            Practice Rewards &<br />
            <span style={{ color: "var(--gold)" }}>Onboarding System</span>
          </>
        }
        desc="Start completely free. Learn gameplay, test strategies, and build confidence before committing real capital. No personal funds required at sign-up."
      />
      <div className="reveal" style={{ marginBottom: 40 }}>
        <h3
          className="trk-orbitron"
          style={{
            fontSize: "1.1rem",
            color: "var(--gold)",
            marginBottom: 20,
            letterSpacing: 2,
          }}
        >
          🎁 Free Sign-Up Practice Bonus
        </h3>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Bonus Amount</th>
                <th>Availability</th>
                <th>Credit Type</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ color: "var(--gold)", fontWeight: 700 }}>
                  100 USDT Practice Balance
                </td>
                <td>
                  First <strong>10,000</strong> practice-activated users
                </td>
                <td>Practice Account only</td>
              </tr>
              <tr>
                <td style={{ color: "var(--cyan)", fontWeight: 600 }}>
                  10 USDT Practice Balance
                </td>
                <td>
                  First <strong>1,00,000</strong> practice-activated users
                </td>
                <td>Practice Account only</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="info-box info-red" style={{ marginTop: 16 }}>
          <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>⚠️</span>
          <div
            style={{
              fontSize: "0.95rem",
              lineHeight: 1.7,
              color: "var(--text-muted)",
            }}
          >
            <strong style={{ color: "var(--text)" }}>
              Practice Balance Restrictions:
            </strong>{" "}
            Not withdrawable &nbsp;•&nbsp; Not transferable &nbsp;•&nbsp; Not
            redeemable for cash &nbsp;•&nbsp; For internal gameplay simulation
            only
          </div>
        </div>
      </div>

      <div
        className="two-col reveal"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 40,
          alignItems: "start",
          marginBottom: 40,
        }}
      >
        <div>
          <h3
            className="trk-orbitron"
            style={{
              fontSize: "1.1rem",
              color: "var(--gold)",
              marginBottom: 20,
              letterSpacing: 2,
            }}
          >
            🎮 Practice Game Mechanics
          </h3>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Outcome</th>
                  <th>Result</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ color: "var(--green)" }}>🏆 Win</td>
                  <td style={{ color: "var(--green)" }}>8× Entry</td>
                  <td>First 10,000 users; 4× thereafter</td>
                </tr>
                <tr>
                  <td style={{ color: "var(--red)" }}>❌ Loss</td>
                  <td style={{ color: "var(--red)" }}>Points Burned</td>
                  <td>Sent to null address permanently</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3
            className="trk-orbitron"
            style={{
              fontSize: "1.1rem",
              color: "var(--cyan)",
              marginBottom: 20,
              letterSpacing: 2,
            }}
          >
            ⏳ 30-Day Activation Rule
          </h3>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div
              style={{
                border: "1px solid rgba(0,255,157,0.25)",
                background: "rgba(0,255,157,0.04)",
                padding: 20,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  color: "var(--green)",
                  fontWeight: 700,
                  marginBottom: 12,
                  fontSize: "0.85rem",
                  letterSpacing: 1,
                }}
              >
                ✔ IF ACTIVATED
              </div>
              <ul
                style={{
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {[
                  "Account remains active",
                  "Gameplay continues",
                  "Secured permanently",
                ].map((t) => (
                  <li
                    key={t}
                    style={{ display: "flex", gap: 8, fontSize: "0.88rem" }}
                  >
                    <span style={{ color: "var(--green)" }}>✔</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div
              style={{
                border: "1px solid rgba(255,71,87,0.25)",
                background: "rgba(255,71,87,0.04)",
                padding: 20,
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  color: "var(--red)",
                  fontWeight: 700,
                  marginBottom: 12,
                  fontSize: "0.85rem",
                  letterSpacing: 1,
                }}
              >
                ✘ IF NOT ACTIVATED
              </div>
              <ul
                style={{
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {["Game ID deleted", "Balance removed"].map((t) => (
                  <li
                    key={t}
                    style={{ display: "flex", gap: 8, fontSize: "0.88rem" }}
                  >
                    <span style={{ color: "var(--red)" }}>✘</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="info-box info-cyan" style={{ marginTop: 12 }}>
            <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>💡</span>
            <div
              style={{
                fontSize: "0.95rem",
                lineHeight: 1.7,
                color: "var(--text-muted)",
              }}
            >
              Deposit minimum{" "}
              <strong style={{ color: "var(--text)" }}>10+ USDT</strong> within
              30 days to permanently activate your account.
            </div>
          </div>
        </div>
      </div>

      <div className="reveal" style={{ marginBottom: 40 }}>
        <h3
          className="trk-orbitron"
          style={{
            fontSize: "1.1rem",
            color: "var(--gold)",
            marginBottom: 8,
            letterSpacing: 2,
          }}
        >
          🟡 Practice Referral Rewards
        </h3>
        <p
          style={{
            color: "var(--text-muted)",
            marginBottom: 20,
            fontSize: "0.95rem",
          }}
        >
          Earn a percentage of the 100 USDT base for every person you introduce.
          Limit: 20 Direct Referrals for this bonus.
        </p>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Level Range</th>
                <th>Reward %</th>
                <th>USDT per Referral</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Level 1", "10%", "10.00 USDT", true],
                ["Level 2 – 5", "2%", "2.00 USDT", false],
                ["Level 6 – 10", "1%", "1.00 USDT", false],
                ["Level 11 – 15", "0.5%", "0.50 USDT", false],
                ["Level 16 – 50", "0.25%", "0.25 USDT", false],
                ["Level 51 – 100", "0.10%", "0.10 USDT", false],
              ].map(([l, r, u, hi]) => (
                <tr key={String(l)}>
                  <td
                    style={hi ? { color: "var(--gold)", fontWeight: 700 } : {}}
                  >
                    {l}
                  </td>
                  <td
                    style={hi ? { color: "var(--gold)", fontWeight: 700 } : {}}
                  >
                    {r}
                  </td>
                  <td
                    style={hi ? { color: "var(--gold)", fontWeight: 700 } : {}}
                  >
                    {u}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ─── ACTIVATION SECTION ──────────────────────────────────────────────────────
function ActivationSection() {
  return (
    <section
      id="activation"
      style={{ padding: "100px 40px", maxWidth: 1200, margin: "0 auto" }}
    >
      <SectionHeader
        label="// Part 2 — Real Cash"
        title={
          <>
            Real Cash
            <br />
            <span style={{ color: "var(--gold)" }}>Activation Tiers</span>
          </>
        }
        desc="Unlock withdrawals and all income streams by depositing USDT into your Cash Game Account."
      />
      <div
        className="tier-grid reveal"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}
      >
        <div className="tier-card tier-10">
          <div
            className="trk-orbitron"
            style={{
              fontWeight: 900,
              fontSize: "2.4rem",
              color: "var(--cyan)",
              textShadow: "var(--glow-cyan)",
              marginBottom: 6,
            }}
          >
            10+ USDT
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 24,
            }}
          >
            Deposit to Activate
          </div>
          <ul
            style={{
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {[
              "Winners Income (Direct Wins)",
              "Direct Level Income (Referrals)",
              "Winners Level Income",
              "Access to Cash Game Rewards",
            ].map((f) => (
              <li
                key={f}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: "0.95rem",
                }}
              >
                <span style={{ color: "var(--cyan)" }}>✔</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="tier-card tier-100">
          <div
            className="trk-orbitron"
            style={{
              fontWeight: 900,
              fontSize: "2.4rem",
              color: "var(--gold)",
              textShadow: "var(--glow-gold)",
              marginBottom: 6,
            }}
          >
            100+ USDT
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: 24,
            }}
          >
            Full Ecosystem Access
          </div>
          <ul
            style={{
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {[
              "Transfer Practice Balance",
              "Withdraw All Real Profits",
              "Cashback Protection Active",
              "All 7 Income Streams Unlocked",
            ].map((f) => (
              <li
                key={f}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: "0.95rem",
                }}
              >
                <span style={{ color: "var(--gold)" }}>✔</span>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="info-box info-cyan reveal" style={{ marginTop: 32 }}>
        <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>🌉</span>
        <div
          style={{
            fontSize: "0.95rem",
            lineHeight: 1.7,
            color: "var(--text-muted)",
          }}
        >
          <strong style={{ color: "var(--text)" }}>
            Bridge to Cash (Conversion Model):
          </strong>{" "}
          To convert Practice rewards to real value — qualify as a REAL CASH
          Direct Referral with total volume ≥ 100 USDT. Practice balance becomes
          convertible, transferable, and eligible for Cash Game use.
        </div>
      </div>
    </section>
  );
}

// ─── INCOME SECTION ──────────────────────────────────────────────────────────
function Band({
  color,
  icon,
  title,
  sub,
}: {
  color: "active" | "passive" | "eco";
  icon: string;
  title: string;
  sub: string;
}) {
  const styles = {
    active: {
      bg: "linear-gradient(135deg,rgba(230,81,0,0.15),rgba(255,87,34,0.05))",
      border: "rgba(230,81,0,0.3)",
      color: "#ff6d00",
    },
    passive: {
      bg: "linear-gradient(135deg,rgba(0,105,96,0.15),rgba(0,212,255,0.05))",
      border: "rgba(0,150,136,0.3)",
      color: "#00bfa5",
    },
    eco: {
      bg: "linear-gradient(135deg,rgba(212,175,55,0.12),rgba(212,175,55,0.03))",
      border: "rgba(212,175,55,0.3)",
      color: "var(--gold)",
    },
  };
  const s = styles[color];
  return (
    <div
      style={{
        padding: "28px 40px",
        display: "flex",
        alignItems: "center",
        gap: 20,
        background: s.bg,
        borderTop: `1px solid ${s.border}`,
        borderBottom: `1px solid ${s.border}`,
      }}
    >
      <span style={{ fontSize: "2rem" }}>{icon}</span>
      <div>
        <div
          className="trk-orbitron"
          style={{
            fontWeight: 700,
            fontSize: "clamp(1rem,2vw,1.5rem)",
            letterSpacing: 2,
            color: s.color,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: "0.85rem",
            color: "var(--text-muted)",
            letterSpacing: 1,
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}

function IncomeSection() {
  return (
    <section id="income" style={{ padding: "100px 0", maxWidth: "100%" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 40px" }}>
        <SectionHeader
          label="// Part 3 — Income"
          title={
            <>
              Total{" "}
              <span style={{ color: "var(--gold)" }}>7 Income Streams</span>
            </>
          }
          desc="The TRK Ecosystem provides 7 powerful income streams — divided into Active Income, Passive & Protection Income, and Ecosystem Rewards."
        />
      </div>

      <Band
        color="active"
        icon="🔥"
        title="ACTIVE INCOME — Streams 1 · 2 · 3"
        sub="Direct earnings from gameplay, referrals, and team wins"
      />

      <div style={{ maxWidth: 1200, margin: "48px auto", padding: "0 40px" }}>
        <div
          className="reveal"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
            gap: 28,
            marginBottom: 60,
          }}
        >
          <IncomeCard
            num={1}
            numColor="orange"
            title="💎 Winners 8× Income"
            sub="Direct win multiplier payouts"
          >
            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--text-muted)",
                marginBottom: 20,
                lineHeight: 1.7,
              }}
            >
              Win the game and receive an instant 8× multiplier on your entry.
              First 10,000 users get 8× (2× cash + 6× replay). Subsequent users
              receive 4× (2× cash + 2× replay).
            </p>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>User Tier</th>
                    <th>Win Multiplier</th>
                    <th>Cash Out</th>
                    <th>Replay</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>First 10,000</td>
                    <td style={{ color: "var(--gold)", fontWeight: 700 }}>
                      8×
                    </td>
                    <td style={{ color: "var(--green)" }}>2×</td>
                    <td>6×</td>
                  </tr>
                  <tr>
                    <td>After 10,000</td>
                    <td style={{ color: "var(--cyan)", fontWeight: 600 }}>
                      4×
                    </td>
                    <td style={{ color: "var(--green)" }}>2×</td>
                    <td>2×</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </IncomeCard>

          <IncomeCard
            num={2}
            numColor="orange"
            title="🤝 Direct Level Income"
            sub="Referral commissions up to 15 levels"
          >
            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--text-muted)",
                marginBottom: 20,
                lineHeight: 1.7,
              }}
            >
              Earn a percentage of every direct referral's game entry fee across
              15 levels of your network.
            </p>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Level</th>
                    <th>Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["1", "10%"],
                    ["2–5", "2%"],
                    ["6–10", "1%"],
                    ["11–15", "0.5%"],
                  ].map(([l, c]) => (
                    <tr key={l}>
                      <td>Level {l}</td>
                      <td style={{ color: "var(--gold)", fontWeight: 700 }}>
                        {c}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </IncomeCard>

          <IncomeCard
            num={3}
            numColor="orange"
            title="🏆 Winners Level Income"
            sub="Earn when your team wins"
          >
            <p
              style={{
                fontSize: "0.95rem",
                color: "var(--text-muted)",
                marginBottom: 20,
                lineHeight: 1.7,
              }}
            >
              Receive a share of your network's winning payouts across 15 levels
              — passive income from your team's success.
            </p>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Level</th>
                    <th>Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["1", "10%"],
                    ["2–5", "2%"],
                    ["6–10", "1%"],
                    ["11–15", "0.5%"],
                  ].map(([l, c]) => (
                    <tr key={l}>
                      <td>Level {l}</td>
                      <td style={{ color: "var(--cyan)", fontWeight: 600 }}>
                        {c}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </IncomeCard>
        </div>
      </div>

      <Band
        color="passive"
        icon="🛡️"
        title="PASSIVE & PROTECTION INCOME — Streams 4 · 5"
        sub="Daily cashback recovery and team ROI distribution"
      />

      <div style={{ maxWidth: 1200, margin: "48px auto", padding: "0 40px" }}>
        <div className="reveal" style={{ marginBottom: 60 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Orbitron',sans-serif",
                fontWeight: 900,
                fontSize: "1.1rem",
                background: "rgba(0,150,136,0.15)",
                border: "2px solid rgba(0,150,136,0.5)",
                color: "#00bfa5",
              }}
            >
              4
            </div>
            <div>
              <div
                className="trk-orbitron"
                style={{ fontWeight: 700, fontSize: "1.2rem" }}
              >
                🛡️ Losers Cashback (No-Loss System)
              </div>
              <div
                style={{
                  fontSize: "0.9rem",
                  color: "var(--text-muted)",
                  marginTop: 4,
                }}
              >
                Daily auto-received recovery on losses ≥ 100 USDT
              </div>
            </div>
          </div>
          <p
            style={{
              color: "var(--text-muted)",
              marginBottom: 28,
              lineHeight: 1.7,
              fontSize: "0.95rem",
            }}
          >
            Unlike traditional gaming where losses are permanent, TRK
            automatically recovers your capital daily. No full wipe-outs.
            Predictable protection. Sustainable ecosystem design.
          </p>
          <div
            className="phase-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3,1fr)",
              gap: 20,
              marginBottom: 32,
            }}
          >
            {[
              ["Phase 1", "0.50%", "Daily", "Up to 10,000 Users"],
              ["Phase 2", "0.40%", "Daily", "10,001 – 1,00,000 Users"],
              ["Phase 3", "0.33%", "Daily", "After 1,00,000 Users"],
            ].map(([ph, rate, period, users]) => (
              <div key={ph} className="phase-card">
                <div
                  className="trk-orbitron"
                  style={{
                    fontWeight: 900,
                    fontSize: "0.7rem",
                    letterSpacing: 3,
                    color: "var(--green)",
                    textTransform: "uppercase",
                    marginBottom: 16,
                  }}
                >
                  {ph}
                </div>
                <div
                  className="trk-orbitron"
                  style={{
                    fontWeight: 900,
                    fontSize: "2.4rem",
                    color: "var(--green)",
                    textShadow: "var(--glow-green)",
                    lineHeight: 1,
                    marginBottom: 6,
                  }}
                >
                  {rate}
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                    marginBottom: 16,
                  }}
                >
                  {period}
                </div>
                <div
                  style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}
                >
                  {users}
                </div>
              </div>
            ))}
          </div>
          <div
            className="ref-tier-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 16,
              marginBottom: 24,
            }}
          >
            {[
              ["1×", "0 Referrals", "100% Cap"],
              ["2×", "5 Referrals", "200% Cap"],
              ["4×", "10 Referrals", "400% Cap"],
              ["8×", "20 Referrals", "800% Cap"],
            ].map(([m, r, c]) => (
              <div key={m} className="ref-card">
                <div
                  className="trk-orbitron"
                  style={{
                    fontWeight: 900,
                    fontSize: "2.5rem",
                    color: "var(--gold)",
                    textShadow: "var(--glow-gold)",
                    lineHeight: 1,
                    marginBottom: 6,
                  }}
                >
                  {m}
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                    letterSpacing: 2,
                    marginBottom: 16,
                    textTransform: "uppercase",
                  }}
                >
                  {r}
                </div>
                <div
                  style={{
                    display: "inline-block",
                    padding: "6px 14px",
                    borderRadius: 6,
                    border: "1px solid var(--border)",
                    fontFamily: "'Share Tech Mono',monospace",
                    fontSize: "0.8rem",
                    color: "var(--green)",
                  }}
                >
                  {c}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="reveal" style={{ marginBottom: 60 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Orbitron',sans-serif",
                fontWeight: 900,
                fontSize: "1.1rem",
                background: "rgba(0,150,136,0.15)",
                border: "2px solid rgba(0,150,136,0.5)",
                color: "#00bfa5",
              }}
            >
              5
            </div>
            <div>
              <div
                className="trk-orbitron"
                style={{ fontWeight: 700, fontSize: "1.2rem" }}
              >
                🔄 Losers ROI on ROI
              </div>
              <div
                style={{
                  fontSize: "0.9rem",
                  color: "var(--text-muted)",
                  marginTop: 4,
                }}
              >
                Team cashback → your daily passive income
              </div>
            </div>
          </div>
          <p
            style={{
              color: "var(--text-muted)",
              marginBottom: 28,
              lineHeight: 1.7,
              fontSize: "0.95rem",
            }}
          >
            50% of total cashback generated by your entire network is allocated
            for referral distribution. Even when your team loses — you still
            earn. Daily, automated, passive.
          </p>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}
          >
            <div className="tbl-wrap">
              <table className="tbl-green">
                <thead>
                  <tr>
                    <th>Level Range</th>
                    <th>Commission %</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Level 1", "20%"],
                    ["Level 2 – 5", "10%"],
                    ["Level 6 – 10", "5%"],
                    ["Level 11 – 15", "3%"],
                  ].map(([l, c]) => (
                    <tr key={l}>
                      <td>{l}</td>
                      <td style={{ color: "var(--green)", fontWeight: 600 }}>
                        {c}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h4
                style={{
                  color: "var(--text)",
                  fontSize: "0.9rem",
                  letterSpacing: 2,
                  marginBottom: 16,
                  textTransform: "uppercase",
                }}
              >
                📈 Club Income — Daily Turnover Share
              </h4>
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Pool Share</th>
                      <th>Example Daily*</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Rank 1", "2%", "~$1,600"],
                      ["Rank 2", "2%", "~$1,600"],
                      ["Rank 3", "1%", "~$800"],
                      ["Rank 4", "1%", "~$800"],
                      ["Rank 5", "1%", "~$800"],
                      ["Rank 6", "1%", "~$800"],
                    ].map(([r, p, d]) => (
                      <tr key={r}>
                        <td style={{ color: "var(--gold)", fontWeight: 700 }}>
                          {r}
                        </td>
                        <td style={{ color: "var(--gold)", fontWeight: 700 }}>
                          {p}
                        </td>
                        <td>{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                  marginTop: 12,
                }}
              >
                * Example assumes $1,000,000 daily turnover.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function IncomeCard({
  num,
  numColor,
  title,
  sub,
  children,
}: {
  num: number;
  numColor: "orange" | "teal" | "gold";
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  const colors = {
    orange: {
      bg: "rgba(230,81,0,0.15)",
      border: "rgba(230,81,0,0.5)",
      color: "#ff6d00",
    },
    teal: {
      bg: "rgba(0,150,136,0.15)",
      border: "rgba(0,150,136,0.5)",
      color: "#00bfa5",
    },
    gold: {
      bg: "rgba(212,175,55,0.15)",
      border: "rgba(212,175,55,0.5)",
      color: "var(--gold)",
    },
  };
  const c = colors[numColor];
  return (
    <div className="income-card">
      <div
        style={{
          padding: "24px 28px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Orbitron',sans-serif",
            fontWeight: 900,
            fontSize: "1rem",
            flexShrink: 0,
            background: c.bg,
            border: `2px solid ${c.border}`,
            color: c.color,
          }}
        >
          {num}
        </div>
        <div>
          <div
            className="trk-orbitron"
            style={{ fontWeight: 700, fontSize: "1rem", lineHeight: 1.3 }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "var(--text-muted)",
              marginTop: 4,
            }}
          >
            {sub}
          </div>
        </div>
      </div>
      <div style={{ padding: "0 28px 28px" }}>{children}</div>
    </div>
  );
}

// ─── LUCKY DRAW SECTION ──────────────────────────────────────────────────────
function LuckyDrawSection() {
  const goldenPrizes = [
    ["🥇 1st Prize", "10,000 USDT", "1"],
    ["🥈 2nd Prize", "5,000 USDT", "1"],
    ["🥉 3rd Prize", "4,000 USDT", "1"],
    ["4th – 10th", "1,000 USDT", "7"],
    ["11th – 50th", "300 USDT", "40"],
    ["51st – 100th", "120 USDT", "50"],
    ["101st – 500th", "40 USDT", "400"],
    ["501st – 1000th", "20 USDT", "500"],
  ];
  const silverPrizes = [
    ["🥇 1st Prize", "1,000 USDT", "1"],
    ["🥈 2nd Prize", "500 USDT", "1"],
    ["🥉 3rd Prize", "400 USDT", "1"],
    ["4th – 10th", "100 USDT", "7"],
    ["11th – 50th", "30 USDT", "40"],
    ["51st – 100th", "12 USDT", "50"],
    ["101st – 500th", "4 USDT", "400"],
    ["501st – 1000th", "2 USDT", "500"],
  ];

  return (
    <section
      id="luckydraw"
      style={{ padding: "100px 40px", maxWidth: 1200, margin: "0 auto" }}
    >
      <SectionHeader
        label="// Stream 7 — Jackpot"
        title={
          <>
            🎰 Lucky Draw
            <br />
            <span style={{ color: "var(--gold)" }}>Income System</span>
          </>
        }
        desc="Smart contract–powered jackpot pools. Every 1 in 10 participants wins. 10,000 tickets per round, automated draw, instant payouts — no human control, no manipulation."
      />

      <div
        className="draw-grid reveal"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 28,
          marginBottom: 40,
        }}
      >
        {/* Golden */}
        <div className="draw-card draw-gold">
          <div
            style={{
              padding: 28,
              textAlign: "center",
              background:
                "linear-gradient(135deg,rgba(212,175,55,0.15),rgba(212,175,55,0.04))",
            }}
          >
            <span
              style={{ fontSize: "2.5rem", display: "block", marginBottom: 12 }}
            >
              💎
            </span>
            <div
              className="trk-orbitron"
              style={{
                fontWeight: 700,
                fontSize: "1.1rem",
                color: "var(--gold)",
                marginBottom: 4,
              }}
            >
              GOLDEN LUCKY DRAW
            </div>
            <div
              style={{
                fontSize: "2.2rem",
                fontWeight: 700,
                color: "var(--gold)",
                marginBottom: 4,
              }}
            >
              10 USDT
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Total Prize Pool: 70,000 USDT
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginTop: 8,
              }}
            >
              10,000 Tickets &nbsp;•&nbsp; 1,000 Winners &nbsp;•&nbsp; 10% Win
              Rate
            </div>
          </div>
          <div style={{ padding: 20 }}>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th style={{ textAlign: "center" }}>Prize</th>
                    <th style={{ textAlign: "center" }}>Winners</th>
                  </tr>
                </thead>
                <tbody>
                  {goldenPrizes.map(([r, p, w]) => (
                    <tr key={r}>
                      <td>{r}</td>
                      <td
                        style={{
                          textAlign: "center",
                          color: "var(--gold)",
                          fontWeight: 700,
                        }}
                      >
                        {p}
                      </td>
                      <td style={{ textAlign: "center" }}>{w}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "rgba(212,175,55,0.08)" }}>
                    <td>
                      <strong>Total</strong>
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        color: "var(--gold)",
                        fontWeight: 700,
                      }}
                    >
                      <strong>70,000 USDT</strong>
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        color: "var(--gold)",
                        fontWeight: 700,
                      }}
                    >
                      <strong>1,000</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Silver */}
        <div className="draw-card draw-silver">
          <div
            style={{
              padding: 28,
              textAlign: "center",
              background:
                "linear-gradient(135deg,rgba(160,160,200,0.1),rgba(100,100,160,0.03))",
            }}
          >
            <span
              style={{ fontSize: "2.5rem", display: "block", marginBottom: 12 }}
            >
              🥈
            </span>
            <div
              className="trk-orbitron"
              style={{
                fontWeight: 700,
                fontSize: "1.1rem",
                color: "#c0c0d8",
                marginBottom: 4,
              }}
            >
              SILVER LUCKY DRAW
            </div>
            <div
              style={{
                fontSize: "2.2rem",
                fontWeight: 700,
                color: "#a0a0c0",
                marginBottom: 4,
              }}
            >
              1 USDT
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Total Prize Pool: 7,000 USDT
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginTop: 8,
              }}
            >
              10,000 Tickets &nbsp;•&nbsp; 1,000 Winners &nbsp;•&nbsp; 10% Win
              Rate
            </div>
          </div>
          <div style={{ padding: 20 }}>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th style={{ textAlign: "center" }}>Prize</th>
                    <th style={{ textAlign: "center" }}>Winners</th>
                  </tr>
                </thead>
                <tbody>
                  {silverPrizes.map(([r, p, w]) => (
                    <tr key={r}>
                      <td>{r}</td>
                      <td
                        style={{
                          textAlign: "center",
                          color: "var(--cyan)",
                          fontWeight: 600,
                        }}
                      >
                        {p}
                      </td>
                      <td style={{ textAlign: "center" }}>{w}</td>
                    </tr>
                  ))}
                  <tr style={{ background: "rgba(0,212,255,0.06)" }}>
                    <td>
                      <strong>Total</strong>
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        color: "var(--cyan)",
                        fontWeight: 700,
                      }}
                    >
                      <strong>7,000 USDT</strong>
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        color: "var(--cyan)",
                        fontWeight: 700,
                      }}
                    >
                      <strong>1,000</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="reveal" style={{ marginBottom: 60 }}>
        <h3
          className="trk-orbitron"
          style={{
            fontSize: "1.1rem",
            color: "var(--gold)",
            marginBottom: 20,
            letterSpacing: 2,
          }}
        >
          ⚙️ Automatic Lucky Draw Entry System
        </h3>
        <div
          className="three-col"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 20,
          }}
        >
          {[
            {
              icon: "💸",
              title: "Auto-Credit Daily",
              text: "20% of Losers Profit earnings auto-transferred equally to both Golden and Silver Draw wallets each day",
            },
            {
              icon: "🎟️",
              title: "Auto-Entry",
              text: "Once wallet balance covers ≥1 ticket, entry is purchased automatically — continuous participation with zero effort",
            },
            {
              icon: "➕",
              title: "Manual Top-Up",
              text: "Optionally deposit directly to either draw wallet anytime to buy more tickets and increase win probability",
            },
          ].map((f) => (
            <div key={f.title} className="feat-card">
              <span
                style={{
                  fontSize: "2.2rem",
                  marginBottom: 14,
                  display: "block",
                }}
              >
                {f.icon}
              </span>
              <div
                className="trk-orbitron"
                style={{
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  color: "var(--cyan)",
                  letterSpacing: 1,
                  marginBottom: 8,
                }}
              >
                {f.title}
              </div>
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-muted)",
                  lineHeight: 1.5,
                }}
              >
                {f.text}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="reveal">
        <h3
          className="trk-orbitron"
          style={{
            fontSize: "1.1rem",
            color: "var(--gold)",
            marginBottom: 20,
            letterSpacing: 2,
          }}
        >
          💳 Withdrawal Policy
        </h3>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Minimum Withdrawal", "5 USDT", "green"],
                ["Maximum Withdrawal", "5,000 USDT / day", "green"],
                ["Sustainability Fee", "10%", "gold"],
                ["Payout Method", "Automatic Smart Contract", ""],
                ["Network", "BEP-20 Only", "cyan"],
              ].map(([p, v, c]) => (
                <tr key={String(p)}>
                  <td>{p}</td>
                  <td
                    style={
                      c === "green"
                        ? { color: "var(--green)", fontWeight: 600 }
                        : c === "gold"
                        ? { color: "var(--gold)", fontWeight: 700 }
                        : c === "cyan"
                        ? { color: "var(--cyan)", fontWeight: 600 }
                        : {}
                    }
                  >
                    {v}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ─── ROADMAP SECTION ─────────────────────────────────────────────────────────
function RoadmapSection() {
  const phases = [
    {
      id: "PH1",
      cls: {
        border: "var(--gold)",
        color: "var(--gold)",
        bg: "rgba(212,175,55,0.1)",
      },
      phase: "Phase 1 — Current",
      title: "100% USDT",
      titleColor: "var(--gold)",
      desc: "All transactions, deposits, and payouts exclusively in USDT (BEP-20). Maximum stability and accessibility for early participants.",
    },
    {
      id: "PH2",
      cls: {
        border: "var(--cyan)",
        color: "var(--cyan)",
        bg: "rgba(0,212,255,0.1)",
      },
      phase: "Phase 2 — Transition",
      title: "USDT or TRK Token",
      titleColor: "var(--cyan)",
      desc: "TRK Token introduced as an alternative payment option alongside USDT. Users may choose their preferred currency.",
    },
    {
      id: "PH3",
      cls: {
        border: "var(--green)",
        color: "var(--green)",
        bg: "rgba(0,255,157,0.1)",
      },
      phase: "Phase 3 — Hybrid",
      title: "50/50 Hybrid Economy",
      titleColor: "var(--green)",
      desc: "Equal split between USDT and TRK Token for all ecosystem activities — driving token demand and ecosystem growth simultaneously.",
    },
    {
      id: "PH4",
      cls: { border: "#a855f7", color: "#a855f7", bg: "rgba(168,85,247,0.1)" },
      phase: "Phase 4 — Full Token",
      title: "100% TRK Token Economy",
      titleColor: "#a855f7",
      desc: "Complete migration to TRK Token. Full utility, increased scarcity, and long-term deflationary token value for all ecosystem participants.",
    },
  ];
  return (
    <section
      id="roadmap"
      style={{ padding: "100px 40px", maxWidth: 1200, margin: "0 auto" }}
    >
      <SectionHeader
        label="// TRK Token"
        title={
          <>
            Token <span style={{ color: "var(--gold)" }}>Roadmap</span>
          </>
        }
        desc="A phased transition from 100% USDT to a full TRK Token Economy — increasing utility, scarcity, and long-term value."
      />
      <div className="reveal" style={{ position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 31,
            top: 20,
            bottom: 20,
            width: 2,
            background:
              "linear-gradient(180deg,var(--gold),var(--cyan),var(--green),var(--gold))",
            opacity: 0.4,
          }}
        />
        {phases.map((p) => (
          <div key={p.id} className="road-item">
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "'Orbitron',sans-serif",
                fontWeight: 900,
                fontSize: "0.8rem",
                border: `2px solid ${p.cls.border}`,
                color: p.cls.color,
                background: p.cls.bg,
                position: "relative",
                zIndex: 1,
              }}
            >
              {p.id}
            </div>
            <div style={{ flex: 1, paddingTop: 12 }}>
              <div
                className="trk-mono"
                style={{
                  fontSize: "0.7rem",
                  letterSpacing: 3,
                  color: "var(--text-muted)",
                  marginBottom: 6,
                }}
              >
                {p.phase}
              </div>
              <div
                className="trk-orbitron"
                style={{
                  fontWeight: 700,
                  fontSize: "1.1rem",
                  marginBottom: 8,
                  color: p.titleColor,
                }}
              >
                {p.title}
              </div>
              <div
                style={{
                  fontSize: "0.95rem",
                  color: "var(--text-muted)",
                  lineHeight: 1.6,
                }}
              >
                {p.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── SECURITY SECTION ────────────────────────────────────────────────────────
function SecuritySection() {
  const cards = [
    {
      icon: "🔞",
      title: "18+ Only",
      text: "Strict age verification policy for all participants",
    },
    {
      icon: "👤",
      title: "One Account Policy",
      text: "Single account per user — no duplication permitted",
    },
    {
      icon: "🔑",
      title: "Self-Custody Wallets",
      text: "You hold your own keys — MetaMask, Trust Wallet, SafePal",
    },
    {
      icon: "⛓️",
      title: "BEP-20 Only",
      text: "All transactions exclusively on Binance Smart Chain",
    },
    {
      icon: "📜",
      title: "Smart Contract Automation",
      text: "Zero manual interference — fully automated payouts",
    },
    {
      icon: "🔍",
      title: "On-Chain Transparent",
      text: "Every transaction publicly verifiable on-chain",
    },
  ];
  return (
    <section
      style={{ padding: "100px 40px", maxWidth: 1200, margin: "0 auto" }}
    >
      <SectionHeader
        label="// Security & Compliance"
        title={
          <>
            Platform <span style={{ color: "var(--gold)" }}>Policies</span>
          </>
        }
      />
      <div
        className="reveal"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: 20,
        }}
      >
        {cards.map((c) => (
          <div key={c.title} className="sec-card">
            <span
              style={{ fontSize: "2rem", display: "block", marginBottom: 12 }}
            >
              {c.icon}
            </span>
            <div
              style={{
                fontSize: "0.9rem",
                color: "var(--text-muted)",
                lineHeight: 1.5,
              }}
            >
              <strong
                style={{
                  color: "var(--green)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                {c.title}
              </strong>
              {c.text}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

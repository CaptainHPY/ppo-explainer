"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FiGithub } from "react-icons/fi";

import Agent from "@/components/agent/Agent";
import Buffer from "@/components/Buffer";
import Controller, { DEFAULT_STEP } from "@/components/Controller";
import Environment from "@/components/Env";
import NetworkMatrixWaveModal from "@/components/NetworkMatrixWaveModal";
import PPOStoryPanel, { type NarrativeSectionId } from "@/components/PPOStoryPanel";
import SpiralTrainingModal from "@/components/SpiralTrainingModal";
import type { MatrixWaveModalState } from "@/lib/weightMatrix";

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export default function HomePage() {
  const [expanded, setExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [step, setStep] = useState(DEFAULT_STEP);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeNarrativeSection, setActiveNarrativeSection] = useState<NarrativeSectionId>("overview");
  const [isSpiralOpen, setIsSpiralOpen] = useState(false);
  const [matrixWaveModalState, setMatrixWaveModalState] = useState<MatrixWaveModalState>(null);
  const narrativeRef = useRef<HTMLDivElement | null>(null);
  const mockupHeight = expanded ? 700 : 500;
  const mockupWidth = expanded ? 2000 : 1350;
  const feedbackPath = expanded
    ? "M 1580 390 L 1580 520 Q 1580 550 1510 550 L 450 550 Q 400 550 400 500 L 400 390"
    : "M 1040 390 L 1040 500 Q 1040 530 970 530 L 120 530 Q 100 530 100 480 L 100 360";

  function handleCollapseToHome() {
    setExpanded(false);
  }

  useEffect(() => {
    function updateScrollState() {
      const narrative = narrativeRef.current;
      if (!narrative) {
        setScrollProgress(0);
        return;
      }

      const scrollY = window.scrollY;
      const narrativeTop = narrative.offsetTop;
      const narrativeHeight = narrative.offsetHeight;
      const viewportHeight = window.innerHeight;
      const progressStart = narrativeTop - viewportHeight * 0.72;
      const progressRange = Math.max(narrativeHeight, viewportHeight * 1.4);
      const progress = clamp((scrollY - progressStart) / progressRange);
      setScrollProgress(progress);

      const sections = Array.from(narrative.querySelectorAll<HTMLElement>("[data-story-section]"));
      if (!sections.length) {
        return;
      }

      let nextActive: NarrativeSectionId = "overview";
      let bestDistance = Number.POSITIVE_INFINITY;
      const focusY = viewportHeight * 0.42;

      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        const distance = Math.abs(rect.top - focusY);
        if (distance < bestDistance) {
          bestDistance = distance;
          const id = section.dataset.storySection;
          if (id === "overview" || id === "phases" || id === "mapping") {
            nextActive = id;
          }
        }
      }

      setActiveNarrativeSection(nextActive);
    }

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      window.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, []);

  const visualizationScale = useMemo(() => 1 - scrollProgress * 0.08, [scrollProgress]);
  const visualizationOpacity = useMemo(() => 1 - scrollProgress * 0.06, [scrollProgress]);
  const promptOpacity = useMemo(() => 1 - scrollProgress * 1.8, [scrollProgress]);

  return (
    <>
      <style>{`
        @keyframes scrollDash {
          to {
            stroke-dashoffset: -20px;
          }
        }

        .dash-animation {
          animation: scrollDash 1s linear infinite;
          animation-play-state: ${isPlaying ? "running" : "paused"};
        }
      `}</style>

      <div className="min-h-[240vh] bg-base-200">
        <section className="sticky top-0 z-10 flex min-h-screen items-start justify-center overflow-hidden px-4 py-6 sm:px-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(76,120,216,0.10),transparent_45%)]" />

          <div
            className="relative z-10 w-full transition-transform duration-300 ease-out"
            style={{
              transform: `scale(${visualizationScale})`,
              transformOrigin: "center top",
              opacity: visualizationOpacity,
            }}
          >
            <div className="mx-auto w-max min-w-full max-w-none space-y-6 overflow-visible">
              <div className="card-body items-center gap-5">
                <p className="font-[family-name:var(--font-hypixel)] text-6xl font-bold tracking-tight text-base-content sm:text-6xl">
                  PPO Explainer
                </p>

                <p className="text-2xl text-base-content/70">
                  Learn How PPO Works with Interactive Visualization
                </p>

                <p className="flex items-center gap-2 text-xl text-base-content/70">
                  <FiGithub />
                  <a className="hover:underline hover:underline-offset-4" href="https://github.com/CaptainHPY/ppo-explainer">
                    Code
                  </a>
                </p>
              </div>

              <Controller
                isPlaying={isPlaying}
                step={step}
                onPlayingChange={setIsPlaying}
                onStepChange={setStep}
              />

              <div
                className="relative mx-auto grid items-center gap-6 overflow-visible px-6 py-10 shadow-xl"
                style={{
                  width: mockupWidth,
                  height: mockupHeight,
                  gridTemplateColumns: expanded ? "804px 460px 460px" : "220px 460px 460px",
                }}
              >
                {expanded ? (
                  <button
                    type="button"
                    aria-label="Return to compact agent"
                    onClick={handleCollapseToHome}
                    className="absolute inset-0 z-10 bg-transparent"
                  />
                ) : null}

                <svg
                  className={`pointer-events-none absolute inset-0 ${expanded ? "mt-24 ml-28" : "-mt-16 ml-18"}`}
                  style={{
                    width: "100%",
                    height: "600px",
                    zIndex: 0,
                  }}
                  viewBox={`0 0 ${mockupWidth} 600`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <marker
                      id="arrowhead-feedback"
                      markerWidth="10"
                      markerHeight="10"
                      refX="9"
                      refY="3"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3, 0 6" fill="var(--color-secondary)" />
                    </marker>
                  </defs>
                  <path
                    d={feedbackPath}
                    stroke="var(--color-secondary)"
                    strokeWidth="3"
                    fill="none"
                    markerEnd="url(#arrowhead-feedback)"
                    strokeDasharray="8,6"
                    strokeLinecap="round"
                    className="dash-animation"
                  />
                </svg>

                <div
                  className={`relative z-20 flex items-center justify-center ${expanded ? "left-22 -top-20" : "left-10 -top-20"}`}
                >
                  <Agent expanded={expanded} step={step} onExpandedChange={setExpanded} />
                </div>

                <div
                  className={`relative z-20 flex min-w-0 items-center justify-center left-106 ${expanded ? "-top-36" : "-top-28"}`}
                >
                  <svg className="h-8 w-26 shrink-0 text-primary" viewBox="0 0 100 32" aria-hidden="true">
                    <line
                      x1="0"
                      y1="16"
                      x2="100"
                      y2="16"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeDasharray="4,3"
                      className="dash-animation"
                    />
                    <polygon points="100,16 94,12 94,20" fill="currentColor" />
                  </svg>

                  <div
                    className="tooltip tooltip-open tooltip-accent flex items-center justify-center rounded-2xl border-2 border-accent bg-accent/10 px-4 py-3 shadow-md min-w-40"
                    data-tip={`π：\n整个动作的概率分布`}
                  >
                    <h3 className="text-sm font-semibold text-accent">采样动作 a</h3>
                  </div>

                  <svg className="h-8 w-7 shrink-0 text-accent" viewBox="0 0 28 32" aria-hidden="true">
                    <line
                      x1="0"
                      y1="16"
                      x2="22"
                      y2="16"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeDasharray="4,3"
                      className="dash-animation"
                    />
                    <polygon points="28,16 22,12 22,20" fill="currentColor" />
                  </svg>

                  <Environment step={step} isPlaying={isPlaying} />

                  <svg
                    className={`h-8 w-32 shrink-0 text-accent ${expanded ? "-translate-x-2" : ""}`}
                    viewBox={expanded ? "0 0 120 32" : "0 0 130 32"}
                    aria-hidden="true"
                  >
                    <line
                      x1="0"
                      y1="16"
                      x2={expanded ? "120" : "130"}
                      y2="16"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeDasharray="4,3"
                      className="dash-animation"
                    />
                    <polygon
                      points={expanded ? "120,16 114,12 114,20" : "130,16 124,12 124,20"}
                      fill="currentColor"
                    />
                  </svg>

                  <svg
                    className={`h-8 w-170 shrink-0 text-primary ${expanded ? "mt-64 -translate-x-166" : "mt-50 -translate-x-164"}`}
                    viewBox={expanded ? "0 0 620 32" : "0 0 640 32"}
                    aria-hidden="true"
                  >
                    <line
                      x1="0"
                      y1="12"
                      x2={expanded ? "620" : "640"}
                      y2="12"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeDasharray="4,3"
                      className="dash-animation"
                    />
                    <polygon
                      points={expanded ? "620,12 614,8 614,16" : "640,12 634,8 634,16"}
                      fill="currentColor"
                    />
                  </svg>
                </div>

                <div className="relative z-20">
                  <Buffer expanded={expanded} step={step} />
                </div>
              </div>

              <div
                className="flex justify-center pb-4 transition-opacity duration-300"
                style={{ opacity: promptOpacity }}
              >
                <div className="rounded-full border border-primary/20 bg-base-100/72 px-4 py-2 text-sm text-base-content/60 shadow-sm">
                  向下滚动查看 PPO 解释文字
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          ref={narrativeRef}
          className="relative z-20 mx-auto flex w-full max-w-6xl justify-center"
        >
          <div className="w-full">
            <PPOStoryPanel
              activeSectionId={activeNarrativeSection}
              onOpenSpiral={() => setIsSpiralOpen(true)}
              onOpenMatrixWave={(phaseId, networkKind) => setMatrixWaveModalState({ phaseId, networkKind })}
            />
          </div>
        </section>

        <SpiralTrainingModal open={isSpiralOpen} onClose={() => setIsSpiralOpen(false)} />
        <NetworkMatrixWaveModal state={matrixWaveModalState} onClose={() => setMatrixWaveModalState(null)} />
      </div>
    </>
  );
}

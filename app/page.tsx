"use client";

import { useState } from "react";
import { FiGithub } from "react-icons/fi";

import Agent from "@/components/agent/Agent";
import Action from "@/components/Action";
import Buffer from "@/components/Buffer";
import Controller, { DEFAULT_STEP } from "@/components/Controller";
import Environment from "@/components/Env";

export default function HomePage() {
  const [expanded, setExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [step, setStep] = useState(DEFAULT_STEP);
  const mockupHeight = expanded ? 750 : 550;
  const mockupWidth = expanded ? 2000 : 1350;
  const feedbackPath = expanded
    ? "M 1580 390 L 1580 520 Q 1580 550 1510 550 L 450 550 Q 400 550 400 500 L 400 390"
    : "M 1040 390 L 1040 500 Q 1040 530 970 530 L 120 530 Q 100 530 100 480 L 100 360";

  function handleCollapseToHome() {
    setExpanded(false);
  }

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

      <div className="flex flex-1 flex-col overflow-x-auto overflow-y-visible bg-base-200 px-4 py-6 sm:px-6">
        <div className="w-max min-w-full max-w-none space-y-6 overflow-visible">
          <div className="card-body items-center gap-5">
            <p className="text-6xl font-bold tracking-tight text-base-content sm:text-6xl font-[family-name:var(--font-hypixel)]">
              PPO Explainer
            </p>

            <p className="text-2xl text-base-content/70">
              Learn How PPO Works with Interactive Visualization
            </p>

            <p className="text-base-content/70 text-xl flex items-center gap-2">
              <FiGithub />
               <a className="hover:underline hover:underline-offset-4" href="https://github.com/CaptainHPY">Code</a>
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
              className={`pointer-events-none absolute inset-0 ${expanded ? "mt-44 ml-28" : "-mt-2 ml-18"}`}
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

            <div className={`relative z-20 flex items-center justify-center ${expanded ? "left-22 -top-8" : "left-10 -top-12"}`}>
              <Agent expanded={expanded} step={step} onExpandedChange={setExpanded} />
            </div>

            <div className={`relative z-20 flex min-w-0 items-center justify-center ${expanded ? "left-110 -top-24" : "left-108 -top-20"}`}>
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

              <Action />

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

              <Environment step={step} />

              <svg 
                className={`h-8 w-32 shrink-0 text-accent ${expanded ? "-translate-x-4" : "-translate-x-2"}`}
                viewBox={expanded ? "0 0 100 32" : "0 0 110 32"}
                aria-hidden="true"
              >
                <line
                  x1="0"
                  y1="16"
                  x2={expanded ? "100" : "110"}
                  y2="16"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                  className="dash-animation"
                />
                <polygon points={expanded ? "100,16 94,12 94,20" : "110,16 104,12 104,20"} fill="currentColor" />
              </svg>

              <svg
                className={`h-8 w-170 shrink-0 text-primary ${expanded ? "mt-64 -translate-x-172" : "mt-50 -translate-x-170"}`}
                viewBox={expanded ? "0 0 620 32" : "0 0 630 32"}
                aria-hidden="true"
              >
                <line
                  x1="0"
                  y1="12"
                  x2={expanded ? "620" : "630"}
                  y2="12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                  className="dash-animation"
                />
                <polygon
                  points={expanded ? "620,12 614,8 614,16" : "630,12 624,8 624,16"}
                  fill="currentColor"
                />
              </svg>
            </div>

            <div className="relative z-20">
              <Buffer expanded={expanded} step={step} />
            </div>

          </div>

        </div>
      </div>
    </>
  );
}

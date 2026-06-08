"use client";

import { useState } from "react";

import Agent from "../components/agent";
import Action from "@/components/Action";
import Buffer from "@/components/Buffer";
import Environment from "@/components/Env";

export default function HomePage() {
  const [expanded, setExpanded] = useState(false);

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
        }
      `}</style>

      <div className="flex flex-1 flex-col overflow-x-auto overflow-y-visible bg-base-200 px-4 py-6 sm:px-6">
        <div className="w-max min-w-full max-w-none space-y-6 overflow-visible">
          <div className="card-body items-center gap-5 font-[family-name:var(--font-hypixel)]">
            <h1 className="text-6xl font-bold tracking-tight text-base-content sm:text-6xl">
              PPO Explainer
            </h1>
          </div>

          <div className="relative mt-16 flex w-max min-w-full flex-nowrap items-center justify-center gap-4 sm:gap-6">
            {expanded ? (
              <button
                type="button"
                aria-label="Return to compact agent"
                onClick={handleCollapseToHome}
                className="absolute inset-0 z-10 bg-transparent"
              />
            ) : null}

            <svg
              className={`absolute pointer-events-none ${expanded ? "mt-102 ml-88" : "mt-8 ml-24"}`}
              style={{
                width: "2000px",
                height: "600px",
                top: "-100px",
                left: 0,
                zIndex: 0,
              }}
              viewBox="0 0 2000 600"
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
                d={
                  expanded
                    ? "M 1240 350 L 1240 450 Q 1240 480 1200 480 L 50 480 Q 10 480 10 450 L 10 340"
                    : "M 1160 350 L 1160 450 Q 1160 480 1100 480 L 250 480 Q 200 480 200 450 L 200 340"
                }
                stroke="var(--color-secondary)"
                strokeWidth="3"
                fill="none"
                markerEnd="url(#arrowhead-feedback)"
                strokeDasharray="8,6"
                strokeLinecap="round"
                className="dash-animation"
              />
            </svg>

            <div className="relative z-20">
              <Agent expanded={expanded} onExpandedChange={setExpanded} />
            </div>

            <div
              className={`relative z-15 -translate-x-8 flex flex-nowrap items-center gap-4 sm:gap-6 ${
                expanded ? "-translate-y-15" : "-translate-y-8"
              }`}
            >
              <svg
                className={`h-8 w-28 shrink-0 text-primary ${expanded ? "-translate-x-10" : "-translate-x-5"}`}
                viewBox={expanded ? "0 0 120 32" : "0 0 70 32"}
                aria-hidden="true"
              >
                <line
                  x1="0"
                  y1="16"
                  x2={expanded ? "120" : "70"}
                  y2="16"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                  className="dash-animation"
                />
                <polygon
                  points={expanded ? "120,16 114,12 114,20" : "70,16 64,12 64,20"}
                  fill="currentColor"
                />
              </svg>

              <Action />

              <svg className="-ml-6 h-8 w-20 shrink-0 text-accent" viewBox="0 0 80 32" aria-hidden="true">
                <line
                  x1="0"
                  y1="16"
                  x2="64"
                  y2="16"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                  className="dash-animation"
                />
                <polygon points="64,16 58,12 58,20" fill="currentColor" />
              </svg>

              <Environment />

              <svg className="h-8 w-32 -translate-x-6 shrink-0 text-accent" viewBox="0 0 120 32" aria-hidden="true">
                <line
                  x1="0"
                  y1="16"
                  x2="120"
                  y2="16"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                  className="dash-animation"
                />
                <polygon points="120,16 114,12 114,20" fill="currentColor" />
              </svg>

              <svg
                className={`h-8 w-170 shrink-0 text-primary ${expanded ? "mt-75 -translate-x-186" : "mt-50 -translate-x-180"}`}
                viewBox={expanded ? "0 0 680 32" : "0 0 650 32"}
                aria-hidden="true"
              >
                <line
                  x1="0"
                  y1="12"
                  x2={expanded ? "680" : "650"}
                  y2="12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                  className="dash-animation"
                />
                <polygon
                  points={expanded ? "680,12 674,8 674,16" : "650,12 644,8 644,16"}
                  fill="currentColor"
                />
              </svg>
            </div>

            <div className="relative z-20">
              <Buffer expanded={expanded} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

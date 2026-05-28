"use client";

import { useEffect, useRef } from "react";
import katex from 'katex';

export default function Buffer({ expanded }: { expanded: boolean }) {
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!ref.current) return;
        try {
        const tex = String.raw`r_t(\theta)=\frac{\pi_{\theta}(a\mid s)}{\pi_{\theta_{\mathrm{old}}}(a\mid s)}`;
        ref.current.innerHTML = katex.renderToString(tex, { throwOnError: false });
        } catch (e) {
        ref.current.textContent = 'r_t(θ) = πθ(a|s) / πold(a|s)';
        }
    }, []);
    
    return (
        <div className="-ml-196 mt-4 rounded-2xl border-2 border-secondary bg-secondary/10 px-6 py-6 shadow-md"
            style={{ height: expanded ? 630 : 240 }} >
            <div className={`flex h-full flex-col gap-3 ${expanded ? "mt-40" : "-mt-4"}`}>
                <div className="flex flex-col items-center gap-2">
                    <h3 className="text-sm font-semibold text-secondary">PPO Buffer</h3>
                    <p className="text-xs text-base-content/60">存储若干条 (状态, 动作, 奖励, 新状态) 元组</p>
                    <p className="text-xs text-base-content/60">应用PPO核心创新点之一——策略裁剪进行网络更新</p>
                </div>

                <div className="rounded-xl border border-secondary/25 bg-base-100/70 px-3 shadow-sm">
                    <div className="-mt-2 flex items-center justify-between text-[11px] font-medium">
                        <span className="text-secondary mt-2">PPO Clip</span>
                        <div ref={ref} className="text-sm text-base-content/70 mt-2" aria-hidden="false" />
                    </div>

                    <svg viewBox="0 0 360 120" className="h-28 w-full" aria-hidden="true">
                        <line x1="24" y1="58" x2="336" y2="58" stroke="var(--color-secondary)" strokeOpacity="0.35" strokeWidth="2" />

                        <rect
                            x="120"
                            y="44"
                            width="120"
                            height="28"
                            rx="14"
                            fill="var(--color-secondary)"
                            fillOpacity="0.12"
                            stroke="var(--color-secondary)"
                            strokeDasharray="4 4"
                            strokeOpacity="0.55"
                        />

                        <line x1="120" y1="34" x2="120" y2="82" stroke="var(--color-secondary)" strokeOpacity="0.45" strokeWidth="2" />
                        <line x1="240" y1="34" x2="240" y2="82" stroke="var(--color-secondary)" strokeOpacity="0.45" strokeWidth="2" />

                        <circle cx="164" cy="58" r="8" fill="var(--color-secondary)" fillOpacity="0.9" />
                        <circle cx="286" cy="58" r="8" fill="var(--color-accent)" fillOpacity="0.95" />

                        <line x1="164" y1="58" x2="286" y2="58" stroke="var(--color-accent)" strokeWidth="3" strokeDasharray="6 5" />

                        <text x="113" y="26" fill="var(--color-base-content)" fillOpacity="0.7" fontSize="11">1-ε</text>
                        <text x="173" y="26" fill="var(--color-base-content)" fillOpacity="0.7" fontSize="11">1.0</text>
                        <text x="232" y="26" fill="var(--color-base-content)" fillOpacity="0.7" fontSize="11">1+ε</text>
                        <text x="150" y="96" fill="var(--color-base-content)" fillOpacity="0.72" fontSize="11">old policy</text>
                        <text x="264" y="96" fill="var(--color-base-content)" fillOpacity="0.72" fontSize="11">new policy</text>
                        <text x="250" y="52" fill="var(--color-accent)" fillOpacity="0.95" fontSize="11">clip</text>
                    </svg>
                </div>
            </div>
        </div>
    );
}
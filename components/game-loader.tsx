"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useI18n } from "@/lib/i18n/context"

export function GameLoader({ stage, progress }: { stage?: string; progress?: number }) {
  const { t } = useI18n()
  const targetPercent = Math.max(0, Math.min(100, progress ?? 0))
  const [animatedPercent, setAnimatedPercent] = useState(0)

  useEffect(() => {
    setAnimatedPercent((prev) => {
      if (targetPercent <= prev) return targetPercent
      return prev
    })
  }, [targetPercent])

  useEffect(() => {
    if (animatedPercent === targetPercent) return
    const timer = setInterval(() => {
      setAnimatedPercent((prev) => {
        if (prev === targetPercent) return prev
        const diff = targetPercent - prev
        const step = Math.max(1, Math.ceil(Math.abs(diff) / 6))
        const next = prev + Math.sign(diff) * step
        if ((diff > 0 && next >= targetPercent) || (diff < 0 && next <= targetPercent)) {
          return targetPercent
        }
        return next
      })
    }, 40)
    return () => clearInterval(timer)
  }, [animatedPercent, targetPercent])

  const displayPercent = Math.round(animatedPercent)

  return (
    <div className="rps-loader-overlay">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative h-44 w-44 sm:h-48 sm:w-48 animate-pulse">
          <Image
            src="/logo.webp"
            alt={t("loaderLogoAlt")}
            fill
            className="object-contain drop-shadow-[0_0_20px_rgba(34,211,238,0.65)]"
            priority
          />
        </div>
      </div>
      <div className="rps-loader-bar-wrap">
        <div className="rps-loader-bar-track">
          <div
            className="absolute inset-y-0 left-0 rounded-[inherit] transition-[width] duration-300 ease-out"
            style={{
              width: `${displayPercent}%`,
              background: "linear-gradient(90deg, #22c55e, #22d3ee, #a855f7, #facc15)",
              backgroundSize: "220% 100%",
            }}
          />
        </div>
        <div className="mt-1 flex items-center justify-center gap-3">
          <div className="rps-loader-text mt-0">{t("loaderArena")}</div>
          <div className="text-[11px] font-semibold text-white/80">{displayPercent}%</div>
        </div>
        {stage ? <div className="mt-2 text-center text-xs text-white/75">{stage}</div> : null}
      </div>
    </div>
  )
}


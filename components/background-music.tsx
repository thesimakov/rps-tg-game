"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Volume2, VolumeX } from "lucide-react"
import { useI18n } from "@/lib/i18n/context"

const STORAGE_KEY = "rps_bg_music"
const VOLUME_KEY = "rps_bg_music_volume"
// Учитываем basePath для деплоя со вложенным путём.
const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "")
const MUSIC_SRC = `${BASE_PATH}/bg-music.mp3`

const DEFAULT_ENABLED = true
const DEFAULT_VOLUME = 0.5

function clamp01(v: number) {
  if (!Number.isFinite(v)) return DEFAULT_VOLUME
  return Math.min(1, Math.max(0, v))
}

export function BackgroundMusic() {
  const { t } = useI18n()
  const [enabled, setEnabled] = useState(DEFAULT_ENABLED)
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  const [volume, setVolume] = useState(DEFAULT_VOLUME)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const loadStoredEnabled = useCallback((): boolean | null => {
    if (typeof window === "undefined") return null
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored == null) return null
      return stored === "1"
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    const storedEnabled = loadStoredEnabled()
    setEnabled(storedEnabled ?? DEFAULT_ENABLED)
    try {
      const v = window.localStorage.getItem(VOLUME_KEY)
      setVolume(v != null ? clamp01(Number(v)) : DEFAULT_VOLUME)
    } catch {}
  }, [loadStoredEnabled])

  useEffect(() => {
    const audio = new Audio(MUSIC_SRC)
    audio.loop = true
    audio.volume = volume
    audio.preload = "auto"
    const onCanPlay = () => setReady(true)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onError = () => setReady(false)
    audio.addEventListener("canplaythrough", onCanPlay)
    audio.addEventListener("play", onPlay)
    audio.addEventListener("pause", onPause)
    audio.addEventListener("error", onError)
    audioRef.current = audio
    return () => {
      audio.pause()
      audio.removeEventListener("canplaythrough", onCanPlay)
      audio.removeEventListener("play", onPlay)
      audio.removeEventListener("pause", onPause)
      audio.removeEventListener("error", onError)
      audioRef.current = null
    }
  }, [])

  // Автоматически пытаемся запустить музыку сразу после успешного входа.
  // GameProvider диспатчит событие rps_login_success, когда авторизация завершена.
  useEffect(() => {
    if (typeof window === "undefined") return
    const handler = () => {
      const audio = audioRef.current
      if (!audio) return
      if (!enabled) return
      if (!ready) return
      audio.play().catch(() => {})
    }
    window.addEventListener("rps_login_success", handler)
    return () => {
      window.removeEventListener("rps_login_success", handler)
    }
  }, [enabled, ready])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    try {
      window.localStorage.setItem(VOLUME_KEY, String(volume))
    } catch {}
  }, [volume])

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0")
    } catch {}
  }, [enabled])

  const toggle = useCallback(() => {
    const next = !enabled
    setEnabled(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0")
    } catch {}
    if (next && audioRef.current && ready) {
      audioRef.current.play().catch(() => {})
    } else if (!next && audioRef.current) {
      audioRef.current.pause()
    }
  }, [enabled, ready])

  return (
    <div className="relative group">
      {/* Ползунок громкости (появляется при наведении/фокусе над иконкой) */}
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-card/95 border border-border/60 shadow-lg backdrop-blur">
          <span className="text-[10px] font-bold text-muted-foreground tabular-nums w-8 text-right">
            {Math.round(volume * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(volume * 100)}
            onChange={(e) =>
              setVolume(clamp01(Number(e.target.value) / 100))
            }
            className="w-24 accent-primary"
            aria-label={t("bgMusicVolume")}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={toggle}
        className="p-2.5 rounded-full bg-card/90 border border-border/50 text-foreground shadow-lg hover:bg-card transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={enabled && playing ? t("backgroundMusicOff") : t("backgroundMusicOn")}
        title={enabled && playing ? t("backgroundMusicOn") : t("backgroundMusicOff")}
      >
        {enabled && playing ? (
          <Volume2 className="h-5 w-5 text-primary" />
        ) : (
          <VolumeX className="h-5 w-5 text-muted-foreground" />
        )}
      </button>
    </div>
  )
}

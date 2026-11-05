import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { clsx } from 'clsx'
import { buildTimeline, type Frame } from '../../../mockTimeline'
import { IconPause } from '../../base/icons'
import { Transcript } from './Transcript'

/** 虚拟时钟：按 speed 推进，播完自动停 */
function usePlayback(timeline: { frames: Frame[]; total: number }): {
  blocks: Frame['blocks']
  streaming: boolean
  clock: number
  playing: boolean
  speed: number
  setSpeed: (v: number) => void
  toggle: () => void
  restart: () => void
  end: () => void
} {
  const [clock, setClock] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [playing, setPlaying] = useState(true)
  const raf = useRef(0)

  useEffect(() => {
    if (!playing) return
    let last = performance.now()
    const tick = (now: number): void => {
      const dt = (now - last) * speed
      last = now
      setClock((c) => c + dt)
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [playing, speed])

  useEffect(() => {
    if (timeline.total > 0 && clock > timeline.total) setPlaying(false)
  }, [clock, timeline.total])

  const blocks = useMemo(() => {
    const frames = timeline.frames
    let lo = 0
    let hi = frames.length - 1
    let hit = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (frames[mid].t <= clock) {
        hit = mid
        lo = mid + 1
      } else hi = mid - 1
    }
    return hit < 0 ? [] : frames[hit].blocks
  }, [clock, timeline])

  return {
    blocks,
    streaming: clock < timeline.total,
    clock,
    playing,
    speed,
    setSpeed,
    toggle: () => setPlaying((v) => !v),
    restart: () => {
      setClock(0)
      setPlaying(true)
    },
    end: () => {
      setPlaying(false)
      setClock(timeline.total)
    }
  }
}

/** 体检：帧间隔、长任务、DOM 数（只数对话块容器内的）。上限只留最近 180 帧 */
function usePerf(scope: RefObject<HTMLElement | null>): { p95: number; max: number; long: number; dom: number } {
  const [perf, setPerf] = useState({ p95: 0, max: 0, long: 0, dom: 0 })
  useEffect(() => {
    const gaps: number[] = []
    let last = performance.now()
    let raf = 0
    const loop = (now: number): void => {
      const gap = now - last
      last = now
      if (gap < 500) gaps.push(gap)
      if (gaps.length > 180) gaps.shift()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    let long = 0
    let obs: PerformanceObserver | undefined
    try {
      obs = new PerformanceObserver((l) => {
        long += l.getEntries().length
      })
      obs.observe({ entryTypes: ['longtask'] })
    } catch {
      // 老内核没有 longtask
    }

    const id = setInterval(() => {
      const sorted = [...gaps].sort((a, b) => a - b)
      setPerf({
        p95: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
        max: sorted[sorted.length - 1] ?? 0,
        long,
        dom: scope.current?.querySelectorAll('*').length ?? 0
      })
    }, 500)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(id)
      obs?.disconnect()
    }
  }, [scope])
  return perf
}

const btn = 'h-7 rounded-sm px-2 text-xs transition-colors'

/** 对话块试装间：脚本模拟 pi 的工具调用与延时，带播放控制与体检数字 */
export function MockStage(): ReactNode {
  const [rounds, setRounds] = useState(0)
  const timeline = useMemo(() => buildTimeline(rounds), [rounds])
  const { blocks, streaming, clock, playing, speed, setSpeed, toggle, restart, end } = usePlayback(timeline)
  const scroller = useRef<HTMLDivElement>(null)
  const perf = usePerf(scroller)

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 160
    if (near || clock < 1200) el.scrollTop = el.scrollHeight
  }, [blocks, clock])

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" onClick={toggle} className={clsx(btn, 'pi-icon-btn w-7')} aria-label={playing ? '暂停' : '继续'}>
          {playing ? <IconPause /> : <span>▶</span>}
        </button>
        <button type="button" onClick={restart} className={clsx(btn, 'text-muted hover:bg-sunken hover:text-fg')}>
          重播
        </button>
        <button type="button" onClick={end} className={clsx(btn, 'text-muted hover:bg-sunken hover:text-fg')}>
          末尾
        </button>
        <span className="mx-1 h-4 w-px bg-edge" />
        {[1, 2, 4].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className={clsx(btn, speed === s ? 'bg-select text-fg' : 'text-muted hover:bg-sunken hover:text-fg')}
          >
            {s}×
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-edge" />
        {[0, 20, 60].map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setRounds(r)
              restart()
            }}
            className={clsx(btn, rounds === r ? 'bg-select text-fg' : 'text-muted hover:bg-sunken hover:text-fg')}
          >
            {r === 0 ? '无历史' : `${r} 回合`}
          </button>
        ))}
        <span className="ml-auto font-mono text-2xs text-muted">
          p95 {perf.p95.toFixed(1)}ms · 最长 {perf.max.toFixed(1)}ms · 长任务 {perf.long} · DOM{' '}
          {perf.dom} · 块 {blocks.length} · {(clock / 1000).toFixed(1)}s
        </span>
      </div>

      <div ref={scroller} className="pi-panel h-[520px] overflow-y-auto">
        <div className="mx-auto w-full max-w-[720px] px-6 py-4">
          <Transcript blocks={blocks} streaming={streaming} />
        </div>
      </div>
    </div>
  )
}

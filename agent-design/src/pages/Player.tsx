import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  IconChevronDownOutlineRegular,
  IconChevronUpOutlineRegular,
  IconPauseOutlineRegular,
  IconPlayOutlineRegular,
  IconRefreshOutlineRegular,
  IconSendOutlineRegular,
} from '../icons'
import { zh } from '../i18n/zh'
import { describeEvent, formatClock, formatDuration } from '../lib/format'
import { useReplay } from '../lib/useReplay'
import { TurnView } from '../blocks'
import type { Fixture, FixtureEvent } from '../reducer/types'

interface FixtureMeta {
  readonly id: string
  readonly label: string
  readonly note?: string
  readonly truncated?: boolean
  readonly events: number
  readonly durationMs: number
  readonly source?: { readonly file: string; readonly lines?: readonly number[] }
}

const BASE = import.meta.env.BASE_URL

async function fetchFixture(id: string): Promise<Fixture> {
  const response = await fetch(`${BASE}fixtures/${id}.json`)
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return (await response.json()) as Fixture
}

/** 回放页：左侧夹具、中间对话、底部调试抽屉。 */
export function Player() {
  const [list, setList] = useState<readonly FixtureMeta[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [fixture, setFixture] = useState<Fixture | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`${BASE}fixtures/index.json`)
      .then(response => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
        return response.json() as Promise<FixtureMeta[]>
      })
      .then(metas => {
        if (cancelled) return
        setList(metas)
        setActiveId(metas[0]?.id ?? null)
      })
      .catch(err => {
        if (!cancelled) setError(String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (activeId === null) return
    let cancelled = false
    setFixture(null)
    fetchFixture(activeId)
      .then(next => {
        if (!cancelled) setFixture(next)
      })
      .catch(err => {
        if (!cancelled) setError(String(err))
      })
    return () => {
      cancelled = true
    }
  }, [activeId])

  const events = useMemo<readonly FixtureEvent[]>(() => fixture?.events ?? [], [fixture])
  const replay = useReplay(events)
  const scroller = useRef<HTMLDivElement>(null)

  // 播放时贴底；用户往回滚后不再抢滚动
  useEffect(() => {
    if (!replay.playing) return
    const element = scroller.current
    if (element === null) return
    element.scrollTop = element.scrollHeight
  }, [replay.playing, replay.index, replay.state])

  const meta = list.find(item => item.id === activeId)
  const progress = replay.durationMs > 0 ? replay.cursorMs / replay.durationMs : 0

  const stats = useMemo(() => {
    const blocks = Object.values(replay.state.blocks)
    return {
      turns: replay.state.turns.length,
      blocks: blocks.length,
      tools: blocks.filter(block => block.kind === 'tool').length,
      errors: blocks.filter(block => block.kind === 'tool' && block.state === 'error').length,
    }
  }, [replay.state])

  const recent = events.slice(Math.max(0, replay.index - 8), replay.index)

  return (
    <div className="player">
      <aside className="rail">
        <div className="railTitle">{zh.fixture}</div>
        <ul className="fixtureList">
          {list.map(item => (
            <li key={item.id}>
              <button
                type="button"
                className="fixtureButton"
                data-active={item.id === activeId || undefined}
                onClick={() => setActiveId(item.id)}
              >
                <span className="fixtureLabel">
                  {item.label}
                  {item.truncated && <span className="badge">{zh.player.truncated}</span>}
                </span>
                <span className="fixtureMeta">
                  {item.events} 事件 · {formatDuration(item.durationMs)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className="main">
        <div className="toolbar">
          <button
            type="button"
            className="iconButton"
            data-primary
            onClick={replay.toggle}
            disabled={events.length === 0}
            title={replay.playing ? zh.player.pause : zh.player.play}
          >
            {replay.playing ? <IconPauseOutlineRegular size={14} /> : <IconPlayOutlineRegular size={14} />}
            <span>{replay.playing ? zh.player.pause : zh.player.play}</span>
          </button>
          <button
            type="button"
            className="iconButton"
            onClick={replay.restart}
            disabled={events.length === 0}
            title={zh.player.restart}
          >
            <IconRefreshOutlineRegular size={14} />
          </button>
          <button
            type="button"
            className="iconButton"
            onClick={() => replay.seekRatio(1)}
            disabled={events.length === 0}
            title={zh.player.toEnd}
          >
            <IconSendOutlineRegular size={14} />
          </button>

          <div className="progress">
            <input
              className="slider"
              type="range"
              min={0}
              max={1000}
              value={Math.round(progress * 1000)}
              onChange={event => replay.seekRatio(Number(event.target.value) / 1000)}
              aria-label={zh.player.progress}
            />
            <span className="progressText">
              {formatClock(replay.cursorMs)} / {formatClock(replay.durationMs)} · {replay.index}/{events.length}
            </span>
          </div>

          <label className="speed">
            <span className="label">{zh.player.speed}</span>
            <select value={replay.speed} onChange={event => replay.setSpeed(Number(event.target.value))}>
              {[0.5, 1, 2, 4, 8].map(value => (
                <option key={value} value={value}>
                  {value}×
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="scroller" ref={scroller}>
          {error !== null && <div className="empty">{error}</div>}
          {error === null && fixture === null && <div className="empty">{zh.player.loading}</div>}
          {fixture !== null && (
            <div className="transcript pi-blocks">
              {replay.state.turns.length === 0 && <div className="empty">{zh.player.noFixture}</div>}
              {replay.state.turns.map(turn => (
                <TurnView
                  turn={turn}
                  state={replay.state}
                  scope={fixture.id}
                  now={turn.status === 'live' ? Math.floor(replay.cursorMs / 1000) * 1000 : undefined}
                  key={turn.key}
                />
              ))}
            </div>
          )}
        </div>

        <div className="drawer">
          <button type="button" className="drawerHead" onClick={() => setDebugOpen(value => !value)}>
            {debugOpen ? <IconChevronDownOutlineRegular size={12} /> : <IconChevronUpOutlineRegular size={12} />}
            <span>{zh.player.debug}</span>
            <span className="spacer" />
            {meta?.source !== undefined && (
              <span className="label">
                {meta.label} · {meta.source.file.slice(0, 40)}
                {meta.source.lines !== undefined && ` L${meta.source.lines[0]}–${meta.source.lines[1]}`}
              </span>
            )}
          </button>
          {debugOpen && (
            <div className="drawerBody">
              <div>
                <div className="drawerLabel">{zh.player.recentEvents}</div>
                <ol className="eventList">
                  {recent.map((event, offset) => (
                    <li key={replay.index - recent.length + offset}>
                      <span className="eventIndex">#{replay.index - recent.length + offset}</span>
                      <span>+{event.dt}ms</span>
                      <span>{describeEvent(event.ev as { type: string } & Record<string, unknown>)}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <div className="drawerLabel">{zh.player.stats}</div>
                <dl className="stats">
                  <div>
                    <dt>{zh.player.turns}</dt>
                    <dd>{stats.turns}</dd>
                  </div>
                  <div>
                    <dt>{zh.player.blocks}</dt>
                    <dd>{stats.blocks}</dd>
                  </div>
                  <div>
                    <dt>{zh.player.tools}</dt>
                    <dd>{stats.tools}</dd>
                  </div>
                  <div>
                    <dt>{zh.player.errors}</dt>
                    <dd className={clsx(stats.errors > 0 && 'toolError')}>{stats.errors}</dd>
                  </div>
                  <div>
                    <dt>已应用</dt>
                    <dd>
                      {replay.index}/{events.length}
                    </dd>
                  </div>
                  <div>
                    <dt>状态</dt>
                    <dd>{replay.state.turns.at(-1)?.status ?? '—'}</dd>
                  </div>
                </dl>
                {meta?.note !== undefined && <p className="note">{meta.note}</p>}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

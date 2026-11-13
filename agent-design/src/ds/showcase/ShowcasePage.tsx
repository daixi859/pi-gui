import { memo, useMemo, type ReactNode } from 'react'
import { DsIcon } from '../icons/DsIcon'
import { PiRoot } from '../theme/PiRoot'
import { ALL_DOCS, DOC_GROUPS, findDoc, type ComponentDoc } from './docs'
import css from './showcase.module.css'

/** 组件页 props。 */
export interface ShowcasePageProps {
  /** 当前组件 id；不传则显示第一篇。 */
  activeId?: string | undefined
  /** 切换组件。 */
  onSelect: (id: string) => void
}

/**
 * 基础组件页：左侧分组列表 + 右侧详情。
 *
 * 详情按固定顺序回答六个问题：它是什么 → 何时用/不用 → 全状态矩阵 →
 * 尺寸变体 → props 与键盘 → 深浅两套主题下的样子。
 * 双主题并排是本页的验收条件：一个只在浅色下好看的组件没有交付。
 * @param props - 当前组件与切换回调。
 * @returns 组件页。
 */
export const ShowcasePage = memo(function ShowcasePage({ activeId, onSelect }: ShowcasePageProps) {
  const active = useMemo(() => (activeId === undefined ? ALL_DOCS[0] : findDoc(activeId)) ?? ALL_DOCS[0], [activeId])

  return (
    <div className={css.page}>
      <nav className={css.list} aria-label="基础组件列表">
        {DOC_GROUPS.map(group => (
          <div key={group.id} className={css.listGroup}>
            <div className={css.listGroupLabel}>{group.label}</div>
            {group.items.map(doc => (
              <button
                key={doc.id}
                type="button"
                className={css.listItem}
                data-active={doc.id === active.id || undefined}
                aria-current={doc.id === active.id ? 'page' : undefined}
                onClick={() => onSelect(doc.id)}
                title={doc.name}
              >
                <span className={css.listItemIcon}>
                  <DsIcon name={doc.icon} size={14} />
                </span>
                <span>{doc.name}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className={css.doc}>
        <div className={css.docInner} key={active.id}>
          <DocBody doc={active} />
        </div>
      </div>
    </div>
  )
})

/** 单篇组件文档。 */
function DocBody({ doc }: { doc: ComponentDoc }) {
  return (
    <>
      <header className={css.head}>
        <div className={css.headTop}>
          <span className={css.headIcon}>
            <DsIcon name={doc.icon} size={15} />
          </span>
          <h1 className={css.headName}>{doc.name}</h1>
        </div>
        <p className={css.headSummary}>{doc.summary}</p>
        <div className={css.headMeta}>
          <ScopeBadge />
        </div>
      </header>

      <Section title="何时用 / 何时不用">
        <div className={css.useGrid}>
          <div className={css.useCard} data-tone="use">
            <div className={css.useCardTitle}>
              <DsIcon name="check" size={13} /> 用
            </div>
            <ul className={css.useList}>
              {doc.use.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className={css.useCard} data-tone="avoid">
            <div className={css.useCardTitle}>
              <DsIcon name="ban" size={13} /> 不用
            </div>
            <ul className={css.useList}>
              {doc.avoid.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title="状态矩阵" note="每个组件都必须把状态画全：禁用态和聚焦态最常被漏掉，而它们恰恰是用户最容易撞上的。">
        <div className={css.stateGrid}>
          {doc.states.map(state => (
            <div key={state.label} className={css.stateCell}>
              <div className={css.stateStage}>{state.node}</div>
              <div className={css.stateLabel}>{state.label}</div>
              {state.note !== undefined && <div className={css.stateNote}>{state.note}</div>}
            </div>
          ))}
        </div>
      </Section>

      {doc.sizes !== undefined && (
        <Section title="尺寸变体">
          <div className={css.sizeRow}>{doc.sizes}</div>
        </Section>
      )}

      <Section title="Props">
        <table className={css.table}>
          <thead>
            <tr>
              <th>属性</th>
              <th>类型</th>
              <th>默认</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            {doc.props.map(row => (
              <tr key={row.name}>
                <td className={css.propName}>{row.name}</td>
                <td className={css.propType}>{row.type}</td>
                <td className={css.propDefault}>{row.default}</td>
                <td>{row.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="键盘与 ARIA">
        <table className={css.table}>
          <thead>
            <tr>
              <th>按键</th>
              <th>行为</th>
            </tr>
          </thead>
          <tbody>
            {doc.keyboard.map(row => (
              <tr key={row.keys}>
                <td className={css.keyKeys}>{row.keys}</td>
                <td>{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="深浅双主题" note="同一份代码、同一组语义令牌，只换主题属性。两栏必须都成立，否则组件算没做完。">
        <div className={css.themeRow}>
          <div className={css.themePane}>
            <div className={css.themeLabel}>
              <DsIcon name="sun" size={12} /> 浅色
            </div>
            <PiRoot forceTheme="light" className={css.themePaneInner}>
              {doc.sample}
            </PiRoot>
          </div>
          <div className={css.themePane}>
            <div className={css.themeLabel}>
              <DsIcon name="moon" size={12} /> 深色
            </div>
            <PiRoot forceTheme="dark" className={css.themePaneInner}>
              {doc.sample}
            </PiRoot>
          </div>
        </div>
      </Section>

      {doc.notes !== undefined && doc.notes.length > 0 && (
        <Section title="实现备注">
          <ul className={css.notes}>
            {doc.notes.map((note, index) => (
              <li key={note} className={css.note}>
                <span className={css.noteMark}>{String(index + 1).padStart(2, '0')}</span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  )
}

/** 区块：标题 + 可选说明 + 内容。 */
function Section({ title, note, children }: { title: string; note?: string | undefined; children: ReactNode }) {
  return (
    <section className={css.block}>
      <h2 className={css.blockTitle}>{title}</h2>
      {note !== undefined && <p className={css.blockNote}>{note}</p>}
      {children}
    </section>
  )
}

/** 范围徽标：这一篇属于 P0 交付，写清楚以免读者以为还有别的。 */
function ScopeBadge() {
  return <span className={css.scopeBadge}>P0 · 已交付</span>
}

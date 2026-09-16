import { useMemo, useState } from 'react'
import { CONFIGURATOR_STEP } from '../state/chapters'
import { KG_CHAPTER_STEP, responsibilityFor, useStore } from '../state/store'
import {
  MATRIX_COLUMNS, MATRIX_GROUPS, MATRIX_SOURCE, markOf, matrixCounts,
  type MatrixColumn, type MatrixRow,
} from '../state/interfaceMatrix'
import { Checkbox } from '../components/controls'
import { useT } from '../i18n'
import { NNBSP } from '../engine/money'
import { Button } from '../components/primitives'
import { KGConfigurationPage } from '../design-system/KGConfiguration'
import { DataTable } from '../design-system/DataTable'
import { SemanticStatus } from '../design-system/SemanticStatus'

/**
 * Schnittstellen & Verantwortung — the dedicated Configurator step
 * (VR3-TGA-UX-00, target T-12).
 *
 * INTERIM / STRUCTURAL TARGET — NOT THE FINAL RESPONSIBILITY MATRIX DESIGN.
 *
 * This screen proves two things and deliberately nothing more: that the
 * interface/responsibility truth has ONE owner outside KG 400, and that the
 * step exists in the canonical order (KG 700 → here → Terminplan) with a
 * route, a spine entry, Previous/Next and a review section. What it shows is
 * exactly what the retired eighth "system" of KG 400 showed — the scope
 * boundary, the handover point, the four utility media with their status,
 * the source and the offer condition — recomposed only enough to be coherent
 * on its own page. The final matrix interaction model is a future, user-led
 * target and is not designed here.
 *
 * READ-ONLY BY INHERITANCE, not by omission. The retired services were
 * `readOnlyRequired`; nothing here was editable before and nothing becomes
 * editable by moving. The Option-owned record (`responsibility`) is the
 * owner a future editor writes to; this surface reads it through the ONE
 * selector (`responsibilityFor`) every other consumer reads.
 *
 * NO EURO. `Hausanschlüsse` is the Bauherr's; the boundary carries no cost
 * authority. An unresolved medium is a CONDITION the offer names — the
 * review lists it as a permitted warning — never an amount, never a gap.
 */
export function ResponsibilityStage() {
  const s = useStore()
  const t = useT()
  const en = s.uiLanguage === 'en'
  const label = (de: string, enText: string) => (en ? enText : de)
  const responsibility = responsibilityFor(s)
  const unresolved = responsibility?.unresolved.length ?? 0
  /**
   * `v4` ONLY, deliberately. The Schnittstellenmatrix replaces the four
   * utility-media rows on this step with the contract's own 206 positions —
   * a different subject at a different scale — and the released variants
   * keep exactly what they shipped with. Same reason every other variant
   * gate in this file exists: a navigation experiment must not silently
   * re-scope a step for the versions nobody agreed to change.
   */
  const matrix = s.navVariant === 'v4'

  const previous = (
    <Button onClick={() => s.openConfiguratorStepAt(KG_CHAPTER_STEP.KG_700)}>
      {t('vr3.kg.page.previous', { group: `KG${NNBSP}700` })}
    </Button>
  )
  const next = (
    <Button
      variant="primary"
      onClick={() => s.openConfiguratorStepAt(CONFIGURATOR_STEP.COMMERCIAL_SCHEDULE)}
    >
      {t('vr3.kg.page.toSchedule')}
    </Button>
  )

  return (
    <KGConfigurationPage
      identity={t('vr3.responsibility.eyebrow')}
      title={t('vr3.responsibility.heading')}
      lead={t('vr3.responsibility.lead')}
      progress={unresolved > 0
        ? {
          tone: 'attention',
          label: t(unresolved === 1
            ? 'vr3.responsibility.state.open'
            : 'vr3.responsibility.state.openPlural', { count: unresolved }),
        }
        : { tone: 'ok', label: t('vr3.responsibility.state.derived') }}
      previousAction={previous}
      nextAction={next}
    >
      <div className="a3-resp" data-responsibility-stage data-origin={responsibility?.origin}>
        {/* The interim label is PART OF THE IMPLEMENTATION EVIDENCE the
            ticket requires, visible on the surface and not only in prose. */}
        <aside className="a3-resp-interim" aria-label={t('vr3.responsibility.interim.title')}>
          <p className="a3-resp-interim-k">{t('vr3.responsibility.interim.title')}</p>
          <p className="a3-resp-interim-b">{t('vr3.responsibility.interim.body')}</p>
        </aside>

        {!responsibility && (
          <p className="a3-resp-empty">{t('vr3.responsibility.empty')}</p>
        )}

        {responsibility && (
          <>
            <section
              className="a3-resp-boundary"
              aria-label={label(
                responsibility.scopeBoundary.labelDe, responsibility.scopeBoundary.labelEn,
              )}
            >
              <h2 className="a3-resp-boundary-h">
                <span className="a3-resp-boundary-k">
                  {label(responsibility.scopeBoundary.labelDe, responsibility.scopeBoundary.labelEn)}
                </span>
                <span className="a3-resp-boundary-v">
                  {t('vr3.responsibility.boundary.all3From', {
                    handover: label(
                      responsibility.scopeBoundary.handoverDe,
                      responsibility.scopeBoundary.handoverEn,
                    ),
                  })}
                </span>
              </h2>
              <p className="a3-resp-boundary-b">
                {label(responsibility.scopeBoundary.summaryDe, responsibility.scopeBoundary.summaryEn)}
              </p>
              <p className="a3-resp-origin">
                <span className="a3-resp-origin-k">{t('vr3.responsibility.origin')}</span>
                <span>
                  {label(
                    responsibility.scopeBoundary.source.originDe,
                    responsibility.scopeBoundary.source.originEn,
                  )}
                </span>
              </p>
            </section>

            {matrix ? <InterfaceMatrix /> : (
            <DataTable
              caption={t('vr3.responsibility.table.caption')}
              className="a3-resp-table"
              columns={[
                { key: 'medium', header: t('vr3.responsibility.table.medium') },
                { key: 'client', header: t('vr3.responsibility.table.client') },
                { key: 'all3', header: t('vr3.responsibility.table.all3') },
                { key: 'status', header: t('vr3.responsibility.table.status') },
              ]}
              rows={responsibility.media.map((medium) => ({
                key: medium.id,
                header: label(medium.labelDe, medium.labelEn),
                cells: [
                  { content: label(medium.clientDe, medium.clientEn) },
                  { content: label(medium.all3FromDe, medium.all3FromEn) },
                  {
                    // A WORD beside a glyph, never a colour alone (rule 8).
                    content: (
                      <SemanticStatus
                        tone={medium.status === 'ok' ? 'ok' : 'attention'}
                        label={t(`vr3.responsibility.status.${medium.status}`)}
                        size="compact"
                      />
                    ),
                  },
                ],
              }))}
            />
            )}

            {/* The sheet's own provenance. The matrix is a contract document,
                and a contract document without its source is an opinion. */}
            {matrix && <p className="a3-resp-origin">
              <span className="a3-resp-origin-k">{t('vr3.responsibility.origin')}</span>
              <span>{MATRIX_SOURCE}</span>
            </p>}

            <p className="a3-resp-origin">
              <span className="a3-resp-origin-k">{t('vr3.responsibility.origin')}</span>
              <span>
                {label(
                  responsibility.connections.source.originDe,
                  responsibility.connections.source.originEn,
                )}
                {' · '}
                {t('vr3.tga.price.bauherr')}
              </span>
            </p>
            <p className="a3-resp-note">
              {label(responsibility.connections.offerNoteDe, responsibility.connections.offerNoteEn)}
            </p>
            {responsibility.origin === 'legacy' && (
              <p className="a3-resp-note">{t('vr3.responsibility.legacy')}</p>
            )}
          </>
        )}
      </div>
    </KGConfigurationPage>
  )
}

/**
 * Die Schnittstellenmatrix — 206 contract positions, foldable, with the
 * three assignments as checkboxes.
 *
 * FOLDED BY DEFAULT, AND THAT IS THE POINT. Open, the sheet is two hundred
 * rows: a scroll, not a reading. The four chapters carry their own counts
 * («34 Positionen · 31 zugeordnet»), so the reader chooses where to go
 * before opening anything, and a chapter with nothing assigned is visible as
 * such while still closed.
 *
 * THE STATE IS THE CONSUMER'S. `DataTable` stays stateless: this component
 * decides what is open and hands it the rows that are visible right now.
 *
 * `(x)` READS AS A TICK, by the owner's decision (16.09). The sheet writes
 * `x` and `(x)` for «assigned» and «assigned under a condition», and the
 * word that told them apart is gone from the screen; the distinction is
 * still in the data (`conditional`), so it can come back without a second
 * import, and the condition itself is in the sheet's comment column, which
 * this screen does not show.
 */
function InterfaceMatrix() {
  const s = useStore()
  const t = useT()
  const marks = s.interfaceMatrix
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())

  const toggle = (nr: string) => setOpen((current) => {
    const next = new Set(current)
    if (next.has(nr)) next.delete(nr); else next.add(nr)
    return next
  })

  /** Every chapter and sub-chapter that can be folded at all. */
  const foldable = useMemo(() => {
    const ids: string[] = []
    const walk = (row: MatrixRow) => {
      if (row.children.length > 0) { ids.push(row.nr); row.children.forEach(walk) }
    }
    MATRIX_GROUPS.forEach(walk)
    return ids
  }, [])
  const allOpen = open.size >= foldable.length

  /**
   * The visible rows, in the sheet's own order. A row is visible when every
   * ancestor above it is open — which is what makes one click on a chapter
   * reveal its sub-chapters without also dumping their contents.
   */
  const rows: Array<{ row: MatrixRow; depth: number }> = []
  const collect = (row: MatrixRow, depth: number) => {
    rows.push({ row, depth })
    if (row.children.length > 0 && open.has(row.nr)) {
      row.children.forEach((child) => collect(child, depth + 1))
    }
  }
  MATRIX_GROUPS.forEach((group) => collect(group, 0))

  const columnLabel: Record<MatrixColumn, string> = {
    notRequired: t('vr3.matrix.column.notRequired'),
    ag: t('vr3.matrix.column.ag'),
    an: t('vr3.matrix.column.an'),
  }

  return (
    <div className="a3-matrix">
      <div className="a3-matrix-head">
        <p className="a3-matrix-count">
          {t('vr3.matrix.positions', { count: matrixCounts(
            { nr: '', label: '', notRequired: 'no', ag: 'no', an: 'no', children: MATRIX_GROUPS },
            marks,
          ).rows })}
        </p>
        <Button
          variant="ghost"
          onClick={() => setOpen(allOpen ? new Set() : new Set(foldable))}
        >
          {t(allOpen ? 'vr3.matrix.collapseAll' : 'vr3.matrix.expandAll')}
        </Button>
      </div>

      <DataTable
        caption={t('vr3.matrix.caption')}
        captionHidden
        className="a3-matrix-table"
        columns={[
          { key: 'position', header: t('vr3.matrix.column.position') },
          { key: 'notRequired', header: columnLabel.notRequired },
          { key: 'ag', header: columnLabel.ag },
          { key: 'an', header: columnLabel.an },
        ]}
        rows={rows.map(({ row, depth }) => {
          const group = row.children.length > 0
          const counts = group ? matrixCounts(row, marks) : null
          return {
            key: row.nr,
            variant: depth === 0 ? 'group' as const : undefined,
            depth: Math.min(depth, 3) as 0 | 1 | 2 | 3,
            header: (
              <span className="a3-matrix-name">
                <span className="a3-matrix-nr">{row.nr}</span>
                <span className="a3-matrix-label">{row.label}</span>
                {counts && (
                  <span className="a3-matrix-sub">
                    {t('vr3.matrix.groupCount', {
                      rows: counts.rows, assigned: counts.assigned,
                    })}
                  </span>
                )}
              </span>
            ),
            disclosure: group
              ? { expanded: open.has(row.nr), onToggle: () => toggle(row.nr) }
              : undefined,
            /* A chapter carries no marks of its own: the sheet assigns
               positions, not headings, and a tick on a heading would be a
               decision nobody made about everything underneath it. */
            cells: group
              ? [{ content: null }, { content: null }, { content: null }]
              : MATRIX_COLUMNS.map((column) => {
                const mark = markOf(row, column, marks)
                return {
                  content: (
                    <Checkbox
                      label={`${row.nr} · ${row.label} · ${columnLabel[column]}`}
                      checked={mark !== 'no'}
                      onChange={(next) => s.setInterfaceMatrixMark(
                        row.nr, column, next ? 'yes' : 'no',
                      )}
                    />
                  ),
                }
              }),
          }
        })}
      />
    </div>
  )
}

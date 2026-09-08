import { useId, useRef, useState, type ReactNode, type Ref } from 'react'
import type {
  ClientCompositionRow,
  ClientConstructionLine,
  ClientProposal,
  ClientScopeItem,
} from '../state/clientProposal'
import { CompositionBar, type CompositionSegment } from '../design-system/CompositionBar'
import { CommercialNumber } from '../design-system/CommercialNumber'
import { DataTable, type DataTableRow } from '../design-system/DataTable'
import { EstimateUncertaintyBadge } from './EstimateUncertaintyBadge'
import { Dialog } from './Dialog'
import { Button } from './primitives'
import { localizeMoneyText, useT } from '../i18n'
import { ChapterFrame, ChapterLede, ClientPanel, MetricHero } from './ClientNarrative'

/**
 * VR3-CP-00 — THE COMMERCIAL CHAPTERS: 5 Preiszusammensetzung · 6
 * Leistungsumfang, and their Layer 3 (EVIDENCE) detail.
 *
 * ## Same contract as every chapter
 *
 * A `ClientProposal` and nothing else. The DIN 276 table below has no
 * reference to the engine, the catalogue or the store, so the row count is
 * whatever the projection produced — never a hard-coded ten — and every
 * row's authority phrase is the one the projection already resolved.
 *
 * ## Layer 3 is a layer, not a chapter
 *
 * The cost drivers, the Regionalfaktor row and the construction detail open
 * OVER the current chapter (canonical `Dialog`) and return focus to the
 * control that opened them. They never link to an internal pipeline view:
 * there is no route to `kostendetails` from here, and no way to build one,
 * because the layer renders the same proposal object as the stage.
 *
 * ## Three things that are never conflated
 *
 * The composition RECONCILES to the total (the `CompositionBar` is handed
 * that total and shows the unpriced remainder honestly). The cost drivers
 * reconcile to their own basis, asserted at the engine. A scenario delta
 * names its reference, and lives in the Varianten layer, not here.
 */

/* ───────────────────────── shared: the detail layer ──────────────────── */

/**
 * One evidence layer for both chapters. It is the canonical `Dialog` wearing
 * the client layer panel, so Esc, focus trap and focus restoration are the
 * released behaviour and not a second implementation.
 */
export function ClientDetailLayer({ open, onClose, title, lede, returnFocusTo, children }: {
  open: boolean
  onClose: () => void
  title: string
  lede?: string
  returnFocusTo: React.RefObject<HTMLElement>
  children: ReactNode
}) {
  const t = useT()
  const titleId = useId()
  if (!open) return null
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => { if (!next) onClose() }}
      labelledBy={titleId}
      returnFocusTo={returnFocusTo}
      panelClassName="a3-cp-layer"
      scrimClassName="a3-cp-layer-scrim"
    >
      <header className="a3-cp-layer-head">
        <div>
          <h2 id={titleId} className="a3-cp-layer-title">{title}</h2>
          {lede ? <p className="a3-cp-layer-note">{lede}</p> : null}
        </div>
        <div className="a3-cp-layer-actions">
          <Button variant="secondary" onClick={onClose}>
            {t('vr3.client.layer.close')}
          </Button>
        </div>
      </header>
      <div className="a3-cp-layer-scroll">
        {children}
      </div>
    </Dialog>
  )
}

/* ─────────────────── chapter 5 · Preiszusammensetzung ────────────────── */

function totalText(proposal: ClientProposal): string {
  const { commercial, language } = proposal
  return localizeMoneyText(
    `${commercial.totalPrefix}${commercial.totalPrefix ? ' ' : ''}${commercial.totalDisplay} €`,
    language,
  )
}

/**
 * The amount cell of one DIN 276 row.
 *
 * `direct`-zero is the ONLY place a client ever sees a zero, and it is typeset
 * as `± 0 €` so it cannot be mistaken for an unpriced row. Every other
 * non-priced state renders the released phrase for its authority, in the
 * muted "no amount" treatment — never blank, never `0 €`.
 */
function amountCell(row: ClientCompositionRow, proposal: ClientProposal, t: ReturnType<typeof useT>) {
  if (row.state === 'priced' && row.exact) {
    return {
      content: (
        <CommercialNumber exact={row.exact} language={proposal.language} emphasis="compact" />
      ),
      align: 'numeric' as const,
    }
  }
  if (row.state === 'zeroDirect') {
    return { content: t('vr3.client.price.zeroDirect'), align: 'numeric' as const }
  }
  return {
    content: row.stateText ?? t('vr3.client.investment.notPriced'),
    align: 'numeric' as const,
    absent: true,
  }
}

export function ChapterPreis({ proposal, headingRef }: {
  proposal: ClientProposal
  headingRef: Ref<HTMLHeadingElement>
}) {
  const t = useT()
  const { commercial, drivers, language } = proposal
  const [detailOpen, setDetailOpen] = useState(false)
  const detailTrigger = useRef<HTMLButtonElement>(null)

  // The composition graphic reconciles to the SAME total the table rules
  // off. Only priced rows become segments; the bar states the unpriced
  // remainder itself (rule 16), so a partial total is visible as a gap.
  const segments: CompositionSegment[] = commercial.composition
    .filter((row) => row.state === 'priced' && row.exact && row.exact.greaterThan(0))
    .map((row, index) => ({
      id: row.group,
      label: `${row.number} · ${row.title}`,
      value: row.exact!,
      categorySlot: index + 1,
    }))

  const responsibilityText = (row: ClientCompositionRow) =>
    row.responsibility === 'all3'
      ? t('vr3.client.price.responsibility.all3')
      : row.responsibility === 'bauherr'
        ? t('vr3.client.price.responsibility.bauherr')
        : '—'

  const rows: DataTableRow[] = [
    ...commercial.composition.map((row) => ({
      key: row.group,
      header: `${row.number} · ${row.title}`,
      cells: [
        { content: responsibilityText(row) },
        amountCell(row, proposal, t),
      ],
    })),
    {
      key: 'total',
      header: commercial.signature,
      variant: 'sum' as const,
      cells: [
        { content: '' },
        {
          content: (
            <CommercialNumber exact={commercial.totalExact} language={language} emphasis="default" />
          ),
          align: 'numeric' as const,
        },
      ],
    },
  ]

  const driverRows: DataTableRow[] = [
    ...drivers.rows.map((d) => ({
      key: d.key,
      header: d.label,
      cells: [{
        content: <CommercialNumber exact={d.exact} language={language} emphasis="compact" />,
        align: 'numeric' as const,
      }],
    })),
    {
      key: 'sum',
      header: t('vr3.client.price.driverSum'),
      variant: 'sum' as const,
      cells: [{
        content: <CommercialNumber exact={drivers.sumExact} language={language} emphasis="compact" />,
        align: 'numeric' as const,
      }],
    },
    // The Regionalfaktor row exists in EVERY client output, in either flag
    // state (rule 40). Inactive names the amount it WOULD add — a stated
    // counterfactual, not a manufactured value and not silence.
    {
      key: 'regional',
      header: `${t('vr3.client.price.regionalFactor')} · ${drivers.regionalFactor.text}`,
      cells: [{
        content: (
          <CommercialNumber
            exact={drivers.regionalFactor.effect} language={language}
            emphasis="compact" signed={!drivers.regionalFactor.active}
          />
        ),
        align: 'numeric' as const,
      }],
    },
  ]

  return (
    <ChapterFrame label={t('vr3.client.chapter.preis')}>
      <ChapterLede
        eyebrow={t('vr3.client.chapter.preis')}
        title={t('vr3.client.price.title')}
        headingRef={headingRef}
        // The rate NAMES the quantity it divides by. A lead rate whose
        // reference area is stated nowhere is a number a client cannot
        // check against the areas chapter 3 just showed them.
        lede={commercial.leadDenominatorText
          ? t('vr3.client.price.lede', {
            rate: localizeMoneyText(commercial.leadRateText, language),
            denominator: commercial.leadRate.denominatorLabel,
            area: localizeMoneyText(commercial.leadDenominatorText, language),
          })
          : t('vr3.client.price.lede.noArea', {
            rate: localizeMoneyText(commercial.leadRateText, language),
            denominator: commercial.leadRate.denominatorLabel,
          })}
      />

      <div className="a3-cp-split">
        {/* Restated, not re-staged: chapter 2 owns the 64 px moment. Here the
            lead rate leads at co-hero size and the total is a supporting
            statement, so the reader's eye goes to the table below. */}
        <ClientPanel className="a3-cp-panel-plain">
          <MetricHero
            variant="co"
            label={commercial.leadRateLabel}
            value={localizeMoneyText(commercial.leadRateText, language)}
          />
          <MetricHero
            variant="fact"
            label={commercial.signature}
            value={totalText(proposal)}
          />
          <p className="a3-cp-fineprint">
            {commercial.taxNote}
            {' · '}
            <EstimateUncertaintyBadge
              presentation="compact" pp={commercial.uncertaintyPp} language={language}
            />
          </p>
          {commercial.totalDisclosure ? (
            <p className="a3-cp-fineprint">{commercial.totalDisclosure}</p>
          ) : null}
        </ClientPanel>
        <ClientPanel className="a3-cp-panel-plain">
          <CompositionBar
            segments={segments}
            total={commercial.totalExact}
            variant="expanded"
            incompleteLabel={t('vr3.client.investment.notPriced')}
          />
        </ClientPanel>
      </div>

      <ClientPanel title={t('vr3.client.investment.composition')}>
        <DataTable
          caption={t('vr3.client.price.tableCaption')}
          captionHidden
          columns={[
            { key: 'position', header: t('vr3.client.price.colPosition') },
            { key: 'responsibility', header: t('vr3.client.price.colResponsibility') },
            { key: 'amount', header: t('vr3.client.price.colAmount'), align: 'numeric' },
          ]}
          rows={rows}
        />
        <div className="a3-cp-layer-open">
          <Button ref={detailTrigger} variant="secondary" onClick={() => setDetailOpen(true)}>
            {t('vr3.client.price.detail')}
          </Button>
        </div>
      </ClientPanel>

      <ClientDetailLayer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={t('vr3.client.price.detailTitle')}
        lede={t('vr3.client.price.detailLede')}
        returnFocusTo={detailTrigger}
      >
        <DataTable
          caption={t('vr3.client.price.detailTitle')}
          captionHidden
          columns={[
            { key: 'driver', header: t('vr3.client.price.colDriver') },
            { key: 'amount', header: t('vr3.client.price.colAmount'), align: 'numeric' },
          ]}
          rows={driverRows}
        />
      </ClientDetailLayer>
    </ChapterFrame>
  )
}

/* ────────────────────── chapter 6 · Leistungsumfang ──────────────────── */

function ScopeList({ items, emphasis }: {
  items: readonly ClientScopeItem[]
  emphasis?: 'excluded'
}) {
  return (
    <ul className={emphasis ? 'a3-cp-list a3-cp-list-excluded' : 'a3-cp-list'} role="list">
      {items.map((item) => (
        <li key={item.id} className="a3-cp-list-item">
          <span className="a3-cp-list-text">{item.text}</span>
          {item.buildingName ? (
            <span className="a3-cp-list-building">{item.buildingName}</span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/** One scope group: its name, how many answers it holds, and those answers. */
function ScopeGroupPanel({ title, items, emptyText, emphasis }: {
  title: string
  items: readonly ClientScopeItem[]
  emptyText: string
  emphasis?: 'excluded'
}) {
  return (
    <ClientPanel
      title={items.length > 0 ? `${title} · ${items.length}` : title}
    >
      {items.length > 0
        ? <ScopeList items={items} emphasis={emphasis} />
        : <p className="a3-cp-prose">{emptyText}</p>}
    </ClientPanel>
  )
}

function ConstructionLines({ lines }: { lines: readonly ClientConstructionLine[] }) {
  return (
    <div className="a3-cp-construction">
      {lines.map((line) => (
        <div key={line.id} className="a3-cp-construction-line">
          <span className="a3-cp-construction-label">
            {line.label}
            {line.buildingName ? (
              <span className="a3-cp-construction-building">{line.buildingName}</span>
            ) : null}
          </span>
          <span className="a3-cp-construction-value">{line.stateText ?? line.value}</span>
          {line.consequence ? (
            <span className="a3-cp-construction-note">{line.consequence}</span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/**
 * The inclusion/exclusion catalogue — what `Leistungen` now means.
 *
 * Three groups, the turnkey boundary emphasised, exclusions at full contrast
 * (a client must not have to hunt for what is NOT in the price). The
 * `undecided` KG rows render truthfully as open; dropping them would be an
 * invisible commercial gap. The responsibility media are conditions of the
 * offer, stated in the Product's own words — never a euro.
 */
export function ChapterLeistungen({ proposal, headingRef }: {
  proposal: ClientProposal
  headingRef: Ref<HTMLHeadingElement>
}) {
  const t = useT()
  const { scope, responsibility, construction } = proposal
  const [detailOpen, setDetailOpen] = useState(false)
  const detailTrigger = useRef<HTMLButtonElement>(null)

  const excludedCount = scope.rows.filter((r) => r.decision !== 'included').length

  const scopeRows: DataTableRow[] = scope.rows.map((row) => ({
    key: row.group,
    header: row.title,
    cells: [{ content: row.stateText }],
  }))

  const mediaRows: DataTableRow[] = (responsibility?.media ?? []).map((m) => ({
    key: m.id,
    header: m.label,
    cells: [
      { content: m.clientText },
      { content: m.all3From },
      {
        content: m.attention
          ? t('vr3.client.responsibility.attention')
          : t('vr3.client.responsibility.settled'),
      },
    ],
  }))

  return (
    <ChapterFrame label={t('vr3.client.chapter.leistungen')}>
      <ChapterLede
        eyebrow={t('vr3.client.chapter.leistungen')}
        title={t('vr3.client.scope.title')}
        headingRef={headingRef}
        lede={t(excludedCount === 0
          ? 'vr3.client.scope.meaning.complete'
          : 'vr3.client.scope.meaning.partial')}
      />

      {scope.boundary ? (
        <div className="a3-cp-callout">
          <p className="a3-cp-callout-title">{t('vr3.client.scope.boundaryTitle')}</p>
          <p className="a3-cp-callout-body">{scope.boundary}</p>
        </div>
      ) : null}

      {/*
        All THREE groups, always. A group that disappears when it happens to
        be empty leaves the client reading two columns and guessing whether
        the third was forgotten or answered; the empty state says which. The
        count beside each title is the count of the list under it, so the
        three add up to the decisions the Option actually carries.
      */}
      <div className="a3-cp-scope-groups">
        <ScopeGroupPanel
          title={t('vr3.client.scope.considered')}
          items={scope.groups.considered}
          emptyText={t('vr3.client.scope.noneConsidered')}
        />
        <ScopeGroupPanel
          title={t('vr3.client.scope.includedSystem')}
          items={scope.groups.included}
          emptyText={t('vr3.client.scope.noneIncluded')}
        />
        <ScopeGroupPanel
          title={t('vr3.client.scope.excluded')}
          items={scope.groups.excluded}
          emptyText={t('vr3.client.scope.noneExcluded')}
          emphasis="excluded"
        />
      </div>

      <ClientPanel title={t('vr3.client.scope.rowsTitle')}>
        <DataTable
          caption={t('vr3.client.scope.tableCaption')}
          captionHidden
          columns={[
            { key: 'group', header: t('vr3.client.scope.colGroup') },
            { key: 'decision', header: t('vr3.client.scope.colDecision') },
          ]}
          rows={scopeRows}
        />
        {construction.detail.length > 0 ? (
          <div className="a3-cp-layer-open">
            <Button ref={detailTrigger} variant="secondary" onClick={() => setDetailOpen(true)}>
              {t('vr3.client.scope.detail')}
            </Button>
          </div>
        ) : null}
      </ClientPanel>

      {responsibility ? (
        <ClientPanel title={t('vr3.client.responsibility.title')}>
          {responsibility.boundary ? (
            <p className="a3-cp-prose">{responsibility.boundary}</p>
          ) : null}
          {responsibility.handover ? (
            <p className="a3-cp-prose">
              {t('vr3.client.responsibility.handover')}{' '}{responsibility.handover}
            </p>
          ) : null}
          {mediaRows.length > 0 ? (
            <DataTable
              caption={t('vr3.client.responsibility.title')}
              captionHidden
              columns={[
                { key: 'medium', header: t('vr3.client.responsibility.colMedium') },
                { key: 'client', header: t('vr3.client.responsibility.colClient') },
                { key: 'all3', header: t('vr3.client.responsibility.colAll3') },
                { key: 'state', header: t('vr3.client.responsibility.colState') },
              ]}
              rows={mediaRows}
            />
          ) : null}
        </ClientPanel>
      ) : null}

      <ClientDetailLayer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={t('vr3.client.scope.detailTitle')}
        returnFocusTo={detailTrigger}
      >
        {construction.story.length > 0 ? (
          <>
            <h3 className="a3-cp-panel-subtitle">{t('vr3.client.project.construction')}</h3>
            <ConstructionLines lines={construction.story} />
          </>
        ) : null}
        <h3 className="a3-cp-panel-subtitle">{t('vr3.client.scope.detailMore')}</h3>
        <ConstructionLines lines={construction.detail} />
      </ClientDetailLayer>
    </ChapterFrame>
  )
}

import { useId, useMemo, useState } from 'react'
import { useStore } from '../state/store'
import {
  DEMO_PROJECTS,
  NORMAL_LIST_PROJECT_COUNT,
  readiness,
  type FixtureProject,
} from '../state/projectAnalysis'
import { Button } from '../components/primitives'
import { Card, FormField, SelectField } from '../components/designSystem'
import { EmptyState } from '../components/DataStates'
import { useT, useTx } from '../i18n'
import { MediaFrame } from '../design-system/MediaFrame'
import { SemanticStatus } from '../design-system/SemanticStatus'
import { projectAsset } from '../assets/project-media'
import { startContinuityTransition, useSemanticMotion } from '../design-system/motion'

/**
 * The normal Project List — the product's root (VR3-01, target `T-001`).
 *
 * VR3-01 replaced the eight uneven demonstration rows with EXACTLY TWO
 * complete, purposeful cases: one clean route to an indicative offer and
 * one deliberate real-world information challenge. That is a fixture
 * invariant, not a presentation choice, and `NORMAL_LIST_PROJECT_COUNT`
 * carries it from the fixture rather than from this file.
 *
 * Three properties are deliberate and each replaces a recorded defect:
 *
 * 1. **Every card is fully imaged.** Both projects have registered
 *    photographic identity (`heroAssetId` → `design-system/assets/projects`),
 *    so no card renders the fallback identity graphic any more. A missing
 *    registration still renders `MediaFrame`'s information-bearing state —
 *    the absence stays visible instead of being papered over.
 * 2. **The readiness rows are DERIVED from the project's own analysis
 *    state.** Before the analysis has run, the card says what is actually
 *    known — the documentation is complete and the analysis has not started
 *    — and only afterwards does it report blocking conflicts and
 *    recognition attention. The approved target frame shows the
 *    post-analysis rows because the prototype it was rendered from had no
 *    state at all; showing those numbers on a fresh reset would state a
 *    result the analysis has not produced, which is the exact defect this
 *    ticket exists to remove.
 * 3. **There is no price here and there cannot be.** A total belongs to an
 *    Option, and no Option exists yet.
 *
 * Search and sort survive behind ONE "filter and sort" disclosure, closed
 * by default, exactly as the approved target's single control shows. The
 * two former HubSpot lifecycle switches are gone with the data they filtered
 * on: the VR3 fixtures carry no CRM lifecycle stage, and a control that
 * filters a field which no longer exists is worse than no control.
 */

type SortMode = 'recommended' | 'name' | 'status'

const SORTERS: Record<SortMode, (a: FixtureProject, b: FixtureProject) => number> = {
  // Recommended = the clean route first, then the case that needs review:
  // the list's own purpose is to teach both journeys in that order.
  recommended: (a, b) => (a.route === b.route ? a.name.localeCompare(b.name) : a.route === 'clean' ? -1 : 1),
  name: (a, b) => a.name.localeCompare(b.name),
  status: (a, b) => (a.route === b.route ? a.name.localeCompare(b.name) : a.route === 'complex' ? -1 : 1),
}

const ALL = 'alle'

/**
 * "1 Projekte" is not German. The eyebrow has a singular form, chosen by
 * the count rather than assembled from a number and a plural noun.
 */
function eyebrowKey(count: number): string {
  return count === 1 ? 'vr3.list.eyebrowOne' : 'vr3.list.eyebrow'
}

export function OpportunityList() {
  const s = useStore()
  const t = useT()
  const tx = useTx()
  const { reduced } = useSemanticMotion()
  const filtersPanelId = useId()
  const [q, setQ] = useState('')
  const [city, setCity] = useState<string>(ALL)
  const [sort, setSort] = useState<SortMode>('recommended')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const openProject = (id: string) => {
    startContinuityTransition(reduced, () => s.openOpportunity(id))
  }

  const cities = useMemo(
    () => [ALL, ...new Set(DEMO_PROJECTS.map((p) => p.city))],
    [],
  )

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return DEMO_PROJECTS
      .filter((p) => (city === ALL || p.city === city))
      // The haystack matches what the placeholder promises: name, city,
      // owner and id. It searched the client instead of the owner, so a
      // search by owner silently found nothing.
      .filter((p) => (needle === ''
        || `${p.name} ${p.city} ${p.client} ${p.owner} ${p.id}`
          .toLowerCase().includes(needle)))
      .slice()
      .sort(SORTERS[sort])
  }, [q, city, sort])

  const filtersActive = (q.trim() !== '' ? 1 : 0) + (city !== ALL ? 1 : 0)

  return (
    <div className="a3-opportunities-canvas">
      <div className="a3-page px-7 py-6">
        <div className="a3-portfolio-head">
          <header className="a3-masthead a3-portfolio-headline">
            <div>
              <p className="a3-portfolio-eyebrow">
                {t(eyebrowKey(NORMAL_LIST_PROJECT_COUNT), { count: NORMAL_LIST_PROJECT_COUNT })}
              </p>
              <h1 className="a3-hero-title" tabIndex={-1} data-page-heading>
                {t('vr3.list.title')}
              </h1>
              <p className="a3-project-lede">{t('vr3.list.lead')}</p>
              {/* Announced once, after the set narrows — never per keystroke. */}
              <p className="a3-search-result-count mt-1" role="status" aria-live="polite">
                {shown.length === DEMO_PROJECTS.length
                  ? ''
                  : t(eyebrowKey(shown.length), { count: shown.length })}
              </p>
            </div>
          </header>
          <div role="search" className="a3-portfolio-toolbar">
            <div className="a3-search-line-toolbar">
              <Button
                variant="secondary"
                aria-expanded={filtersOpen}
                aria-controls={filtersPanelId}
                onClick={() => setFiltersOpen((v) => !v)}
              >
                {t('vr3.list.filterToggle')}
                {filtersActive > 0 ? ` (${filtersActive})` : ''}
              </Button>
            </div>
          </div>
        </div>

        <div role="search" className="a3-project-search">
          {filtersOpen && (
            <div id={filtersPanelId} className="mt-3">
              <div className="a3-search-line">
                <SelectField
                  id="project-sort"
                  label={t('opplist.sort.legend')}
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                >
                  <option value="recommended">{t('opplist.sort.recommended')}</option>
                  <option value="name">{t('opplist.sort.name')}</option>
                  <option value="status">{t('opplist.sort.status')}</option>
                </SelectField>
                <FormField htmlFor="project-search" label={tx('Opportunities durchsuchen')}>
                  <input
                    id="project-search"
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={tx('Name, Stadt, Owner, ID')}
                  />
                </FormField>
                <SelectField
                  id="project-city"
                  label={t('opplist.filter.city.label')}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                >
                  {cities.map((value) => (
                    <option key={value} value={value}>
                      {value === ALL ? tx('alle') : value}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>
          )}
        </div>

        {/* Two distinct empty states, kept distinct (approved landing
            contract, AC 4/6). The account-empty branch is structurally
            unreachable while the fixture invariant is "exactly two
            projects" — it is retained rather than deleted because the
            branch belongs to the capability, not to the fixture, and it
            offers NO reset: there is nothing to reset. */}
        {DEMO_PROJECTS.length === 0 ? (
          <div className="a3-empty-spec">
            <EmptyState>{t('opplist.emptyAccount.sentence')}</EmptyState>
            <p className="a3-project-lede">{t('opplist.emptyAccount.detail')}</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="a3-empty-spec">
            <EmptyState
              action={(
                <Button
                  variant="secondary"
                  onClick={() => { setQ(''); setCity(ALL) }}
                >
                  {t('opplist.empty.filtered.reset')}
                </Button>
              )}
            >
              {tx('Keine Opportunity entspricht der Suche.')}
            </EmptyState>
          </div>
        ) : (
          <ul className="a3-project-grid">
            {shown.map((project) => (
              <ProjectListCard
                key={project.id}
                project={project}
                onOpen={() => openProject(project.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ProjectListCard({
  project, onOpen,
}: {
  project: FixtureProject
  onOpen: () => void
}) {
  const s = useStore()
  const t = useT()
  const tx = useTx()
  const asset = projectAsset(project.heroAssetId)
  const analysis = s.projectAnalyses[project.id]
  const state = analysis ? readiness(project, analysis) : null
  const clean = project.route === 'clean'

  const buildings = project.buildings.length === 1
    ? t('vr3.list.card.buildingsOne')
    : t('vr3.list.card.buildingsMany', { count: project.buildings.length })
  const documents = t('vr3.list.card.documentsMany', { count: project.documents.length })

  // Two readiness rows, derived from the project's OWN state. Before the
  // analysis has produced evidence the card reports what is actually known;
  // it never reports a conflict count the analysis has not computed.
  const notStarted = !state || state.state === 'DOCUMENT_ANALYSIS_NOT_STARTED'
  const attentionCount = project.terminalDistribution.warning
    + project.terminalDistribution.lowConfidence
  const rows = notStarted
    ? [
      {
        id: 'documentation',
        label: t('vr3.list.card.documentation'),
        value: t('vr3.list.card.documentationComplete'),
      },
      {
        id: 'analysis',
        label: t('vr3.list.card.analysis'),
        value: t('ds.processingJob.state.notStarted'),
      },
    ]
    : [
      {
        id: 'blocking',
        label: t('vr3.list.card.blockingConflicts'),
        value: String(state.unresolvedBlockingConflicts),
      },
      {
        id: 'warnings',
        label: t('vr3.list.card.recognitionWarnings'),
        value: String(attentionCount),
      },
    ]

  return (
    <li className="a3-project-card">
      <div className="a3-project-card-media" style={{ viewTransitionName: `project-media-${project.id}` }}>
        <MediaFrame
          ratio="card"
          state={asset ? 'loaded' : 'fallback'}
          src={asset?.url}
          alt={asset ? tx(asset.motifDe) : undefined}
          seed={project.id}
          sourceId={asset?.assetId}
        />
      </div>
      {/* The status mark sits ABOVE the project name, in the eyebrow
          position the approved target uses. The canonical `Card`'s own
          `status` slot renders after the body, so the two are stacked in
          one column here instead of forking the primitive. */}
      <div className="a3-project-card-column">
      <div className="a3-project-card-status">
        <SemanticStatus
          tone={clean ? 'ok' : 'attention'}
          label={t(project.listStatusKey)}
        />
      </div>
      <Card
        className="a3-project-card-body"
        title={project.name}
        meta={<>{project.client} · {project.city}</>}
        actions={(
          <Button
            variant="primary"
            onClick={onOpen}
            // A real key, not a concatenation: `${name} öffnen` left the
            // accessible name German in the EN locale while the visible
            // label read "Open project" (rule 36).
            aria-label={t('vr3.list.card.openAria', { name: project.name })}
          >
            {clean ? t('vr3.list.card.openProject') : t('vr3.list.card.reviewProject')}
          </Button>
        )}
        onOpen={onOpen}
      >
        <p className="a3-project-card-facts">
          <span className="block">{t(project.projectTypeKey)}</span>
          <span className="block">{buildings} · {documents}</span>
        </p>
        <dl className="a3-project-card-rows">
          {rows.map((row) => (
            <div key={row.id} className="a3-project-card-row">
              <dt>{row.label}</dt>
              <dd className="numeric">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      </div>
    </li>
  )
}

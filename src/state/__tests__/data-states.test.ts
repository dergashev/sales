import { describe, expect, it } from 'vitest'
import { DATA_STATE_DECLARATIONS } from '../data-states'
import type { DataStateKind } from '../../components/DataStates'

/**
 * Правило 30: пять состояний данных плюс оси stale и permission — либо
 * названная причина неприменимости. Тест держит ПОЛНОТУ деклараций:
 * недостающая ось — упавший тест, а не молчание.
 */
const ALL: DataStateKind[] = [
  'loading', 'empty', 'partial', 'ready', 'error', 'stale', 'permission',
]

describe('Декларации состояний данных (правило 30)', () => {
  it('каждый потребитель объявляет все семь осей', () => {
    for (const [name, decl] of Object.entries(DATA_STATE_DECLARATIONS)) {
      for (const key of ALL) {
        expect(decl[key], `${name}.${key}`).toBeDefined()
      }
    }
  })

  it('ready везде реализован — компонент без ready не существует', () => {
    for (const [name, decl] of Object.entries(DATA_STATE_DECLARATIONS)) {
      expect(decl.ready.status, `${name}.ready`).toBe('implemented')
    }
  })

  it('непроизводимость всегда несёт содержательную причину', () => {
    for (const decl of Object.values(DATA_STATE_DECLARATIONS)) {
      for (const key of ALL) {
        const d = decl[key]
        if (d.status === 'notApplicable') {
          expect(d.reason.length).toBeGreaterThan(20)
        }
      }
    }
  })
})

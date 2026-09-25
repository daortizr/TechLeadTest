import { describe, it, expect } from 'vitest'
import { buildSeatRows } from '../../../src/features/seat/layout'

function grid(rows: number, columns: string[]): string[] {
  return Array.from({ length: rows }, (_, i) => columns.map((column) => `${i + 1}${column}`)).flat()
}

describe('buildSeatRows', () => {
  it('builds 8 rows of ABC | DEF from a 48-seat flight', () => {
    const rows = buildSeatRows(grid(8, ['A', 'B', 'C', 'D', 'E', 'F']))

    expect(rows).toHaveLength(8)
    expect(rows[0]).toEqual({ row: 1, left: ['1A', '1B', '1C'], right: ['1D', '1E', '1F'] })
    expect(rows[7]).toEqual({ row: 8, left: ['8A', '8B', '8C'], right: ['8D', '8E', '8F'] })
  })

  it('does not depend on the order the seats arrive in', () => {
    const shuffled = grid(2, ['A', 'B', 'C', 'D']).reverse()
    expect(buildSeatRows(shuffled)).toEqual([
      { row: 1, left: ['1A', '1B'], right: ['1C', '1D'] },
      { row: 2, left: ['2A', '2B'], right: ['2C', '2D'] }
    ])
  })

  it('orders rows numerically, not alphabetically', () => {
    const rows = buildSeatRows(['10A', '2A', '9A', '1A'])
    expect(rows.map((row) => row.row)).toEqual([1, 2, 9, 10])
  })

  it('puts the extra column on the left when the count is odd', () => {
    const [row] = buildSeatRows(grid(1, ['A', 'B', 'C', 'D', 'E']))
    expect(row.left).toEqual(['1A', '1B', '1C'])
    expect(row.right).toEqual(['1D', '1E'])
  })

  it('ignores malformed seat numbers', () => {
    expect(buildSeatRows(['1A', 'X', '', '12', 'C3'])).toEqual([{ row: 1, left: ['1A'], right: [] }])
  })

  it('returns nothing for no seats', () => {
    expect(buildSeatRows([])).toEqual([])
  })
})

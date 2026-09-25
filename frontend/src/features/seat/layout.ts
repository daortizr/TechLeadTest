export interface SeatRow {
  row: number
  // Seat numbers left and right of the aisle, e.g. ['1A', '1B', '1C'] and ['1D', '1E', '1F']
  left: string[]
  right: string[]
}

const SEAT_PATTERN = /^(\d+)([A-Z])$/

// Groups seat numbers ("12C") into rows, with the columns split in two blocks around the aisle.
// Built from the snapshot, so it follows whatever the flight has.
export function buildSeatRows(seatNumbers: string[]): SeatRow[] {
  const parsed = seatNumbers
    .map((seat) => {
      const match = SEAT_PATTERN.exec(seat)
      return match ? { seat, row: Number(match[1]), column: match[2] } : null
    })
    .filter((entry): entry is { seat: string; row: number; column: string } => entry !== null)

  const columns = [...new Set(parsed.map((entry) => entry.column))].sort()
  const leftColumns = new Set(columns.slice(0, Math.ceil(columns.length / 2)))

  const rows = new Map<number, SeatRow>()
  for (const entry of parsed.sort((a, b) => a.row - b.row || a.column.localeCompare(b.column))) {
    const row = rows.get(entry.row) ?? { row: entry.row, left: [], right: [] }
    ;(leftColumns.has(entry.column) ? row.left : row.right).push(entry.seat)
    rows.set(entry.row, row)
  }

  return [...rows.values()].sort((a, b) => a.row - b.row)
}

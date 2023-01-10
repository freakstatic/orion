import _ from 'lodash'

export const selectQueryClauses = [
  'SELECT',
  'FROM',
  'WHERE',
  'GROUP BY',
  'HAVING',
  'ORDER BY',
  'LIMIT',
  'OFFSET',
] as const

export type SelectQueryClause = typeof selectQueryClauses[number]

export function getStartIndexOfOutermost(
  selectQuery: string,
  clause: SelectQueryClause
): number | undefined {
  let index = -1
  while (selectQuery.indexOf(clause, index + 1) !== -1) {
    index = selectQuery.indexOf(clause, index + 1)
    const substrCounts = _.countBy(selectQuery.substring(0, index), (v) => v)
    if (substrCounts['('] === substrCounts[')']) {
      return index
    }
  }

  return undefined
}

export function getClauseRange(
  selectQuery: string,
  clause: SelectQueryClause
): [number, number | undefined] | undefined {
  const startIndex = getStartIndexOfOutermost(selectQuery, clause)
  if (startIndex === undefined) {
    return undefined
  }
  let endIndex: number | undefined
  for (
    let nextClauseIndex = selectQueryClauses.indexOf(clause) + 1;
    endIndex === undefined && nextClauseIndex < selectQueryClauses.length;
    ++nextClauseIndex
  ) {
    endIndex = getStartIndexOfOutermost(selectQuery, selectQueryClauses[nextClauseIndex])
  }
  return [startIndex + clause.length, endIndex]
}

export function extendClause(
  selectQuery: string,
  clause: SelectQueryClause,
  extension: string,
  glue = ','
): string {
  let clauseRange = getClauseRange(selectQuery, clause)
  for (
    let clauseIndex = selectQueryClauses.indexOf(clause) - 1;
    clauseRange === undefined && clauseIndex >= 0;
    --clauseIndex
  ) {
    const previousClause = selectQueryClauses[clauseIndex]
    const previousClauseRange = getClauseRange(selectQuery, previousClause)
    clauseRange = previousClauseRange
      ? [previousClauseRange[1] || selectQuery.length, previousClauseRange[1] || selectQuery.length]
      : undefined
  }
  if (!clauseRange) {
    throw new Error(`Cannot extend ${clause} clause of query: ${selectQuery}`)
  }
  if (clauseRange[0] === clauseRange[1]) {
    // Clause is missing
    return (
      selectQuery.substring(0, clauseRange[0]) +
      ` ${clause} ${extension} ` +
      selectQuery.substring(clauseRange[1])
    )
  }
  const addParenthesis = clause === 'WHERE'
  return (
    selectQuery.substring(0, clauseRange[0]) +
    (addParenthesis ? ' (' : ' ') +
    selectQuery.substring(clauseRange[0], clauseRange[1]) +
    (addParenthesis ? ') ' : ' ') +
    `${glue} ${extension} ` +
    (clauseRange[1] ? selectQuery.substring(clauseRange[1]) : '')
  )
}

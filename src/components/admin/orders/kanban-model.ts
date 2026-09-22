/**
 * The pure parts of the orders board: which columns it draws, how the rows
 * fall into them, and the cap on how many cards one board holds.
 *
 * No React and no database here, so the page, the client board and the test
 * all read the same rules. The board itself is a view of the same rows the
 * table shows, with the same filters; only the shape changes.
 */

/** The most cards one board draws. Past this the filters do the narrowing. */
export const KANBAN_LIMIT = 300;

/** A stage as the services editor stores it (src/lib/db/types.ts ServiceStageRow). */
export type StageSource = {
  key: string;
  label: string;
  position: number;
  is_terminal: boolean;
};

/** A service with its stages, in the shape listServicesForAdmin returns. */
export type ServiceStages = {
  position: number;
  stages: StageSource[];
};

export type KanbanColumn = {
  key: string;
  label: string;
  /**
   * Landing here completes an order, so a drop asks first. A key counts as
   * terminal when any service calls it terminal: the question is cheap and
   * asking once too often is better than completing an order in silence.
   */
  isTerminal: boolean;
  /**
   * False for a stage key no service lists any more (a service edited after
   * the order was placed). The label is then the raw key, for the caller to
   * humanize.
   */
  known: boolean;
};

export type KanbanGroup<Row> = {
  column: KanbanColumn;
  rows: Row[];
};

/**
 * The columns, in the canonical order of the stage keys across services:
 * services by position, stages by position inside each, first label wins.
 * Services share keys and labels, so the union reads as one lifecycle.
 */
export function kanbanColumns(services: ServiceStages[]): KanbanColumn[] {
  const columns: KanbanColumn[] = [];
  const index = new Map<string, number>();

  const ordered = [...services].sort((a, b) => a.position - b.position);
  for (const service of ordered) {
    const stages = [...(service.stages ?? [])].sort((a, b) => a.position - b.position);
    for (const stage of stages) {
      const at = index.get(stage.key);
      if (at === undefined) {
        index.set(stage.key, columns.length);
        columns.push({ key: stage.key, label: stage.label, isTerminal: stage.is_terminal, known: true });
        continue;
      }
      // The label of the first service wins; a later service that ends on
      // this key still makes the column terminal.
      if (stage.is_terminal) columns[at].isTerminal = true;
    }
  }

  return columns;
}

/**
 * The rows split into their columns, input order kept inside each (the query
 * hands them over newest first). Empty columns stay, so the board always
 * shows the whole lifecycle. A row on a key no column holds gets its own
 * column at the end, labelled with the raw key and marked `known: false`.
 */
export function groupByStage<Row extends { stage_key: string }>(
  columns: KanbanColumn[],
  rows: Row[],
): KanbanGroup<Row>[] {
  const groups: KanbanGroup<Row>[] = columns.map((column) => ({ column, rows: [] }));
  const index = new Map<string, number>();
  groups.forEach((group, at) => {
    if (!index.has(group.column.key)) index.set(group.column.key, at);
  });

  for (const row of rows) {
    let at = index.get(row.stage_key);
    if (at === undefined) {
      at = groups.length;
      index.set(row.stage_key, at);
      groups.push({
        column: { key: row.stage_key, label: row.stage_key, isTerminal: false, known: false },
        rows: [],
      });
    }
    groups[at].rows.push(row);
  }

  return groups;
}

/**
 * The first `limit` rows and how many matching orders the board leaves out.
 * `total` is the count before the limit, so the caller can say what is
 * missing even though the query never read it.
 */
export function capOrders<Row>(
  rows: Row[],
  total: number,
  limit: number = KANBAN_LIMIT,
): { rows: Row[]; hidden: number } {
  const size = Math.max(0, Math.floor(limit));
  const shown = rows.length > size ? rows.slice(0, size) : rows;
  const counted = Math.max(total, shown.length);
  return { rows: shown, hidden: Math.max(0, counted - shown.length) };
}

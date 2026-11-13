/**
 * Data Overview by layer: the backend's `GET /data/layers`
 * (specs/backend/api_specs_data_overview.md). Every table IT-Aware declares,
 * once, in the layer it belongs to in the target data model, with a row count.
 */

export type LayerCode = 'raw' | 'derived' | 'transactional';

/** What a table is declared as today; it differs from its layer where the table does not match the target yet. */
export type Declared = 'landing' | 'raw' | 'source_copy' | 'computed' | 'mixed' | 'transactional';

export interface LayerTable {
  /** `<schema>.<table>`. */
  table: string;
  declared: Declared;
  /** Null when the table is missing from the database. */
  rows: number | null;
  /** The count is an estimate. */
  approximate: boolean;
  /** The code of the task that shows the table's records; null for none. */
  task: string | null;
}

export interface LayerGroup {
  schema: string;
  tables: LayerTable[];
}

export interface DataLayer {
  layer: LayerCode;
  /** How many tables it has, shown to the caller or not. */
  tables: number;
  /** The sum of the counts that are known. */
  rows: number;
  /** One of its counts is an estimate, so the total is. */
  approximate: boolean;
  /** Its rows by what its tables are declared as today: only the keys the layer has; they add up to `rows`. */
  declared_rows: Partial<Record<Declared, number>>;
  /** How many of its tables the caller is not shown (the sensitive schemas, for anyone but an administrator). */
  hidden_tables: number;
  /** The groups the caller is shown. */
  groups: LayerGroup[];
}

export interface DataLayers {
  /** When the rows were counted (ISO datetime). */
  counted_at: string;
  /** Always the three layers, in flow order. */
  layers: DataLayer[];
}

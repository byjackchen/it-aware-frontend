/**
 * Data Overview by layer: the backend's `GET /data/layers`
 * (specs/backend/api_specs_data_layers.md). Every table IT-Aware declares,
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
  tables: number;
  rows: number;
  groups: LayerGroup[];
}

export interface DataLayers {
  /** When the rows were counted (ISO datetime). */
  counted_at: string;
  /** Always the three layers, in flow order. */
  layers: DataLayer[];
}

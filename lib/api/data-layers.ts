/**
 * Server-side client for Data Overview by layer (backend `GET /data/layers`,
 * specs/backend/api_specs_data_layers.md). The read needs the Data Overview
 * view's permission.
 */

import { fetchApi } from '@/lib/api/core';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type { DataLayers } from '@/lib/types/data-layers';

export async function getDataLayers(): Promise<DataLayers> {
  return fetchApi(`${RUNTIME_CONFIG.backend.domain}/data/layers`);
}

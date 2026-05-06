/**
 * Type definitions for the iOA scan domain (Networks module).
 * Mirrors app/objects/networks/ioa_scan/schemas.py in it-aware-backend.
 */

export type TrendBucket = {
  ts: string; // ISO-8601 UTC
  count: number;
};

export type DeviceMachine = {
  machine_name: string;

  // identity (heartbeat)
  mac: string | null;
  nic: string | null;
  local_ip: string | null;
  os_version: string | null;
  client_version: string | null;
  policy_version: string | null;

  // network env (heartbeat)
  proxy_mode: string | null;
  scene: string | null;
  networktype: string | null;
  gso: boolean | null;
  total_conns_at_last_hb: number | null;
  last_heartbeat_at: string | null; // ISO-8601 UTC

  // agent runtime health (client.metrics)
  cgocalls: number | null;
  goroutine: number | null;
  threads: number | null;
  memory_kb: number | null;
  handles: number | null;
  last_metrics_at: string | null; // ISO-8601 UTC

  // cross-cut
  connections_in_window: number | null;
};

export type IoaScanRead = {
  oid: string;
  worker_oid: string;
  scanned_at: string;
  window_start: string;
  window_end: string;
  trigger_source: 'periodic' | 'adhoc';

  // Network KPI (last 1 hour)
  kpi_total_records: number | null;
  kpi_total_connections: number | null;
  kpi_blocked_count: number | null;
  kpi_failed_connections: number | null;
  kpi_failure_rate: number | null;
  kpi_sample_size: number | null;
  kpi_sample_upload_bytes: number | null;
  kpi_sample_download_bytes: number | null;
  kpi_throughput_upload_kbps: number | null;
  kpi_throughput_download_kbps: number | null;
  kpi_avg_connect_ms: number | null;
  kpi_p50_connect_ms: number | null;
  kpi_p95_connect_ms: number | null;
  kpi_avg_establish_ms: number | null;
  kpi_p95_establish_ms: number | null;
  kpi_data_group_breakdown: Record<string, number> | null;

  // Network KPI Trend (last 3 days)
  trend_window_hours: number;
  trend_hourly_counts: TrendBucket[] | null;
  trend_peak_hour_count: number | null;
  trend_peak_hour_ts: string | null;
  trend_busy_hours_avg: number | null;
  trend_quiet_hours_avg: number | null;
  trend_offline_minutes: number | null;

  // Device data (last 72h)
  device_count: number | null;
  device_distinct_macs_count: number | null;
  device_primary_machine_name: string | null;
  device_primary_mac: string | null;
  device_primary_local_ip: string | null;
  device_primary_os_version: string | null;
  device_primary_client_version: string | null;
  device_primary_policy_version: string | null;
  device_primary_proxy_mode: string | null;
  device_primary_scene: string | null;
  device_primary_total_conns: number | null;
  device_primary_last_heartbeat_at: string | null;
  device_machines: DeviceMachine[] | null;

  created_at: string;
  updated_at: string;
};

export type IoaScanList = {
  items: IoaScanRead[];
  total: number;
};

/** Master-list row: every active worker, joined with their latest scan (or null). */
export type WorkerWithLatestScan = {
  worker_oid: string;
  worker_fullname: string;
  worker_stable_id: string | null;
  worker_email: string | null;
  latest_scan: IoaScanRead | null;
};

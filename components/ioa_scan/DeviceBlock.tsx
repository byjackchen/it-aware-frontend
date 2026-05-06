/**
 * Per-device list with MAC + agent runtime health, for troubleshooting.
 */
import type {
    DeviceMachine,
    IoaScanRead,
} from '@/lib/types/networks/ioa_scans';

export function DeviceBlock({ scan }: { scan: IoaScanRead }) {
    const machines = scan.device_machines ?? [];

    return (
        <section>
            <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-lg font-semibold">Devices · last 72 hours</h2>
                <div className="text-xs text-slate-500">
                    {scan.device_count ?? 0} machines · {scan.device_distinct_macs_count ?? 0} distinct MACs
                </div>
            </div>

            {machines.length === 0 ? (
                <div className="text-sm text-slate-500 border rounded p-3">
                    No heartbeats found in the window.
                </div>
            ) : (
                <div className="space-y-3">
                    {machines.map((m, i) => (
                        <DeviceCard
                            key={`${m.machine_name}-${m.mac ?? i}`}
                            machine={m}
                            primary={i === 0}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}

function DeviceCard({ machine, primary }: { machine: DeviceMachine; primary: boolean }) {
    return (
        <article
            className={`border rounded p-3 ${primary ? 'border-blue-300 bg-blue-50/40' : ''}`}
        >
            <header className="flex items-baseline justify-between mb-2">
                <div className="font-mono text-sm">
                    {machine.machine_name}
                    {primary && (
                        <span className="ml-2 text-xs uppercase text-blue-700">primary</span>
                    )}
                </div>
                <div className="text-xs text-slate-500">
                    {machine.connections_in_window != null
                        ? `${machine.connections_in_window.toLocaleString()} conns in window`
                        : '—'}
                </div>
            </header>

            <h4 className="text-xs uppercase text-slate-500 mt-1 mb-1">
                Identity &amp; network
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <Field label="MAC" value={machine.mac} />
                <Field label="NIC" value={machine.nic} />
                <Field label="Local IP" value={machine.local_ip} />
                <Field label="OS" value={machine.os_version} />
                <Field label="Agent" value={machine.client_version} />
                <Field label="Policy" value={machine.policy_version} />
                <Field label="Proxy mode" value={machine.proxy_mode} />
                <Field label="Scene" value={machine.scene} />
                <Field label="Network type" value={machine.networktype} />
                <Field
                    label="GSO"
                    value={machine.gso == null ? null : String(machine.gso)}
                />
                <Field
                    label="Active conns @ last HB"
                    value={machine.total_conns_at_last_hb?.toString() ?? null}
                />
                <Field
                    label="Last heartbeat"
                    value={
                        machine.last_heartbeat_at
                            ? new Date(machine.last_heartbeat_at).toLocaleString()
                            : null
                    }
                />
            </div>

            <h4 className="text-xs uppercase text-slate-500 mt-3 mb-1">
                Agent runtime health
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <Field label="Goroutines" value={machine.goroutine?.toLocaleString() ?? null} />
                <Field label="Threads" value={machine.threads?.toLocaleString() ?? null} />
                <Field
                    label="Memory"
                    value={
                        machine.memory_kb != null
                            ? `${(machine.memory_kb / 1024).toFixed(1)} MB`
                            : null
                    }
                />
                <Field label="Handles" value={machine.handles?.toLocaleString() ?? null} />
                <Field label="cgo calls" value={machine.cgocalls?.toLocaleString() ?? null} />
                <Field
                    label="Last metrics"
                    value={
                        machine.last_metrics_at
                            ? new Date(machine.last_metrics_at).toLocaleString()
                            : null
                    }
                />
            </div>
        </article>
    );
}

function Field({
    label,
    value,
}: {
    label: string;
    value: string | null | undefined;
}) {
    return (
        <div>
            <div className="text-xs text-slate-500">{label}</div>
            <div className="font-mono break-all">{value || '—'}</div>
        </div>
    );
}

'use client';

import { useRouter } from 'next/navigation';
import type { LocationBreakdown } from '@/lib/types/survey-analytics';

interface LocationCrossRefTableProps {
    data: LocationBreakdown[];
    isLight: boolean;
    batchOid: string;
}

export function LocationCrossRefTable({ data, isLight, batchOid }: LocationCrossRefTableProps) {
    const router = useRouter();

    if (data.length === 0) {
        return <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>No location data available</p>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className={`border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                        <th className={`text-left py-2 px-3 font-medium ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>Location</th>
                        <th className={`text-right py-2 px-3 font-medium ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>Total</th>
                        <th className={`text-right py-2 px-3 font-medium text-green-500`}>+</th>
                        <th className={`text-right py-2 px-3 font-medium text-red-500`}>-</th>
                        <th className={`text-left py-2 px-3 font-medium ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>Top Issues</th>
                    </tr>
                </thead>
                <tbody>
                    {data.slice(0, 15).map((loc) => (
                        <tr
                            key={loc.location_oid}
                            className={`border-b cursor-pointer transition-colors ${isLight
                                ? 'border-slate-100 hover:bg-slate-50'
                                : 'border-white/5 hover:bg-white/5'
                            }`}
                            onClick={() => router.push(`/data/analyses?source_batch_oid=${batchOid}`)}
                        >
                            <td className={`py-2 px-3 font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {loc.location_name}
                            </td>
                            <td className={`py-2 px-3 text-right ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                {loc.count}
                            </td>
                            <td className="py-2 px-3 text-right text-green-500">{loc.semantic.positive}</td>
                            <td className="py-2 px-3 text-right text-red-500">{loc.semantic.negative}</td>
                            <td className="py-2 px-3">
                                <div className="flex flex-wrap gap-1">
                                    {loc.top_issues.slice(0, 3).map((issue, i) => (
                                        <span
                                            key={i}
                                            className={`text-xs px-2 py-0.5 rounded-full ${issue.type === 'configuration_item'
                                                ? 'bg-purple-500/20 text-purple-500'
                                                : 'bg-blue-500/20 text-blue-500'
                                            }`}
                                        >
                                            {issue.name} ({issue.count})
                                        </span>
                                    ))}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

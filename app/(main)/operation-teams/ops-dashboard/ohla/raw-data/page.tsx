import { OhlaPlaceholder } from '@/components/ohla/OhlaPlaceholder'

export default function OhlaRawDataPage() {
    return (
        <OhlaPlaceholder
            labelKey="opsOhlaRawData"
            pbixPage="Raw Data"
            summary="Unfiltered export-style table of every chatbot interaction with a date slicer. Sourced from activities.interactions where source_system = 'chatbot'."
        />
    )
}

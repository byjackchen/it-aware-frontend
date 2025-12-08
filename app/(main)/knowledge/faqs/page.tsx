import { HelpCircle } from 'lucide-react';

export default function FAQsPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-8">
            <div className="glass-card rounded-2xl p-12 text-center">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                    <HelpCircle className="w-10 h-10 text-blue-400" />
                </div>
                <h1 className="text-2xl font-semibold text-white mb-2">FAQs</h1>
                <p className="text-gray-400">This page is under construction.</p>
            </div>
        </div>
    );
}

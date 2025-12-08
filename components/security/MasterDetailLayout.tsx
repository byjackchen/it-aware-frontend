/**
 * Master-Detail layout component for security pages.
 * Server Component - renders split-pane layout with list on left, detail on right.
 */

interface MasterDetailLayoutProps {
  master: React.ReactNode;
  detail: React.ReactNode;
}

export function MasterDetailLayout({ master, detail }: MasterDetailLayoutProps) {
  return (
    <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
      {/* Master pane - Entity list */}
      <div className="w-80 flex-shrink-0 glass-card rounded-xl overflow-hidden flex flex-col">
        {master}
      </div>
      
      {/* Detail pane - Entity details and assignments */}
      <div className="flex-1 glass-card rounded-xl overflow-hidden flex flex-col">
        {detail}
      </div>
    </div>
  );
}

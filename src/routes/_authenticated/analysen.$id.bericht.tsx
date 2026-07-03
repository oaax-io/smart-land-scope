import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnalysisReport } from "@/components/analysis-report";

export const Route = createFileRoute("/_authenticated/analysen/$id/bericht")({
  head: ({ params }) => ({ meta: [{ title: `Bericht ${params.id.slice(0, 8)} — SmarTerra` }] }),
  component: ReportPage,
});

function ReportPage() {
  const { id } = Route.useParams();
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/analysen/$id" params={{ id }}>
            <ArrowLeft className="mr-1 h-4 w-4" />Zur Analyse
          </Link>
        </Button>
      </div>
      <AnalysisReport analysisId={id} showToolbar domId="report-body" />
    </div>
  );
}

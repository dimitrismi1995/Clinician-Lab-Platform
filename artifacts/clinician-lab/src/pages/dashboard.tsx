import { useGetDashboard, useListCases } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Clock, FileCheck, Loader2, ArrowRight, Activity } from "lucide-react";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

function DashboardSkeleton() {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: dashboard, isLoading: isLoadingDashboard } = useGetDashboard();
  const { data: cases, isLoading: isLoadingCases } = useListCases();

  if (isLoadingDashboard || isLoadingCases) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Clinical Overview</h1>
          <p className="text-muted-foreground mt-1">Review active cases and upcoming procedural milestones.</p>
        </div>
        <Link href="/case/new">
          <span className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 tracking-wide cursor-pointer">
            Intake New Case
          </span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-border bg-card hover-elevate transition-all">
          <CardHeader className="pb-2">
            <CardDescription className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Activity className="w-3.5 h-3.5" />
              Active Cases
            </CardDescription>
            <CardTitle className="text-4xl font-light text-primary">{dashboard?.activeCases || 0}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card className="border-border bg-card hover-elevate transition-all">
          <CardHeader className="pb-2">
            <CardDescription className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              Fitting Due
            </CardDescription>
            <CardTitle className="text-4xl font-light text-secondary-foreground">{dashboard?.fittingDue || 0}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-border bg-card hover-elevate transition-all">
          <CardHeader className="pb-2">
            <CardDescription className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <FileCheck className="w-3.5 h-3.5" />
              Review Due
            </CardDescription>
            <CardTitle className="text-4xl font-light text-foreground">{dashboard?.reviewDue || 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Active Portfolio</h2>
          </div>
          <Card className="border-border overflow-hidden">
            <div className="divide-y divide-border">
              {cases?.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground font-mono text-sm">No active cases</div>
              ) : (
                cases?.map(c => (
                  <Link key={c.id} href={`/case/${c.id}`}>
                    <div className="p-4 hover:bg-muted/30 transition-colors flex items-center justify-between group cursor-pointer">
                      <div>
                        <div className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">{c.label}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-1">
                          {c.anatomicalSite} • {c.patientAge}yo {c.sex}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="font-mono text-[10px] uppercase bg-secondary/50">
                          {c.status}
                        </Badge>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all transform -translate-x-2 group-hover:translate-x-0" />
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Recent Activity</h2>
          </div>
          <Card className="border-border p-6 bg-card/50">
            <div className="space-y-6">
              {dashboard?.recentActivity?.length === 0 ? (
                <div className="text-center text-muted-foreground font-mono text-sm py-4">No recent activity</div>
              ) : (
                dashboard?.recentActivity?.map((activity, i) => (
                  <div key={activity.id} className="flex gap-4 relative">
                    {i !== dashboard.recentActivity.length - 1 && (
                      <div className="absolute left-1.5 top-5 bottom-[-1.5rem] w-px bg-border/60" />
                    )}
                    <div className="mt-1 w-3 h-3 rounded-full border-2 border-primary bg-background shrink-0 z-10" />
                    <div className="space-y-1 pb-2">
                      <p className="text-sm font-medium text-foreground">{activity.title}</p>
                      <p className="text-sm text-muted-foreground">{activity.detail}</p>
                      <p className="text-xs font-mono text-muted-foreground/70">
                        {format(new Date(activity.timestamp), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

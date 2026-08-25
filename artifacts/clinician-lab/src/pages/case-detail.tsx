import { useLocation, useParams } from "wouter";
import { useGetCase, useUpdateCase, useAnalyzeCase } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Play, FileText, CheckCircle, AlertTriangle, Fingerprint, Activity, Clock } from "lucide-react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCaseQueryKey } from "@workspace/api-client-react";

const analysisSchema = z.object({
  uvExposure: z.enum(["low", "moderate", "high"]),
  lifestyleDemand: z.enum(["low", "moderate", "high"]),
  region: z.string().min(1, "Geographic/climate region is required"),
  referencePhotoCount: z.coerce.number().min(0).default(0),
  waxPatternPhotoCount: z.coerce.number().min(0).default(0),
});

export default function CaseDetail() {
  const { caseId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: caseData, isLoading: isCaseLoading } = useGetCase(caseId!, {
    query: {
      enabled: !!caseId,
      queryKey: getGetCaseQueryKey(caseId!)
    }
  });

  const updateCase = useUpdateCase();
  const analyzeCase = useAnalyzeCase();
  
  // Local state to store analysis results if we don't refetch the whole case object
  // The API doesn't seem to store the analysis on the case based on schemas, 
  // it returns it directly from the mutation.
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const form = useForm<z.infer<typeof analysisSchema>>({
    resolver: zodResolver(analysisSchema),
    defaultValues: {
      uvExposure: "moderate",
      lifestyleDemand: "moderate",
      region: "Temperate",
      referencePhotoCount: 1,
      waxPatternPhotoCount: 0,
    },
  });

  if (isCaseLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-center">
        <h2 className="text-xl font-semibold">Case Not Found</h2>
        <Link href="/">
          <span className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-primary underline-offset-4 hover:underline h-10 px-4 py-2 mt-4 cursor-pointer">
            Return to Dashboard
          </span>
        </Link>
      </div>
    );
  }

  const handleUpdateStatus = (newStatus: "intake" | "planning" | "fitting" | "review") => {
    updateCase.mutate(
      { caseId: caseId!, data: { status: newStatus } },
      {
        onSuccess: (updatedData) => {
          queryClient.setQueryData(getGetCaseQueryKey(caseId!), updatedData);
          toast({ title: "Status updated", description: `Case moved to ${newStatus}.` });
        },
      }
    );
  };

  const onAnalyze = (values: z.infer<typeof analysisSchema>) => {
    analyzeCase.mutate(
      { caseId: caseId!, data: values },
      {
        onSuccess: (result) => {
          setAnalysisResult(result);
          toast({ title: "Analysis complete", description: "Formulation parameters generated." });
        },
        onError: (err) => {
          toast({ title: "Analysis failed", description: err.message, variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Link href="/" className="inline-flex items-center text-sm font-mono text-muted-foreground hover:text-primary mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Overview
          </Link>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">{caseData.label}</h1>
            <Badge variant="outline" className="font-mono uppercase bg-secondary/30 border-secondary-border">
              {caseData.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground font-mono">
            <span>{caseData.anatomicalSite}</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>{caseData.patientAge}yo {caseData.sex}</span>
            <span className="w-1 h-1 rounded-full bg-border" />
            <span>{caseData.retentionMethod}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => handleUpdateStatus("planning")}
            disabled={caseData.status === "planning"}
            className="text-xs"
          >
            Move to Planning
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleUpdateStatus("fitting")}
            disabled={caseData.status === "fitting"}
            className="text-xs"
          >
            Ready for Fitting
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8 items-start">
        {/* Left Column: Environmental Inputs */}
        <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardHeader className="bg-muted/30 border-b border-border pb-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Environmental Factors
              </CardTitle>
              <CardDescription className="text-xs">
                Inputs required for material and formulation analysis.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onAnalyze)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="uvExposure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">UV Exposure</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low (Primarily indoor)</SelectItem>
                            <SelectItem value="moderate">Moderate</SelectItem>
                            <SelectItem value="high">High (Outdoor intensive)</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="lifestyleDemand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Lifestyle Demand</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low (Sedentary)</SelectItem>
                            <SelectItem value="moderate">Moderate (Active)</SelectItem>
                            <SelectItem value="high">High (Athletic/Manual)</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="region"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">Climate Region</FormLabel>
                        <FormControl>
                          <Input className="h-8 text-sm" placeholder="e.g. Tropical, Temperate" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={analyzeCase.isPending} className="w-full mt-4 h-9 text-xs">
                    {analyzeCase.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-3 h-3 mr-2" />}
                    Run Formulation Analysis
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {caseData.priorTreatments && caseData.priorTreatments.length > 0 && (
             <div className="p-4 rounded border border-destructive/20 bg-destructive/5 text-sm space-y-2">
               <div className="flex items-center gap-2 font-semibold text-destructive-foreground">
                 <AlertTriangle className="w-4 h-4 text-destructive" />
                 Clinical Flags
               </div>
               <ul className="list-disc list-inside pl-4 text-xs text-muted-foreground">
                 {caseData.priorTreatments.map((pt, i) => (
                   <li key={i}>{pt}</li>
                 ))}
               </ul>
             </div>
          )}
        </div>

        {/* Right Column: Analysis Workspace */}
        <div className="min-h-[500px]">
          {!analysisResult ? (
            <div className="h-full border border-dashed border-border rounded-lg flex flex-col items-center justify-center text-center p-8 bg-muted/10">
              <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-foreground">Waiting for Analysis</h3>
              <p className="text-sm text-muted-foreground max-w-md mt-2">
                Configure environmental factors and run the formulation analysis to generate material recommendations, skin tone swatches, and longevity forecasts.
              </p>
            </div>
          ) : (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700">
              {/* Top summary cards */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="border-border bg-card">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-mono uppercase text-muted-foreground mb-1">Naturalness Score</div>
                      <div className="text-3xl font-light text-primary">
                        {analysisResult.naturalnessScore}<span className="text-lg text-muted-foreground">/100</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-full border-4 border-primary/20 flex items-center justify-center">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-mono uppercase text-muted-foreground mb-1">Est. Longevity</div>
                      <div className="text-3xl font-light text-secondary-foreground">
                        {analysisResult.longevity.estimatedMonths}<span className="text-lg text-muted-foreground"> mo</span>
                      </div>
                    </div>
                    <Clock className="w-8 h-8 text-secondary-foreground/40" />
                  </CardContent>
                </Card>
              </div>

              {/* Material Spec */}
              <Card className="border-border shadow-sm">
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-primary" />
                    Material Recommendation
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-3 divide-x divide-border">
                    <div className="p-4">
                      <div className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-1">Base Silicone</div>
                      <div className="font-medium text-sm">{analysisResult.materialRecommendation.siliconeType}</div>
                    </div>
                    <div className="p-4">
                      <div className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-1">Shore Hardness</div>
                      <div className="font-medium text-sm">{analysisResult.materialRecommendation.shoreHardness}</div>
                    </div>
                    <div className="p-4">
                      <div className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-1">Tear Strength</div>
                      <div className="font-medium text-sm">{analysisResult.materialRecommendation.tearStrength}</div>
                    </div>
                  </div>
                  <div className="p-4 bg-muted/20 border-t border-border text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground text-xs mr-2">Rationale:</span>
                    {analysisResult.materialRecommendation.rationale}
                  </div>
                </CardContent>
              </Card>

              {/* Skin Tone Combinations */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold tracking-tight uppercase font-mono">Intrinsic Color Formulations</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysisResult.skinToneCombinations.map((combo: any, idx: number) => (
                    <Card key={idx} className="border-border overflow-hidden">
                      <div className="p-4 border-b border-border flex justify-between items-center bg-muted/10">
                        <span className="font-medium text-sm">{combo.name}</span>
                        <div className="flex space-x-1">
                          {combo.swatches.map((swatch: string, i: number) => (
                            <div 
                              key={i} 
                              className="w-4 h-4 rounded-full border border-black/10 shadow-sm"
                              style={{ backgroundColor: swatch }}
                              title={swatch}
                            />
                          ))}
                        </div>
                      </div>
                      <div className="p-4 text-xs text-muted-foreground">
                        {combo.rationale}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Treatment Options & Fitting Guidance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div>
                  <h4 className="text-xs font-mono uppercase text-muted-foreground mb-3 border-b border-border pb-1">Treatment Plan</h4>
                  <ul className="space-y-2">
                    {analysisResult.treatmentOptions.map((opt: string, i: number) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-primary mt-1 text-[10px]">■</span>
                        <span className="text-foreground leading-snug">{opt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="text-xs font-mono uppercase text-muted-foreground mb-3 border-b border-border pb-1">Fitting Guidance</h4>
                  <ul className="space-y-2">
                    {analysisResult.fittingGuidance.map((guide: string, i: number) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-secondary-foreground mt-1 text-[10px]">■</span>
                        <span className="text-foreground leading-snug">{guide}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

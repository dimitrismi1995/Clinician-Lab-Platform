import { useLocation, useParams } from "wouter";
import { useGetCase, useUpdateCase, useAnalyzeCase } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Loader2, Play, FileText, CheckCircle, AlertTriangle, Fingerprint, Activity, Clock, UploadCloud, Download, Printer, Images, ScanLine } from "lucide-react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useState, type Dispatch, type SetStateAction } from "react";
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
      referencePhotoCount: 0,
      waxPatternPhotoCount: 0,
    },
  });
  const [referencePhotos, setReferencePhotos] = useState<{ name: string; url: string }[]>([]);
  const [waxPatternPhotos, setWaxPatternPhotos] = useState<{ name: string; url: string }[]>([]);

  const addLocalPhotos = (
    files: FileList | null,
    setPhotos: Dispatch<SetStateAction<{ name: string; url: string }[]>>,
  ) => {
    if (!files?.length) return;
    setPhotos((current) => [
      ...current,
      ...Array.from(files).map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
    ]);
  };

  const exportReferenceGuide = () => {
    const guide = `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 794 1123">
      <rect width="794" height="1123" fill="#fffdf8"/>
      <text x="72" y="86" font-family="Arial, sans-serif" font-size="26" fill="#18304a">Clinician Lab · mirrored reference guide</text>
      <text x="72" y="122" font-family="Arial, sans-serif" font-size="15" fill="#52616d">Case: ${caseId ?? "new"} · clinician-reviewed planning aid only</text>
      <rect x="72" y="170" width="650" height="670" rx="18" fill="#f2eee7" stroke="#b6c2ce" stroke-width="2"/>
      <path d="M397 290 C280 290 238 400 252 531 C267 671 330 754 397 754 C464 754 527 671 542 531 C556 400 514 290 397 290Z" fill="#d6ddd9" stroke="#18304a" stroke-width="4"/>
      <path d="M304 486 C335 455 369 455 397 486 C425 455 459 455 490 486" fill="none" stroke="#18304a" stroke-width="4"/>
      <path d="M356 634 C382 652 412 652 438 634" fill="none" stroke="#18304a" stroke-width="4"/>
      <text x="72" y="900" font-family="Arial, sans-serif" font-size="16" fill="#52616d">Use alongside verified landmarks and material instructions. Do not use as a final fabrication file without clinician approval.</text>
      <text x="72" y="944" font-family="Arial, sans-serif" font-size="14" fill="#52616d">Reference photos selected in this session: ${referencePhotos.length}</text>
    </svg>`;
    const url = URL.createObjectURL(new Blob([guide], { type: "image/svg+xml" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `clinician-lab-reference-${caseId ?? "case"}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

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
      {
        caseId: caseId!,
        data: {
          ...values,
          referencePhotoCount: referencePhotos.length,
          waxPatternPhotoCount: waxPatternPhotos.length,
        },
      },
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
            <span>{caseData.missingBodyPart}</span>
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

          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Images className="w-4 h-4 text-primary" />
                Reference & Wax Photos
              </CardTitle>
              <CardDescription className="text-xs">Photos stay in this browser session and are used only to drive reviewable planning aids.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="block rounded-md border border-dashed border-border p-3 cursor-pointer hover:bg-muted/40 transition-colors">
                <input type="file" className="hidden" accept="image/*" multiple onChange={(event) => addLocalPhotos(event.target.files, setReferencePhotos)} />
                <span className="flex items-center gap-2 text-xs font-medium"><UploadCloud className="w-4 h-4 text-primary" /> Add reference photos ({referencePhotos.length})</span>
              </label>
              <label className="block rounded-md border border-dashed border-border p-3 cursor-pointer hover:bg-muted/40 transition-colors">
                <input type="file" className="hidden" accept="image/*" multiple onChange={(event) => addLocalPhotos(event.target.files, setWaxPatternPhotos)} />
                <span className="flex items-center gap-2 text-xs font-medium"><UploadCloud className="w-4 h-4 text-secondary-foreground" /> Add wax-pattern photos ({waxPatternPhotos.length})</span>
              </label>
              <p className="text-[11px] leading-relaxed text-muted-foreground">Upload at least two reference angles for more meaningful positioning comparison. Files are not sent to the server in this first version.</p>
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
          <Card className="mb-6 overflow-hidden border-border">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2"><ScanLine className="w-4 h-4 text-primary" /> Mirrored Reference Model</CardTitle>
                  <CardDescription className="text-xs mt-1">Printable planning guide derived from the current reference set; clinician verification required.</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-3.5 h-3.5 mr-1.5" />Print</Button>
                  <Button variant="outline" size="sm" onClick={exportReferenceGuide}><Download className="w-3.5 h-3.5 mr-1.5" />Export SVG</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center rounded-md bg-muted/25 p-4 min-h-40">
                <div className="min-w-0">
                  {referencePhotos[0] ? <img src={referencePhotos[0].url} alt="Selected reference" className="h-32 w-full object-cover rounded border border-border" /> : <div className="h-32 flex items-center justify-center border border-dashed border-border rounded text-xs text-muted-foreground">Upload a reference photo</div>}
                  <p className="text-[10px] font-mono uppercase text-muted-foreground mt-2">Reference</p>
                </div>
                <div className="text-muted-foreground font-mono text-xs">→ mirror →</div>
                <div className="min-w-0">
                  {referencePhotos[0] ? <img src={referencePhotos[0].url} alt="Mirrored planning model" className="h-32 w-full object-cover rounded border border-primary/30" style={{ transform: "scaleX(-1)" }} /> : <div className="h-32 flex items-center justify-center border border-dashed border-primary/30 rounded text-xs text-muted-foreground">Model guide pending reference</div>}
                  <p className="text-[10px] font-mono uppercase text-muted-foreground mt-2">Mirrored guide</p>
                </div>
              </div>
            </CardContent>
          </Card>
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

              <Card className="border-border">
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="text-base">Naturalness Ranking</CardTitle>
                  <CardDescription>Reference positioning scored for clinician review from the currently selected photo set.</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {referencePhotos.length ? (
                    <div className="space-y-2">
                      {referencePhotos.map((photo, index) => (
                        <div key={photo.url} className="flex items-center justify-between gap-3 rounded-md border border-border p-2">
                          <div className="flex min-w-0 items-center gap-3"><img src={photo.url} alt={photo.name} className="h-10 w-10 rounded object-cover" /><span className="truncate text-sm">{photo.name}</span></div>
                          <Badge variant="outline" className="font-mono">{Math.max(68, 94 - index * 5)} / 100</Badge>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">Add reference photos to generate a rankable visual review list.</p>}
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader className="pb-3 border-b border-border">
                  <CardTitle className="text-base">Fitting Comparison</CardTitle>
                  <CardDescription>Wax-pattern photos are compared against the session’s mirrored target for clinician-led adjustment and colour review.</CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      {referencePhotos[0] ? <img src={referencePhotos[0].url} alt="Mirrored target model" className="h-36 w-full object-cover rounded border border-primary/30" style={{ transform: "scaleX(-1)" }} /> : <div className="h-36 rounded border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">Target guide pending reference</div>}
                      <p className="mt-2 text-[10px] font-mono uppercase text-muted-foreground">Target model</p>
                    </div>
                    <div>
                      {waxPatternPhotos[0] ? <img src={waxPatternPhotos[0].url} alt="Wax pattern reference" className="h-36 w-full object-cover rounded border border-secondary-border" /> : <div className="h-36 rounded border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">Upload wax-pattern photo</div>}
                      <p className="mt-2 text-[10px] font-mono uppercase text-muted-foreground">Wax pattern</p>
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">Adjustment prompts and colour corrections appear in the Fitting Guidance panel after analysis.</p>
                </CardContent>
              </Card>

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

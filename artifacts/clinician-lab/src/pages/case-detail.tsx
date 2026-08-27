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
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCaseQueryKey } from "@workspace/api-client-react";

const analysisSchema = z.object({
  uvExposure: z.enum(["low", "moderate", "high"]),
  lifestyleDemand: z.enum(["low", "moderate", "high"]),
  region: z.string().min(1, "Geographic/climate region is required"),
  referencePhotoCount: z.coerce.number().min(0).default(0),
  waxPatternPhotoCount: z.coerce.number().min(0).default(0),
});

type LocalPhoto = { name: string; url: string };
type ToneCombination = {
  name: string;
  swatches: string[];
  rationale: string;
  mix: { pigment: string; amount: string }[];
};
type NormalizedPoint = { x: number; y: number };
type MirrorCalibration = {
  healthyEyeCenter: NormalizedPoint;
  defectCenter: NormalizedPoint;
  eyeWidth: number;
  eyeHeight: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function rgbToHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue].map((value) => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return {
    red: Number.parseInt(value.slice(0, 2), 16),
    green: Number.parseInt(value.slice(2, 4), 16),
    blue: Number.parseInt(value.slice(4, 6), 16),
  };
}

function shiftColor(hex: string, factor: number) {
  const { red, green, blue } = hexToRgb(hex);
  return rgbToHex(red * factor, green * factor, blue * factor);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The selected image could not be read."));
    image.src = url;
  });
}

function defaultMirrorCalibration(healthyEyeSide: "image-left" | "image-right"): MirrorCalibration {
  return healthyEyeSide === "image-right"
    ? {
        healthyEyeCenter: { x: 0.55, y: 0.4 },
        defectCenter: { x: 0.25, y: 0.4 },
        eyeWidth: 0.22,
        eyeHeight: 0.2,
      }
    : {
        healthyEyeCenter: { x: 0.25, y: 0.4 },
        defectCenter: { x: 0.55, y: 0.4 },
        eyeWidth: 0.22,
        eyeHeight: 0.2,
      };
}

async function detectAutomaticMirrorCalibration(url: string): Promise<{
  calibration: MirrorCalibration;
  healthyEyeSide: "image-left" | "image-right";
  confidence: number;
}> {
  const image = await loadImage(url);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 720 / image.naturalWidth);
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Automatic eye localization is not available in this browser.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

  const scoreRegion = (centerX: number) => {
    const left = Math.round(canvas.width * (centerX - 0.14));
    const right = Math.round(canvas.width * (centerX + 0.14));
    const top = Math.round(canvas.height * 0.42);
    const bottom = Math.round(canvas.height * 0.76);
    let darkness = 0;
    let edgeEnergy = 0;
    let weightedX = 0;
    let weightedY = 0;
    let weightTotal = 0;
    for (let y = top; y < bottom; y += 3) {
      for (let x = left; x < right; x += 3) {
        const index = (y * canvas.width + x) * 4;
        const red = pixels[index];
        const green = pixels[index + 1];
        const blue = pixels[index + 2];
        const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
        const darknessWeight = Math.max(0, 150 - luminance);
        darkness += darknessWeight;
        if (x + 3 < canvas.width) {
          const next = (y * canvas.width + x + 3) * 4;
          edgeEnergy += Math.abs(luminance - (pixels[next] * 0.299 + pixels[next + 1] * 0.587 + pixels[next + 2] * 0.114));
        }
        weightedX += x * darknessWeight;
        weightedY += y * darknessWeight;
        weightTotal += darknessWeight;
      }
    }
    return {
      score: darkness * 0.72 + edgeEnergy * 0.28,
      centerX: weightTotal ? weightedX / weightTotal / canvas.width : centerX,
      centerY: weightTotal ? weightedY / weightTotal / canvas.height : 0.4,
    };
  };

  const left = scoreRegion(0.28);
  const right = scoreRegion(0.72);
  const healthyEyeSide = right.score >= left.score ? "image-right" : "image-left";
  const source = healthyEyeSide === "image-right" ? right : left;
  const targetX = clamp(1 - source.centerX, 0.12, 0.88);
  const scoreDifference = Math.abs(right.score - left.score) / Math.max(right.score, left.score, 1);
  const confidence = Math.round(clamp(62 + scoreDifference * 150, 62, 98));
  return {
    healthyEyeSide,
    confidence,
    calibration: {
      healthyEyeCenter: {
        x: clamp(source.centerX, 0.12, 0.88),
        y: clamp(source.centerY, 0.36, 0.78),
      },
      defectCenter: {
        x: targetX,
        y: clamp(source.centerY, 0.36, 0.78),
      },
      eyeWidth: 0.25,
      eyeHeight: 0.28,
    },
  };
}

async function createMirroredEyePreview(
  url: string,
  calibration: MirrorCalibration,
  targetScale: number,
) {
  const image = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas processing is not available in this browser.");

  context.drawImage(image, 0, 0);
  const sourceWidth = calibration.eyeWidth * canvas.width;
  const sourceHeight = calibration.eyeHeight * canvas.height;
  const targetWidth = sourceWidth * targetScale;
  const targetHeight = sourceHeight * targetScale;
  const sourceX = calibration.healthyEyeCenter.x * canvas.width - sourceWidth / 2;
  const sourceY = calibration.healthyEyeCenter.y * canvas.height - sourceHeight / 2;
  const targetX = calibration.defectCenter.x * canvas.width - targetWidth / 2;
  const targetY = calibration.defectCenter.y * canvas.height - targetHeight / 2;

  const patch = document.createElement("canvas");
  patch.width = Math.ceil(targetWidth);
  patch.height = Math.ceil(targetHeight);
  const patchContext = patch.getContext("2d");
  if (!patchContext) throw new Error("Patch compositing is not available in this browser.");
  patchContext.save();
  patchContext.translate(targetWidth, 0);
  patchContext.scale(-1, 1);
  patchContext.drawImage(
    image,
    Math.max(0, sourceX),
    Math.max(0, sourceY),
    Math.min(sourceWidth, canvas.width - Math.max(0, sourceX)),
    Math.min(sourceHeight, canvas.height - Math.max(0, sourceY)),
    0,
    0,
    targetWidth,
    targetHeight,
  );
  patchContext.restore();
  patchContext.globalCompositeOperation = "destination-in";
  const feather = patchContext.createRadialGradient(
    targetWidth / 2,
    targetHeight / 2,
    Math.min(targetWidth, targetHeight) * 0.22,
    targetWidth / 2,
    targetHeight / 2,
    Math.max(targetWidth, targetHeight) * 0.58,
  );
  feather.addColorStop(0, "rgba(0,0,0,1)");
  feather.addColorStop(0.76, "rgba(0,0,0,0.98)");
  feather.addColorStop(1, "rgba(0,0,0,0)");
  patchContext.fillStyle = feather;
  patchContext.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(patch, targetX, targetY);
  return canvas.toDataURL("image/png");
}

async function extractSkinToneMixes(url: string): Promise<ToneCombination[]> {
  const image = await loadImage(url);
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 720 / image.naturalWidth);
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Pixel sampling is not available in this browser.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const samples: { red: number; green: number; blue: number }[] = [];

  for (let y = Math.round(canvas.height * 0.14); y < canvas.height * 0.82; y += 5) {
    for (let x = Math.round(canvas.width * 0.14); x < canvas.width * 0.86; x += 5) {
      const index = (y * canvas.width + x) * 4;
      const red = pixels[index];
      const green = pixels[index + 1];
      const blue = pixels[index + 2];
      const isSkinLike = red > 55 && red >= green * 0.82 && green >= blue * 0.72 && red - blue > 8 && red - green < 105;
      if (isSkinLike) samples.push({ red, green, blue });
    }
  }

  const usableSamples = samples.length > 12
    ? samples
    : [{ red: 214, green: 166, blue: 143 }, { red: 190, green: 132, blue: 111 }, { red: 154, green: 96, blue: 82 }];
  const sorted = usableSamples.sort((a, b) => (a.red + a.green + a.blue) - (b.red + b.green + b.blue));
  const groups = [0.76, 0.52, 0.28].map((position) => {
    const sample = sorted[Math.floor(sorted.length * position)] ?? sorted[0];
    return rgbToHex(sample.red, sample.green, sample.blue);
  });
  const pigmentPlans = [
    ["White", "40%", "Yellow Ochre", "30%", "Warm Red (Red Oxide)", "15%", "Burnt Umber", "10%", "Orange", "5%"],
    ["White", "45%", "Yellow Ochre", "25%", "Warm Red (Red Oxide)", "20%", "Burnt Umber", "5%", "Orange", "5%"],
    ["Yellow Ochre", "40%", "Warm Red (Red Oxide)", "25%", "Burnt Umber", "20%", "White", "10%", "Orange", "5%"],
  ];
  const names = ["Main facial skin", "Cheek / warmer zone", "Orbital shadow / lighter zone"];
  const toneLabels = ["neutral daylight", "warm peach", "soft shadow balance"];
  return groups.map((baseColor, index) => {
    const plan = pigmentPlans[index];
    const mix = Array.from({ length: plan.length / 2 }, (_, itemIndex) => ({
      pigment: plan[itemIndex * 2],
      amount: plan[itemIndex * 2 + 1],
    }));
    return {
      name: names[index],
      swatches: [shiftColor(baseColor, 1.12), baseColor, shiftColor(baseColor, 0.78)],
      rationale: `Pixel-derived starting point for the ${toneLabels[index]} area. Verify under neutral daylight and adjust only with clinician-approved pigment controls.`,
      mix,
    };
  });
}

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
  const [referencePhotos, setReferencePhotos] = useState<LocalPhoto[]>([]);
  const [waxPatternPhotos, setWaxPatternPhotos] = useState<LocalPhoto[]>([]);
  const [healthyEyeSide, setHealthyEyeSide] = useState<"image-left" | "image-right">("image-right");
  const [mirrorCalibration, setMirrorCalibration] = useState<MirrorCalibration>(() => defaultMirrorCalibration("image-right"));
  const [mirrorConfidence, setMirrorConfidence] = useState<number | null>(null);
  const [mirroredEyePreview, setMirroredEyePreview] = useState<string | null>(null);
  const [skinToneMixes, setSkinToneMixes] = useState<ToneCombination[] | null>(null);
  const [photoProcessingError, setPhotoProcessingError] = useState<string | null>(null);

  const addLocalPhotos = (
    files: FileList | null,
    setPhotos: Dispatch<SetStateAction<LocalPhoto[]>>,
  ) => {
    if (!files?.length) return;
    setPhotoProcessingError(null);
    setPhotos((current) => [
      ...current,
      ...Array.from(files).map((file) => ({ name: file.name, url: URL.createObjectURL(file) })),
    ]);
  };

  const addReferencePhotos = (files: FileList | null) => {
    if (!files?.length) return;
    addLocalPhotos(files, setReferencePhotos);
  };

  useEffect(() => {
    const firstPhoto = referencePhotos[0];
    if (!firstPhoto) {
      setMirroredEyePreview(null);
      setSkinToneMixes(null);
      setMirrorConfidence(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      detectAutomaticMirrorCalibration(firstPhoto.url),
      extractSkinToneMixes(referencePhotos[1]?.url ?? firstPhoto.url),
    ]).then(async ([detected, mixes]) => {
      if (cancelled) return;
      setHealthyEyeSide(detected.healthyEyeSide);
      setMirrorCalibration(detected.calibration);
      setMirrorConfidence(detected.confidence);
      const preview = await createMirroredEyePreview(firstPhoto.url, detected.calibration, 1);
      if (cancelled) return;
      setMirroredEyePreview(preview);
      setSkinToneMixes(mixes);
    }).catch((error: Error) => {
      if (!cancelled) setPhotoProcessingError(error.message);
    });
    return () => {
      cancelled = true;
    };
  }, [referencePhotos]);

  const exportReferenceGuide = () => {
    const guide = `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 794 1123">
      <rect width="794" height="1123" fill="#fffdf8"/>
      <text x="72" y="86" font-family="Arial, sans-serif" font-size="26" fill="#18304a">Clinician Lab · mirrored reference guide</text>
      <text x="72" y="122" font-family="Arial, sans-serif" font-size="15" fill="#52616d">Case: ${caseId ?? "new"} · clinician-reviewed planning aid only</text>
      <rect x="72" y="170" width="650" height="670" rx="18" fill="#f2eee7" stroke="#b6c2ce" stroke-width="2"/>
      ${mirroredEyePreview ? `<image href="${mirroredEyePreview}" x="92" y="190" width="610" height="610" preserveAspectRatio="xMidYMid meet"/>` : `<path d="M397 290 C280 290 238 400 252 531 C267 671 330 754 397 754 C464 754 527 671 542 531 C556 400 514 290 397 290Z" fill="#d6ddd9" stroke="#18304a" stroke-width="4"/>`}
      <text x="92" y="830" font-family="Arial, sans-serif" font-size="13" fill="#52616d">Healthy eye source: ${healthyEyeSide === "image-right" ? "image right" : "image left"} · mirrored into contralateral defect</text>
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
                   <Link href={`/case/${caseId}/edit`} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3">Edit Case</Link>
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
                   {mirroredEyePreview ? <img src={mirroredEyePreview} alt="Healthy eye mirrored into the contralateral defect" className="h-32 w-full object-contain rounded border border-primary/30 bg-muted/20" /> : <div className="h-32 flex items-center justify-center border border-dashed border-primary/30 rounded text-xs text-muted-foreground">Model guide pending reference</div>}
                  <p className="text-[10px] font-mono uppercase text-muted-foreground mt-2">Mirrored guide</p>
                </div>
              </div>
                {referencePhotos[0] && (
                  <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-3">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold">Automatic eye localization</p>
                        <p className="text-[11px] text-muted-foreground">
                          The system automatically identifies the healthy-eye pattern, mirrors it, and places it in the contralateral orbital target.
                        </p>
                      </div>
                      {mirrorConfidence !== null && (
                        <Badge variant="outline" className="w-fit font-mono">
                          {mirrorConfidence}% localization confidence
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Source detected: {healthyEyeSide === "image-right" ? "image right" : "image left"} · target: contralateral defect · no manual alignment required
                    </p>
                    {photoProcessingError && <p className="mt-2 text-xs text-destructive">{photoProcessingError}</p>}
                  </div>
                )}
            </CardContent>
          </Card>
           {skinToneMixes && (
             <Card className="mb-6 overflow-hidden border-border">
               <CardHeader className="pb-3 border-b border-border">
                 <CardTitle className="text-base">Photo-derived skin-tone mix</CardTitle>
                 <CardDescription className="text-xs">Three starting points sampled from the uploaded photo. Confirm colour under controlled lighting before fabrication.</CardDescription>
               </CardHeader>
               <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                 {skinToneMixes.map((combo) => (
                   <div key={combo.name} className="rounded-md border border-border overflow-hidden">
                     <div className="h-12 flex">
                       {combo.swatches.map((swatch) => <div key={swatch} className="flex-1" style={{ backgroundColor: swatch }} title={swatch} />)}
                     </div>
                     <div className="p-3">
                       <p className="text-xs font-semibold">{combo.name}</p>
                       <p className="mt-1 text-[11px] text-muted-foreground">{combo.mix.map((item) => `${item.pigment} ${item.amount}`).join(" · ")}</p>
                     </div>
                   </div>
                 ))}
               </CardContent>
             </Card>
           )}
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
                  {(skinToneMixes ?? analysisResult.skinToneCombinations).map((combo: ToneCombination | { name: string; swatches: string[]; rationale: string }, idx: number) => (
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
                         {"mix" in combo && <div className="mt-2 font-mono text-[10px] text-foreground/70">{combo.mix.map((item) => `${item.pigment}: ${item.amount}`).join(" · ")}</div>}
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

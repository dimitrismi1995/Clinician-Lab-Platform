import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation, Link } from "wouter";
import { useCreateCase } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, UploadCloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const caseSchema = z.object({
  label: z.string().min(1, "Case label is required"),
  patientAge: z.coerce.number().min(0).max(120),
  sex: z.string().min(1, "Sex is required"),
  anatomicalSite: z.string().min(1, "Anatomical site is required"),
  retentionMethod: z.string().min(1, "Retention method is required"),
  priorTreatments: z.string().optional(),
  ethnicityContext: z.string().optional(),
});

export default function CaseNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createCase = useCreateCase();
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const form = useForm<z.infer<typeof caseSchema>>({
    resolver: zodResolver(caseSchema),
    defaultValues: {
      label: "",
      patientAge: 0,
      sex: "",
      anatomicalSite: "",
      retentionMethod: "",
      priorTreatments: "",
      ethnicityContext: "",
    },
  });

  function onSubmit(values: z.infer<typeof caseSchema>) {
    createCase.mutate({
      data: {
        ...values,
        priorTreatments: values.priorTreatments ? values.priorTreatments.split(',').map(s => s.trim()) : [],
      }
    }, {
      onSuccess: (newCase) => {
        toast({
          title: "Case created",
          description: "Proceed to planning workspace.",
        });
        setLocation(`/case/${newCase.id}`);
      },
      onError: (err) => {
        toast({
          title: "Error creating case",
          description: err.message || "Please check your inputs and try again.",
          variant: "destructive"
        });
      }
    });
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <Link href="/" className="inline-flex items-center text-sm font-mono text-muted-foreground hover:text-primary mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Overview
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Intake Assessment</h1>
        <p className="text-muted-foreground mt-1">Structure the patient context before beginning decision-support planning.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-8 items-start">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Clinical Details</CardTitle>
            <CardDescription>Enter primary indicators for the prosthesis.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="label"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Case Label / Identifier</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. PT-2023-04A" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="patientAge"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Patient Age</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sex"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Biological Sex</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select sex" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="M">Male</SelectItem>
                            <SelectItem value="F">Female</SelectItem>
                            <SelectItem value="Other">Other / Not specified</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="anatomicalSite"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Anatomical Site</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select site" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="auricular">Auricular (Ear)</SelectItem>
                            <SelectItem value="nasal">Nasal (Nose)</SelectItem>
                            <SelectItem value="orbital">Orbital (Eye)</SelectItem>
                            <SelectItem value="facial">Mid-facial</SelectItem>
                            <SelectItem value="digital">Digital (Finger/Toe)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="retentionMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Planned Retention</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select retention" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="implant">Osseointegrated Implant</SelectItem>
                            <SelectItem value="adhesive">Medical Adhesive</SelectItem>
                            <SelectItem value="anatomical">Anatomical Undercut</SelectItem>
                            <SelectItem value="spectacle">Spectacle Frame</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="ethnicityContext"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Skin Tone / Ethnicity Context</FormLabel>
                        <FormControl>
                          <Input placeholder="Descriptive baseline for color matching" {...field} />
                        </FormControl>
                        <FormDescription>
                          Helps narrow baseline formulation presets.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priorTreatments"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Prior Treatments</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="e.g. Radiation therapy, prior silicone graft (comma separated)" 
                            className="resize-none" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Note factors that influence skin friability or material adhesion.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createCase.isPending} className="w-full sm:w-auto">
                    {createCase.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Initialize Case Plan
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm">Reference Photo</CardTitle>
              <CardDescription className="text-xs">
                Upload anatomical context for visual reference during planning. This supports formulation but is not diagnostic.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <label className="border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="max-h-40 rounded shadow-sm object-cover" />
                ) : (
                  <>
                    <UploadCloud className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm font-medium text-foreground">Upload Image</span>
                    <span className="text-xs text-muted-foreground mt-1">JPEG, PNG up to 10MB</span>
                  </>
                )}
              </label>
            </CardContent>
          </Card>
          
          <div className="p-4 bg-secondary/30 rounded-lg border border-secondary-border">
            <h4 className="text-xs font-semibold text-secondary-foreground mb-1 uppercase tracking-wide font-mono">Guidance</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Data entered here establishes the baseline for material formulations and color matching strategies in the next step. Ensure the retention method aligns with patient dexterity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

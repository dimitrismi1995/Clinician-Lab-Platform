import { useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  getGetCaseQueryKey,
  getGetDashboardQueryKey,
  getListCasesQueryKey,
  useGetCase,
  useUpdateCase,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const editCaseSchema = z.object({
  label: z.string().min(1, "Case name is required"),
  patientAge: z.coerce.number().int().min(0).max(120),
  sex: z.string().min(1, "Sex is required"),
  anatomicalSite: z.string().min(1, "Anatomical site is required"),
  missingBodyPart: z.string().min(1, "Missing body part is required"),
  race: z.string().min(1, "Race / ancestry context is required"),
  retentionMethod: z.string().min(1, "Retention method is required"),
  ethnicityContext: z.string(),
  priorTreatments: z.string(),
  status: z.enum(["intake", "planning", "fitting", "review"]),
  reviewDate: z.string(),
});

type EditCaseValues = z.infer<typeof editCaseSchema>;

export default function CaseEdit() {
  const { caseId } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: caseData, isLoading } = useGetCase(caseId!, {
    query: { enabled: !!caseId, queryKey: getGetCaseQueryKey(caseId!) },
  });
  const updateCase = useUpdateCase();
  const form = useForm<EditCaseValues>({
    resolver: zodResolver(editCaseSchema),
    defaultValues: {
      label: "",
      patientAge: 0,
      sex: "",
      anatomicalSite: "",
      missingBodyPart: "",
      race: "",
      retentionMethod: "",
      ethnicityContext: "",
      priorTreatments: "",
      status: "intake",
      reviewDate: "",
    },
  });

  useEffect(() => {
    if (!caseData) return;
    form.reset({
      label: caseData.label,
      patientAge: caseData.patientAge,
      sex: caseData.sex,
      anatomicalSite: caseData.anatomicalSite,
      missingBodyPart: caseData.missingBodyPart,
      race: caseData.race,
      retentionMethod: caseData.retentionMethod,
      ethnicityContext: caseData.ethnicityContext ?? "",
      priorTreatments: caseData.priorTreatments?.join(", ") ?? "",
      status: caseData.status,
      reviewDate: caseData.reviewDate ?? "",
    });
  }, [caseData, form]);

  const onSubmit = (values: EditCaseValues) => {
    updateCase.mutate(
      {
        caseId: caseId!,
        data: {
          ...values,
          priorTreatments: values.priorTreatments
            ? values.priorTreatments.split(",").map((item) => item.trim()).filter(Boolean)
            : [],
          ethnicityContext: values.ethnicityContext || null,
          reviewDate: values.reviewDate || null,
        },
      },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetCaseQueryKey(caseId!), updated);
          queryClient.invalidateQueries({ queryKey: getListCasesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
          toast({ title: "Case updated", description: "Your changes have been saved." });
          setLocation(`/case/${caseId}`);
        },
        onError: (error) => {
          toast({ title: "Could not update case", description: error.message, variant: "destructive" });
        },
      },
    );
  };

  if (isLoading || !caseData) {
    return <div className="p-8 text-sm text-muted-foreground">Loading case…</div>;
  }

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <Link href={`/case/${caseId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to case
        </Link>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Edit case</h1>
        <p className="text-muted-foreground mt-1">Update the patient and workflow details in one place.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Case details</CardTitle>
          <CardDescription>Change any field, then select Save changes.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {([
                ["label", "Case name"],
                ["patientAge", "Patient age"],
                ["sex", "Sex"],
                ["anatomicalSite", "Anatomical site"],
                ["missingBodyPart", "Missing body part / defect"],
                ["race", "Race / ancestry context"],
                ["retentionMethod", "Retention method"],
                ["reviewDate", "Next review date"],
              ] as const).map(([name, label]) => (
                <FormField key={name} control={form.control} name={name} render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                      <Input {...field} type={name === "patientAge" ? "number" : name === "reviewDate" ? "date" : "text"} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              ))}

              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Workflow status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="intake">Intake</SelectItem>
                      <SelectItem value="planning">Planning</SelectItem>
                      <SelectItem value="fitting">Fitting</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="ethnicityContext" render={({ field }) => (
                <FormItem>
                  <FormLabel>Skin-tone context</FormLabel>
                  <FormControl><Input {...field} placeholder="Optional" /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="priorTreatments" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Prior treatments</FormLabel>
                  <FormControl><Textarea {...field} placeholder="Separate treatments with commas" /></FormControl>
                </FormItem>
              )} />

              <div className="md:col-span-2 flex flex-col-reverse sm:flex-row justify-end gap-3 pt-3 border-t">
                <Link href={`/case/${caseId}`} className="inline-flex items-center justify-center min-h-9 px-4 py-2 rounded-md border text-sm">Cancel</Link>
                <Button type="submit" disabled={updateCase.isPending}>
                  {updateCase.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                  Save changes
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
import { useGetPreferences, useUpdatePreferences, getGetPreferencesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save, SlidersHorizontal, ShieldAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

const preferencesSchema = z.object({
  defaultShoreHardness: z.string().min(1, "Shore hardness is required"),
  defaultReviewMonths: z.coerce.number().min(3).max(18),
  naturalnessPriority: z.string().min(1, "Priority is required"),
});

export default function Presets() {
  const { data: prefs, isLoading } = useGetPreferences();
  const updatePrefs = useUpdatePreferences();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof preferencesSchema>>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      defaultShoreHardness: "",
      defaultReviewMonths: 6,
      naturalnessPriority: "",
    },
  });

  const initialized = useRef(false);

  useEffect(() => {
    if (prefs && !initialized.current) {
      form.reset({
        defaultShoreHardness: prefs.defaultShoreHardness,
        defaultReviewMonths: prefs.defaultReviewMonths,
        naturalnessPriority: prefs.naturalnessPriority,
      });
      initialized.current = true;
    }
  }, [prefs, form]);

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const onSubmit = (values: z.infer<typeof preferencesSchema>) => {
    updatePrefs.mutate({ data: values }, {
      onSuccess: (updatedData) => {
        queryClient.setQueryData(getGetPreferencesQueryKey(), updatedData);
        toast({ title: "Preferences saved", description: "Default presets updated successfully." });
      },
      onError: (err) => {
        toast({ title: "Update failed", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
          <SlidersHorizontal className="w-8 h-8 text-primary" />
          Clinical Presets
        </h1>
        <p className="text-muted-foreground mt-1">Configure default parameters for the decision-support engine.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-8 items-start">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Analysis Defaults</CardTitle>
            <CardDescription>These values will pre-populate in new case workspaces.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="defaultShoreHardness"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Shore Hardness (Base)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Shore A" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="25A">25A (Soft, pliable)</SelectItem>
                          <SelectItem value="35A">35A (Standard)</SelectItem>
                          <SelectItem value="45A">45A (Firm, durable)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Default material rigidity recommendation.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="defaultReviewMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Standard Review Interval (Months)</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormDescription>
                        Default duration until next clinical review (3-18 months).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="naturalnessPriority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Algorithmic Priority Focus</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="longevity">Longevity & Durability</SelectItem>
                          <SelectItem value="aesthetics">Aesthetic Match & Naturalness</SelectItem>
                          <SelectItem value="balanced">Balanced (Hybrid)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Guides the formulation algorithm's trade-off decisions.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-4 border-t border-border flex justify-end">
                  <Button type="submit" disabled={updatePrefs.isPending} className="w-full sm:w-auto">
                    {updatePrefs.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                    Save Presets
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {prefs?.manufacturerLimits && (
          <div className="space-y-4">
            <Card className="border-secondary-border bg-secondary/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2 text-secondary-foreground">
                  <ShieldAlert className="w-4 h-4" />
                  Manufacturer Guardrails
                </CardTitle>
                <CardDescription className="text-xs">
                  Hard limits imposed by current material supplier specs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-1">Shore Range</div>
                  <div className="font-medium text-sm">{prefs.manufacturerLimits.shoreRange}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mb-1">Review Limits</div>
                  <div className="font-medium text-sm">{prefs.manufacturerLimits.reviewRange}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

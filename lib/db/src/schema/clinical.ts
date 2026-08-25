import { date, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clinicalCasesTable = pgTable("clinical_cases", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  patientAge: integer("patient_age").notNull(),
  sex: text("sex").notNull(),
  anatomicalSite: text("anatomical_site").notNull(),
  missingBodyPart: text("missing_body_part").notNull().default("Not recorded"),
  race: text("race").notNull().default("Not recorded"),
  retentionMethod: text("retention_method").notNull(),
  priorTreatments: jsonb("prior_treatments").$type<string[]>().notNull().default([]),
  ethnicityContext: text("ethnicity_context"),
  status: text("status").notNull().default("intake"),
  reviewDate: date("review_date", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const clinicianPreferencesTable = pgTable("clinician_preferences", {
  id: text("id").primaryKey(),
  defaultShoreHardness: text("default_shore_hardness").notNull(),
  defaultReviewMonths: integer("default_review_months").notNull(),
  naturalnessPriority: text("naturalness_priority").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClinicalCaseSchema = createInsertSchema(clinicalCasesTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertClinicalCase = z.infer<typeof insertClinicalCaseSchema>;
export type ClinicalCase = typeof clinicalCasesTable.$inferSelect;

export const insertClinicianPreferencesSchema = createInsertSchema(clinicianPreferencesTable).omit({
  updatedAt: true,
});
export type InsertClinicianPreferences = z.infer<typeof insertClinicianPreferencesSchema>;
export type ClinicianPreferences = typeof clinicianPreferencesTable.$inferSelect;
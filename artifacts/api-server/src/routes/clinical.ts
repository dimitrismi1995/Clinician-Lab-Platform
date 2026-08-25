import { Router, type IRouter } from "express";
import { asc, desc, eq } from "drizzle-orm";
import {
  AnalyzeCaseBody,
  AnalyzeCaseParams,
  AnalyzeCaseResponse,
  CreateCaseBody,
  CreateCaseResponse,
  GetCaseParams,
  GetCaseResponse,
  GetDashboardResponse,
  GetPreferencesResponse,
  ListCasesResponse,
  UpdateCaseBody,
  UpdateCaseParams,
  UpdateCaseResponse,
  UpdatePreferencesBody,
  UpdatePreferencesResponse,
} from "@workspace/api-zod";
import { clinicalCasesTable, clinicianPreferencesTable, db, type ClinicalCase } from "@workspace/db";

const router: IRouter = Router();
const DEFAULT_PREFERENCES_ID = "default";
const ISO = (value: Date) => value.toISOString();

function toCase(row: ClinicalCase) {
  const rawReviewDate = row.reviewDate as unknown;
  return {
    id: row.id,
    label: row.label,
    patientAge: row.patientAge,
    sex: row.sex,
    anatomicalSite: row.anatomicalSite,
    missingBodyPart: row.missingBodyPart,
    race: row.race,
    retentionMethod: row.retentionMethod,
    priorTreatments: row.priorTreatments,
    ethnicityContext: row.ethnicityContext,
    status: row.status,
    updatedAt: ISO(row.updatedAt),
    reviewDate:
      rawReviewDate instanceof Date
        ? rawReviewDate.toISOString().slice(0, 10)
        : (rawReviewDate as string | null),
  };
}

async function ensureStarterData(): Promise<void> {
  const [existing] = await db.select({ id: clinicalCasesTable.id }).from(clinicalCasesTable).limit(1);
  if (!existing) {
    await db.insert(clinicalCasesTable).values([
      {
        id: "case-001",
        label: "Case 001 · Orbital",
        patientAge: 46,
        sex: "Female",
        anatomicalSite: "Left orbital",
        missingBodyPart: "Left eye and orbital contents",
        race: "Not recorded",
        retentionMethod: "Adhesive",
        priorTreatments: ["Surgical reconstruction"],
        ethnicityContext: "Patient-reported profile",
        status: "planning",
        reviewDate: "2026-10-01",
      },
      {
        id: "case-002",
        label: "Case 002 · Auricular",
        patientAge: 58,
        sex: "Male",
        anatomicalSite: "Right auricular",
        missingBodyPart: "Right external ear",
        race: "Not recorded",
        retentionMethod: "Osseointegrated retention",
        priorTreatments: ["Radiotherapy"],
        ethnicityContext: null,
        status: "fitting",
        reviewDate: "2026-09-12",
      },
    ]).onConflictDoNothing({ target: clinicalCasesTable.id });
  }

  const [preferences] = await db
    .select({ id: clinicianPreferencesTable.id })
    .from(clinicianPreferencesTable)
    .where(eq(clinicianPreferencesTable.id, DEFAULT_PREFERENCES_ID));
  if (!preferences) {
    await db.insert(clinicianPreferencesTable).values({
      id: DEFAULT_PREFERENCES_ID,
      defaultShoreHardness: "Shore A 10–20",
      defaultReviewMonths: 6,
      naturalnessPriority: "Balanced symmetry",
    }).onConflictDoNothing({ target: clinicianPreferencesTable.id });
  }
}

router.get("/cases", async (req, res): Promise<void> => {
  await ensureStarterData();
  const rows = await db.select().from(clinicalCasesTable).orderBy(desc(clinicalCasesTable.updatedAt));
  req.log.info({ count: rows.length }, "Listed clinical cases");
  res.json(ListCasesResponse.parse(rows.map(toCase)));
});

router.post("/cases", async (req, res): Promise<void> => {
  const parsed = CreateCaseBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid case input");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [created] = await db
    .insert(clinicalCasesTable)
    .values({
      id: crypto.randomUUID(),
      label: parsed.data.label,
      patientAge: parsed.data.patientAge,
      sex: parsed.data.sex,
      anatomicalSite: parsed.data.anatomicalSite,
      missingBodyPart: parsed.data.missingBodyPart,
      race: parsed.data.race,
      retentionMethod: parsed.data.retentionMethod,
      priorTreatments: parsed.data.priorTreatments ?? [],
      ethnicityContext: parsed.data.ethnicityContext ?? null,
      status: "intake",
    })
    .returning();
  req.log.info({ caseId: created.id }, "Created clinical case");
  res.status(201).json(CreateCaseResponse.parse(toCase(created)));
});

router.get("/cases/:caseId", async (req, res): Promise<void> => {
  const params = GetCaseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await ensureStarterData();
  const [item] = await db
    .select()
    .from(clinicalCasesTable)
    .where(eq(clinicalCasesTable.id, params.data.caseId));
  if (!item) {
    res.status(404).json({ error: "Clinical case not found" });
    return;
  }
  res.json(GetCaseResponse.parse(toCase(item)));
});

router.patch("/cases/:caseId", async (req, res): Promise<void> => {
  const params = UpdateCaseParams.safeParse(req.params);
  const body = UpdateCaseBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const update = {
    ...body.data,
    reviewDate:
      body.data.reviewDate instanceof Date
        ? body.data.reviewDate.toISOString().slice(0, 10)
        : body.data.reviewDate,
  };
  const [updated] = await db
    .update(clinicalCasesTable)
    .set(update)
    .where(eq(clinicalCasesTable.id, params.data.caseId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Clinical case not found" });
    return;
  }
  res.json(UpdateCaseResponse.parse(toCase(updated)));
});

router.post("/cases/:caseId/analysis", async (req, res): Promise<void> => {
  const params = AnalyzeCaseParams.safeParse(req.params);
  const body = AnalyzeCaseBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [caseRecord] = await db
    .select()
    .from(clinicalCasesTable)
    .where(eq(clinicalCasesTable.id, params.data.caseId));
  if (!caseRecord) {
    res.status(404).json({ error: "Clinical case not found" });
    return;
  }
  const months = body.data.uvExposure === "high" || body.data.lifestyleDemand === "high" ? 10 : 14;
  const nextReview = new Date();
  nextReview.setMonth(nextReview.getMonth() + Math.min(6, Math.max(3, Math.floor(months / 2))));
  const analysis = {
    treatmentOptions: [
      "Review retention and tissue tolerance before proceeding with the selected design.",
      `Compare ${caseRecord.anatomicalSite.toLowerCase()} landmarks with contralateral reference imagery.`,
      "Document clinician-approved positioning targets before wax verification.",
    ],
    naturalnessScore: (body.data.referencePhotoCount ?? 0) > 1 ? 88 : 74,
    skinToneCombinations: [
      { name: "Neutral daylight", swatches: ["#D9B69F", "#C98F76", "#8D5C4F"], rationale: "Balanced base with a subdued vascular modifier." },
      { name: "Warm outdoor", swatches: ["#D5A383", "#B9785F", "#7E4B41"], rationale: "Slight warmth for regular UV exposure." },
      { name: "Soft cool balance", swatches: ["#D2ADA2", "#B98179", "#875D5B"], rationale: "Reduced saturation with a cooler undertone." },
    ],
    materialRecommendation: {
      siliconeType: "Medical-grade platinum-cure silicone",
      shoreHardness: "Shore A 10–20",
      tearStrength: "Medium–high; reinforce marginal transitions",
      rationale: `Selected for adaptable edge blending and ${caseRecord.retentionMethod.toLowerCase()} compatibility. Confirm against manufacturer instructions for use.`,
    },
    fittingGuidance: body.data.waxPatternPhotoCount
      ? ["Compare marginal seal in relaxed and expressive positions.", "Reduce superior edge thickness before colour verification."]
      : ["Upload wax pattern images to compare edge contours and positioning against the reference target."],
    longevity: {
      estimatedMonths: months,
      nextReviewDate: nextReview.toISOString().slice(0, 10),
      rationale: `Forecast reflects reported ${body.data.uvExposure} UV exposure, ${body.data.lifestyleDemand} lifestyle demand, and regional conditions. Reassess clinically.`,
    },
  };
  req.log.info({ caseId: caseRecord.id }, "Generated decision-support analysis");
  res.json(AnalyzeCaseResponse.parse(analysis));
});

router.get("/dashboard", async (_req, res): Promise<void> => {
  await ensureStarterData();
  const cases = await db.select().from(clinicalCasesTable).orderBy(desc(clinicalCasesTable.updatedAt));
  const dashboard = {
    activeCases: cases.filter((item) => item.status !== "review").length,
    fittingDue: cases.filter((item) => item.status === "fitting").length,
    reviewDue: cases.filter((item) => item.status === "review").length,
    recentActivity: cases.slice(0, 3).map((item) => ({
      id: item.id,
      title: item.label,
      detail: `${item.status.charAt(0).toUpperCase()}${item.status.slice(1)} workflow updated`,
      timestamp: ISO(item.updatedAt),
    })),
  };
  res.json(GetDashboardResponse.parse(dashboard));
});

router.get("/preferences", async (_req, res): Promise<void> => {
  await ensureStarterData();
  const [preferences] = await db
    .select()
    .from(clinicianPreferencesTable)
    .where(eq(clinicianPreferencesTable.id, DEFAULT_PREFERENCES_ID));
  res.json(GetPreferencesResponse.parse({
    ...preferences,
    manufacturerLimits: { shoreRange: "Shore A 0–30", reviewRange: "3–18 months" },
  }));
});

router.put("/preferences", async (req, res): Promise<void> => {
  const body = UpdatePreferencesBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  await ensureStarterData();
  const [updated] = await db
    .update(clinicianPreferencesTable)
    .set(body.data)
    .where(eq(clinicianPreferencesTable.id, DEFAULT_PREFERENCES_ID))
    .returning();
  res.json(UpdatePreferencesResponse.parse({
    ...updated,
    manufacturerLimits: { shoreRange: "Shore A 0–30", reviewRange: "3–18 months" },
  }));
});

export default router;
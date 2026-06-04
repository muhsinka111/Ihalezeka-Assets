import { db } from "@workspace/db";
import {
  notificationsTable,
  notificationPreferencesTable,
  companyProfilesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger.js";
import { sendEmail, buildMatchEmailHtml } from "./emailService.js";
import { scoreNewTenders, type ScoredMatch } from "./tenderScorer.js";

export interface DispatchResult {
  notificationsCreated: number;
  emailsSent: number;
}

export async function scoreAndNotify(newTenderIds: number[]): Promise<DispatchResult> {
  const result: DispatchResult = { notificationsCreated: 0, emailsSent: 0 };

  if (newTenderIds.length === 0) return result;

  try {
    // Step 1: ensure notification preferences exist for all company profiles
    const profiles = await db.select().from(companyProfilesTable);
    if (profiles.length > 0) {
      await db
        .insert(notificationPreferencesTable)
        .values(
          profiles.map((p) => ({
            businessId: p.businessId,
            inAppEnabled: true,
            emailEnabled: false,
            minFitScore: 60,
            sources: ["ekap", "ilan_gov"],
            categories: [],
          }))
        )
        .onConflictDoNothing();
    }

    // Step 2: score ALL new tenders against ALL company profiles and persist matches
    const scoredMatches = await scoreNewTenders(newTenderIds);

    if (scoredMatches.length === 0) {
      logger.info("No scored matches produced — skipping notification dispatch");
      return result;
    }

    // Step 3: load preferences and dispatch per business
    const prefs = await db.select().from(notificationPreferencesTable);

    for (const pref of prefs) {
      const shouldNotifyInApp = pref.inAppEnabled;
      const shouldNotifyEmail = pref.emailEnabled && !!pref.emailAddress;

      if (!shouldNotifyInApp && !shouldNotifyEmail) continue;

      // Filter scored matches for this business
      const businessMatches = scoredMatches.filter((m) => {
        if (m.businessId !== pref.businessId) return false;
        if (m.fitScore < pref.minFitScore) return false;
        if (pref.sources.length > 0 && !pref.sources.includes(m.sourceSystem)) return false;
        if (pref.categories.length > 0 && !pref.categories.includes(m.tenderType)) return false;
        return true;
      });

      if (businessMatches.length === 0) continue;

      const topMatches = businessMatches
        .sort((a, b) => b.fitScore - a.fitScore)
        .slice(0, 10);

      // Step 4a: create in-app notifications
      if (shouldNotifyInApp) {
        const notifications = topMatches.map((m) => ({
          businessId: pref.businessId,
          matchId: m.matchId,
          title: `Yeni Eşleşme: ${m.tenderTitle.slice(0, 80)}`,
          body: `${m.agencyName} — %${m.fitScore} uyum skoru`,
          fitScore: m.fitScore,
          tenderTitle: m.tenderTitle,
          tenderId: m.tenderId,
        }));

        await db.insert(notificationsTable).values(notifications);
        result.notificationsCreated += notifications.length;
      }

      // Step 4b: send email (independent of in-app)
      if (shouldNotifyEmail) {
        const emailHtml = buildMatchEmailHtml(
          topMatches.map((m) => ({
            title: m.tenderTitle,
            fitScore: m.fitScore,
            agencyName: m.agencyName,
            sourceUrl: m.sourceUrl,
          }))
        );
        const sent = await sendEmail({
          to: pref.emailAddress!,
          subject: `İhaleZeka: ${topMatches.length} yeni eşleşen ihale bulundu`,
          html: emailHtml,
        });
        if (sent) result.emailsSent++;
      }
    }
  } catch (err) {
    logger.error({ err }, "Error in scoreAndNotify");
  }

  logger.info(result, "Notification dispatch complete");
  return result;
}

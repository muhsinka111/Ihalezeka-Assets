import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import tendersRouter from "./tenders";
import matchesRouter from "./matches";
import pipelineRouter from "./pipeline";
import companyProfileRouter from "./companyProfile";
import documentsRouter from "./documents";
import proposalsRouter from "./proposals";
import competitorsRouter from "./competitors";
import moneyFlowRouter from "./moneyFlow";
import reportsRouter from "./reports";
import apiKeysRouter from "./apiKeys";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(tendersRouter);
router.use(matchesRouter);
router.use(pipelineRouter);
router.use(companyProfileRouter);
router.use(documentsRouter);
router.use(proposalsRouter);
router.use(competitorsRouter);
router.use(moneyFlowRouter);
router.use(reportsRouter);
router.use(apiKeysRouter);

export default router;

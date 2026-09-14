import { Router, type IRouter } from "express";
import healthRouter from "./health";
import vybeRouter from "./vybe";
import adminRouter from "./admin";
import premiumRouter from "./premium";
import billingAdminRouter from "./billingAdmin";
import socialRouter from "./social";
import messagesRouter from "./messages";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminRouter);
router.use(premiumRouter);
router.use(billingAdminRouter);
router.use(vybeRouter);
router.use(socialRouter);
router.use(messagesRouter);
router.use(storageRouter);

export default router;

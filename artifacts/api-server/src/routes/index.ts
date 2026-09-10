import { Router, type IRouter } from "express";
import healthRouter from "./health";
import vybeRouter from "./vybe";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminRouter);
router.use(vybeRouter);

export default router;

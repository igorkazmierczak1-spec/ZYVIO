import { Router, type IRouter } from "express";
import healthRouter from "./health";
import vybeRouter from "./vybe";

const router: IRouter = Router();

router.use(healthRouter);
router.use(vybeRouter);

export default router;

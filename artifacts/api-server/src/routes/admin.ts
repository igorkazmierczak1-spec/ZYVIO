import { Router, type IRouter } from "express";
import { currentUserFrom, requireAdmin, requireAuthenticatedUser } from "../middlewares/auth";

const router: IRouter = Router();

router.use(requireAuthenticatedUser, requireAdmin);

router.get("/", (_req, res) => {
  const user = currentUserFrom(res);
  res.json({
    authenticated: true,
    role: user.role,
    userId: user.id,
  });
});

export default router;
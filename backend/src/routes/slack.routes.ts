import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  handleSlackCallback,
  handleSlackConnect,
  handleSlackDisconnect,
  handleSlackStatus,
} from '../modules/slack/slack.controller';

const router = Router();

router.use(requireAuth);

router.get('/connect', handleSlackConnect);
router.get('/callback', handleSlackCallback);
router.get('/status', handleSlackStatus);
router.post('/disconnect', handleSlackDisconnect);

export default router;
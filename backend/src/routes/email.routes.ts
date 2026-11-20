import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { scheduleEmailsSchema } from '../modules/emails/email.schema';
import {
  handleCancelEmail,
  handleGetEmailById,
  handleGetScheduledEmails,
  handleGetSentEmails,
  handleScheduleEmails,
} from '../modules/emails/email.controller';

const router = Router();

router.use(requireAuth);

router.post('/schedule', validateBody(scheduleEmailsSchema), handleScheduleEmails);
router.get('/scheduled', handleGetScheduledEmails);
router.get('/sent', handleGetSentEmails);
router.get('/:id', handleGetEmailById);
router.post('/:id/cancel', handleCancelEmail);

export default router;
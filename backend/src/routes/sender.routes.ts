import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { createSenderSchema, updateSenderSchema } from '../modules/senders/sender.schema';
import {
  handleCreateSender,
  handleDeleteSender,
  handleListSenders,
  handleUpdateSender,
} from '../modules/senders/sender.controller';

const router = Router();

router.use(requireAuth);

router.post('/', validateBody(createSenderSchema), handleCreateSender);
router.get('/', handleListSenders);
router.patch('/:id', validateBody(updateSenderSchema), handleUpdateSender);
router.delete('/:id', handleDeleteSender);

export default router;
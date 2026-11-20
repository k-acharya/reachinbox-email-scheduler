import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { handleSearchEmails } from '../modules/search/search.controller';

const router = Router();

router.get('/search', requireAuth, handleSearchEmails);

export default router;
import { Router } from 'express';
import {
  getCurrentUser,
  googleAuthCallback,
  initiateGoogleLogin,
  logoutUser,
} from '../modules/auth/auth.controller';

const router = Router();

router.get('/google', initiateGoogleLogin);
router.get('/google/callback', googleAuthCallback);
router.get('/me', getCurrentUser);
router.post('/logout', logoutUser);

export default router;
import type { Response } from 'express';
import { HttpError } from '../errors/HttpError.js';
import { getAuth } from '../middleware/requireAuth.js';
import { UserModel, type UserDocument } from '../models/user.model.js';

/** Loads the authenticated user (from the verified access token only). */
export async function loadUser(res: Response): Promise<UserDocument> {
  const user = await UserModel.findById(getAuth(res).userId);
  if (!user) throw HttpError.unauthorized('המשתמש לא נמצא');
  return user;
}

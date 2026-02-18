import * as newsletterService from '../../services/newsletter';
import { NewsletterSubscribeSchema } from '../../schemas/api-input';

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, NewsletterSubscribeSchema.parse);

  await newsletterService.subscribe({ email: body.email }, event);

  return { ok: true };
});

import { listDraftChoices } from '../../services/quotes';

/** The request drafts the add-to-quote menu offers. */
export default defineEventHandler(async (event) => {
  await requireAuth(event);

  setHeader(event, 'Cache-Control', 'private, no-cache');

  return { drafts: await listDraftChoices(event) };
});

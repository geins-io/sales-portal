import type { H3Event } from 'h3';
import type { SavedList } from '#shared/types/saved-list';
import type {
  CreateSavedListInput,
  UpdateSavedListInput,
} from '../schemas/api-input';
import {
  getListsStub,
  getListStub,
  createListStub,
  updateListStub,
  deleteListStub,
} from './stubs/saved-lists';

/** TODO: Replace stub with Geins API -- GET /lists?userId={userId} */
export async function getLists(
  userId: string,
  _event: H3Event,
): Promise<SavedList[]> {
  return getListsStub(userId);
}

/** TODO: Replace stub with Geins API -- GET /lists/{id} */
export async function getList(
  listId: string,
  userId: string,
  _event: H3Event,
): Promise<SavedList> {
  return getListStub(listId, userId);
}

/** TODO: Replace stub with Geins API -- POST /lists */
export async function createList(
  userId: string,
  data: CreateSavedListInput,
  _event: H3Event,
): Promise<SavedList> {
  return createListStub(userId, data);
}

/** TODO: Replace stub with Geins API -- PUT /lists/{id} */
export async function updateList(
  listId: string,
  userId: string,
  data: UpdateSavedListInput,
  _event: H3Event,
): Promise<SavedList> {
  return updateListStub(listId, userId, data);
}

/** TODO: Replace stub with Geins API -- DELETE /lists/{id} */
export async function deleteList(
  listId: string,
  userId: string,
  _event: H3Event,
): Promise<void> {
  deleteListStub(listId, userId);
}

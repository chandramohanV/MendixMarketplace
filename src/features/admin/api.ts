// Typed client for the components API (/api/components). Reads need a session; writes need an admin.
import { ComponentListSchema, ComponentSchema, type ComponentInput } from '../../../shared/components';
import { createApiRequest, toJsonBody } from '../../lib/api';
import type { Component } from '../../types';

const request = createApiRequest('/api/components', 'components API');
const enc = encodeURIComponent;

export const listComponents = async (signal?: AbortSignal): Promise<Component[]> =>
  (await request('', ComponentListSchema, { signal })).items;
export const createComponent = (input: ComponentInput): Promise<Component> =>
  request('', ComponentSchema, { method: 'POST', body: toJsonBody(input) });
export const updateComponent = (slug: string, input: ComponentInput): Promise<Component> =>
  request(`/${enc(slug)}`, ComponentSchema, { method: 'PUT', body: toJsonBody(input) });
export async function deleteComponent(slug: string): Promise<void> {
  await request(`/${enc(slug)}`, null, { method: 'DELETE' });
}

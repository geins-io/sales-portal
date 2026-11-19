/**
 * Every GraphQL document the server sends, validated against the live
 * Merchant API schema. Unit tests mock the services and the SDK's schema copy
 * lags prod, so a field prod lacks would otherwise reach a 400 that every
 * caller swallows.
 *
 * Network-bound, so not part of `pnpm test`: `pnpm test:schema` runs it.
 */
import {
  buildClientSchema,
  getIntrospectionQuery,
  parse,
  validate,
  type GraphQLSchema,
  type IntrospectionQuery,
} from 'graphql';
import { beforeAll, describe, expect, it } from 'vitest';
import graphqlFiles from '#graphql-queries';
import { loadQuery } from '../../server/services/graphql/loader';
import { buildStoredAliasLookup } from '../../server/services/products';
import { lookupHostname } from '../../server/utils/lookup-hostname';
import { targetHostname } from '../e2e/target-defaults.mjs';

const STORE_SETTINGS_URL = 'https://merchantapi.geins.io/store-settings';
const GRAPHQL_URL = 'https://merchantapi.geins.io/graphql';
const TIMEOUT_MS = 15_000;

/** Reads only, so one retry on a transport error or a 5xx is safe. */
async function fetchJson(
  step: string,
  url: string,
  init?: RequestInit,
): Promise<unknown> {
  let last = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.ok) return await response.json();
      last = `HTTP ${response.status}`;
      if (response.status < 500) break;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(
    `${step} failed (${last}); the documents were not checked, which says nothing about them`,
  );
}

async function fetchSchema(): Promise<GraphQLSchema> {
  const hostname = lookupHostname(targetHostname());
  const settings = (await fetchJson(
    'store-settings',
    `${STORE_SETTINGS_URL}?hostname=${hostname}`,
  )) as { apiKey?: string };
  if (!settings.apiKey) {
    throw new Error(`store-settings for ${hostname} carries no apiKey`);
  }
  const result = (await fetchJson('introspection', GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-apikey': settings.apiKey,
    },
    body: JSON.stringify({ query: getIntrospectionQuery() }),
  })) as { data?: IntrospectionQuery; errors?: { message: string }[] };
  if (!result.data?.__schema) {
    throw new Error(
      `introspection returned no schema: ${result.errors?.map((e) => e.message).join('; ') ?? 'no errors either'}`,
    );
  }
  return buildClientSchema(result.data);
}

function errorsIn(schema: GraphQLSchema, document: string): string[] {
  return validate(schema, parse(document)).map((e) => e.message);
}

const operationFiles = Object.keys(graphqlFiles)
  .filter((key) => !key.startsWith('./fragments/'))
  .map((key) => key.slice('./'.length))
  .sort();

describe('GraphQL documents against the live Merchant API schema', () => {
  let schema: GraphQLSchema;

  beforeAll(
    async () => {
      schema = await fetchSchema();
    },
    2 * 2 * TIMEOUT_MS,
  );

  it('finds the documents', () => {
    expect(operationFiles.length).toBeGreaterThan(0);
  });

  // Through loadQuery, so each document carries exactly the fragments the
  // server appends at runtime, resolved the same way.
  it.each(operationFiles)('%s', (file) => {
    expect(errorsIn(schema, loadQuery(file))).toEqual([]);
  });

  it('the stored-alias lookup built at runtime', () => {
    const { query } = buildStoredAliasLookup(['a', 'b'], ['sv-SE', 'en-US'], {
      channelId: '1|se',
      marketId: 'se',
    });
    expect(errorsIn(schema, query)).toEqual([]);
  });
});

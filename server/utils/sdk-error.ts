import type { GeinsErrorCode } from '@geins/core';

const MAX_MESSAGE_LENGTH = 300;
const MAX_GRAPHQL_ERRORS = 5;

// Codes that would describe the request rather than the upstream. In
// @geins/* 0.10.4 none of them reaches a call site: CART_NOT_FOUND is rewrapped
// as CART_OPERATION_FAILED, and the AUTH_* codes are not thrown on the paths the
// server uses. Every other code, including the per-operation wrappers
// (CHECKOUT_FAILED, CART_ITEM_NOT_FOUND, ...), is also thrown for network
// failures and Geins outages. Type-only, so modules that mock the SDK can still
// import the error utils.
const CLIENT_FAULT_CODES: ReadonlySet<unknown> = new Set<`${GeinsErrorCode}`>([
  'CART_NOT_FOUND',
  'AUTH_TOKEN_EXPIRED',
  'AUTH_NOT_AUTHENTICATED',
]);

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function textField(value: object, key: string): string | undefined {
  const field: unknown = Reflect.get(value, key);
  return typeof field === 'string'
    ? field.slice(0, MAX_MESSAGE_LENGTH)
    : undefined;
}

function describeGraphQLError(value: unknown): Record<string, unknown> {
  if (!isObject(value)) return {};
  const extensions: unknown = Reflect.get(value, 'extensions');
  const path: unknown = Reflect.get(value, 'path');
  return {
    message: textField(value, 'message'),
    code: isObject(extensions) ? textField(extensions, 'code') : undefined,
    path: Array.isArray(path) ? path.join('.') : undefined,
  };
}

function describeGraphQLErrors(errors: unknown[]): Record<string, unknown>[] {
  return errors.slice(0, MAX_GRAPHQL_ERRORS).map(describeGraphQLError);
}

function summarise(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    return { graphQLErrors: describeGraphQLErrors(value) };
  }
  if (!isObject(value)) {
    return { message: String(value).slice(0, MAX_MESSAGE_LENGTH) };
  }
  const networkError: unknown = Reflect.get(value, 'networkError');
  const graphQLErrors: unknown = Reflect.get(value, 'graphQLErrors');
  return {
    name: textField(value, 'name'),
    code: textField(value, 'code'),
    message: textField(value, 'message'),
    requestId: textField(value, 'requestId'),
    networkError: isObject(networkError)
      ? {
          name: textField(networkError, 'name'),
          message: textField(networkError, 'message'),
          statusCode: Reflect.get(networkError, 'statusCode'),
        }
      : undefined,
    graphQLErrors: Array.isArray(graphQLErrors)
      ? describeGraphQLErrors(graphQLErrors)
      : undefined,
  };
}

/**
 * A bounded, log-safe summary of a failed SDK call: the SDK error's name, code
 * and request id, and one level of its cause (the Apollo error with its network
 * status or GraphQL errors). Carries no variables or headers.
 */
export function describeSdkError(error: unknown): Record<string, unknown> {
  const summary = summarise(error);
  const cause: unknown = isObject(error)
    ? Reflect.get(error, 'cause')
    : undefined;
  return cause == null ? summary : { ...summary, cause: summarise(cause) };
}

/**
 * True when the SDK error shows the request was at fault. Read from `code`,
 * because the SDK's ES5 build breaks `instanceof` on its error classes.
 */
export function isSdkClientFault(error: unknown): boolean {
  return isObject(error) && CLIENT_FAULT_CODES.has(Reflect.get(error, 'code'));
}

function carriesLoginRequired(value: unknown): boolean {
  if (!isObject(value)) return false;
  const graphQLErrors: unknown = Reflect.get(value, 'graphQLErrors');
  return (
    Array.isArray(graphQLErrors) &&
    graphQLErrors.some((graphQLError: unknown) => {
      if (!isObject(graphQLError)) return false;
      const extensions: unknown = Reflect.get(graphQLError, 'extensions');
      return (
        isObject(extensions) &&
        Reflect.get(extensions, 'code') === 'LoginRequired'
      );
    })
  );
}

/**
 * True when Geins refused a cart until the buyer signs in: a cart holding a
 * configured line answers `LoginRequired` to a request without a user token.
 * A write throws the GraphQL error as it is; the read rewraps it as `cause`.
 */
export function isSdkLoginRequired(error: unknown): boolean {
  return (
    carriesLoginRequired(error) ||
    (isObject(error) && carriesLoginRequired(Reflect.get(error, 'cause')))
  );
}

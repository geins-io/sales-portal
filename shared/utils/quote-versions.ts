/** What a version of a quotation is called for the buyer. */
export type QuoteVersionName =
  | { kind: 'request' }
  /** An offer goes by the number the store shows; `''` when it has none. */
  | { kind: 'offer'; number: string };

/**
 * Names each version as the quotation lists them: the buyer's request, which
 * has no `validFrom`, as the request, every other version by its number.
 */
export function versionNames(
  versions:
    | readonly {
        quotationId: string;
        quoteNumber: string;
        validFrom?: string | null;
      }[]
    | null
    | undefined,
): Map<string, QuoteVersionName> {
  return new Map(
    (versions ?? []).map((v) => [
      v.quotationId,
      v.validFrom
        ? { kind: 'offer', number: v.quoteNumber }
        : { kind: 'request' },
    ]),
  );
}

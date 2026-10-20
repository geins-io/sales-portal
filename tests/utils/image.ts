/**
 * The shape each `srcset` candidate asks the CDN for: requested width over
 * height (NaN without a height), and the `fit` it names.
 */
export function requestedShapes(
  srcset: string | undefined,
): { ratio: number; fit: string | null }[] {
  return (srcset ?? '')
    .split(', ')
    .filter(Boolean)
    .map((candidate) => {
      const url = new URL(candidate.split(' ')[0]!);
      return {
        ratio:
          Number(url.searchParams.get('width')) /
          Number(url.searchParams.get('height') ?? Number.NaN),
        fit: url.searchParams.get('fit'),
      };
    });
}

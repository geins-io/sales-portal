import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
} from '@playwright/test/reporter';

/**
 * Declared-scope reporter.
 *
 * Playwright's own summary folds three different situations into "skipped":
 *
 * - **out of scope** — declared by the test through `outOfScope()` (a `skip`
 *   annotation whose description starts with a ScopeReason) or
 *   `noteOutOfScope()` (a `scope` annotation) in tests/e2e/helpers.ts;
 * - **blocked** — a project the test depends on (`setup`, later the
 *   preflight) had failures, so Playwright never ran the test. It reports
 *   nothing for it: no `onTestEnd`, no annotation, an empty `results` array.
 *   The list reporter calls these "did not run";
 * - **unknown** — skipped with no declaration. The suite does not know why
 *   this test did not run, so the run fails.
 *
 * Prints one summary block at the end and returns `failed` when anything is
 * unknown. Tests with no results whose dependencies all passed (a filtered run
 * with `--grep` or `test.only`) are neither blocked nor unknown and stay
 * silent.
 */

// Mirrors ScopeReason in tests/e2e/helpers.ts. The reporter is loaded by
// Playwright before the specs, so it keeps its own copy of the list.
const SCOPE_REASONS = [
  'no-credentials',
  'mobile-project',
  'dev-server',
  'fixture-missing',
  'tenant-config',
] as const;
const DECLARED = new RegExp(`^(${SCOPE_REASONS.join('|')}): `);
const SCOPE_NOTE_ANNOTATION = 'scope';

interface ScopedTest {
  reason: string;
  detail: string;
  title: string;
}

class ScopeReporter implements Reporter {
  private suite!: Suite;

  onBegin(_config: FullConfig, suite: Suite): void {
    this.suite = suite;
  }

  onEnd(result: FullResult): { status?: FullResult['status'] } | undefined {
    const failedProjects = new Set<string>();
    for (const test of this.suite.allTests()) {
      if (
        test.results.some(
          (r) => r.status === 'failed' || r.status === 'timedOut',
        )
      ) {
        failedProjects.add(test.parent.project()?.name ?? '');
      }
    }

    const outOfScope: ScopedTest[] = [];
    const partial: ScopedTest[] = [];
    const blocked = new Map<string, number>();
    const unknown: string[] = [];

    for (const test of this.suite.allTests()) {
      // `outOfScope()` becomes a `skip` annotation with a reason prefix;
      // `noteOutOfScope()` a `scope` annotation. Anything else skipped is unknown.
      const scope = test.annotations.find(
        (a) =>
          a.type === SCOPE_NOTE_ANNOTATION ||
          (a.type === 'skip' && DECLARED.test(a.description ?? '')),
      );
      const label = `[${test.parent.project()?.name}] ${test.titlePath().slice(2).join(' › ')}`;

      if (test.results.length === 0) {
        const failedDependency = (
          test.parent.project()?.dependencies ?? []
        ).find((dep) => failedProjects.has(dep));
        if (failedDependency) {
          blocked.set(
            failedDependency,
            (blocked.get(failedDependency) ?? 0) + 1,
          );
        }
        continue;
      }

      const skipped = test.outcome() === 'skipped';
      if (scope) {
        const [reason = '', ...rest] = (scope.description ?? '').split(': ');
        const entry = { reason, detail: rest.join(': '), title: label };
        (skipped ? outOfScope : partial).push(entry);
      } else if (skipped) {
        unknown.push(label);
      }
    }

    const lines: string[] = ['', 'Declared scope'];

    if (outOfScope.length) {
      lines.push(`  out of scope: ${outOfScope.length}`);
      for (const [reason, entries] of groupBy(outOfScope)) {
        lines.push(`    ${reason} (${entries.length}) — ${entries[0]!.detail}`);
        if (reason === 'tenant-config' || reason === 'fixture-missing') {
          for (const e of entries) lines.push(`      ${e.title}`);
        }
      }
    }
    if (partial.length) {
      lines.push(`  ran with assertions off: ${partial.length}`);
      for (const [reason, entries] of groupBy(partial)) {
        lines.push(`    ${reason} (${entries.length}) — ${entries[0]!.detail}`);
      }
    }
    for (const [dependency, count] of blocked) {
      lines.push(
        `  blocked: ${count} — project "${dependency}" failed, dependents did not run`,
      );
    }
    if (unknown.length) {
      lines.push(
        `  unknown: ${unknown.length} — skipped without a declared reason (use outOfScope())`,
      );
      for (const title of unknown) lines.push(`    ${title}`);
    }
    if (
      outOfScope.length + partial.length + blocked.size + unknown.length ===
      0
    ) {
      lines.push('  everything in scope ran');
    }

    console.log(lines.join('\n'));

    if (unknown.length && result.status === 'passed') {
      console.log('\nRun failed: undeclared skips.');
      return { status: 'failed' };
    }
    return undefined;
  }

  printsToStdio(): boolean {
    return true;
  }
}

function groupBy(entries: ScopedTest[]): Map<string, ScopedTest[]> {
  const groups = new Map<string, ScopedTest[]>();
  for (const e of entries) {
    const list = groups.get(e.reason) ?? [];
    list.push(e);
    groups.set(e.reason, list);
  }
  return groups;
}

export default ScopeReporter;

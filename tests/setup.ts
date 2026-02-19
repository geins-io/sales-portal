/**
 * Global Test Setup
 *
 * Console suppression only — keeps test output clean.
 * Tests that need to assert on console calls can use mockConsole() from tests/utils.
 */

import { vi } from 'vitest';

vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});
vi.spyOn(console, 'debug').mockImplementation(() => {});

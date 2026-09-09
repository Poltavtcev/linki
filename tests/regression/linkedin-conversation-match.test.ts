import { test, expect } from 'vitest';
import { resultNameMatches } from '../../lib/linkedin/message';

test('resultNameMatches - exact match', () => {
  expect(resultNameMatches('Mariia Solodar', 'Mariia Solodar')).toBe(true);
});

test('resultNameMatches - case insensitive', () => {
  expect(resultNameMatches('MARIIA SOLODAR', 'mariia solodar')).toBe(true);
});

test('resultNameMatches - substrings do not fail if target is a substring', () => {
  expect(resultNameMatches('Mariia Solodar', 'Mariia')).toBe(true);
});

test('resultNameMatches - returns false if target not found in result', () => {
  expect(resultNameMatches('Vasil Guruli', 'Mariia')).toBe(false);
});

test('resultNameMatches - accented characters normalized', () => {
  expect(resultNameMatches('José Silva', 'Jose Silva')).toBe(true);
});

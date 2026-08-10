"""Regression tests for repository validation path isolation."""

import pathlib
import tempfile
import unittest

from tools import check_indices
from tools.verify import Verifier


class ValidationIsolationTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory(prefix='all3-validation-paths-')
        self.root = pathlib.Path(self._tmp.name)
        (self.root / 'normal.md').write_text(
            '999 классов проверок\n', encoding='utf-8')
        nested = self.root / '.worktrees' / 'agent'
        nested.mkdir(parents=True)
        (nested / 'ignored.md').write_text(
            '999 классов проверок\n', encoding='utf-8')

    def tearDown(self):
        self._tmp.cleanup()

    def test_verifier_ignores_nested_worktrees(self):
        paths = [rel for rel, _ in Verifier(self.root).files('*.md')]
        self.assertEqual(paths, ['normal.md'])

    def test_index_audit_keeps_normal_paths_and_ignores_worktrees(self):
        findings = check_indices.run(self.root)
        paths = [rel for rel, _, _ in findings]
        self.assertIn('normal.md', paths)
        self.assertFalse(any(rel.startswith('.worktrees/') for rel in paths))


if __name__ == '__main__':
    unittest.main()

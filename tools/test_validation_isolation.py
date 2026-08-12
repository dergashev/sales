"""Regression tests for repository validation path isolation."""

import pathlib
import shutil
import subprocess
import tempfile
import unittest
from unittest import mock

from tools import check_indices
from tools import validation_paths
from tools.verify import Verifier


GIT = shutil.which('git')


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

    def git_root(self):
        tmp = tempfile.TemporaryDirectory(prefix='all3-validation-git-scope-')
        self.addCleanup(tmp.cleanup)
        root = pathlib.Path(tmp.name)
        subprocess.run(
            [GIT, 'init', '-q'], cwd=root, check=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        (root / 'normal.md').write_text('safe project content\n', encoding='utf-8')
        return root

    @staticmethod
    def write(root, relative, text):
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding='utf-8')
        return path

    @staticmethod
    def privacy_canary():
        # Keep the production-like address out of this repository's own
        # privacy corpus while writing it verbatim into temporary fixtures.
        return 'privacy-canary' + chr(64) + 'company.de\n'

    def test_verifier_ignores_nested_worktrees(self):
        paths = [rel for rel, _ in Verifier(self.root).files('*.md')]
        self.assertEqual(paths, ['normal.md'])

    def test_index_audit_keeps_normal_paths_and_ignores_worktrees(self):
        findings = check_indices.run(self.root)
        paths = [rel for rel, _, _ in findings]
        self.assertIn('normal.md', paths)
        self.assertFalse(any(rel.startswith('.worktrees/') for rel in paths))

    @unittest.skipUnless(GIT, 'git is required for candidate-scope tests')
    def test_ignored_untracked_agentsroom_transcript_is_out_of_scope(self):
        root = self.git_root()
        self.write(
            root, '.gitignore',
            '.agentsroom/handoff-transcript-*.txt\n.agentsroom/sessions/\n')
        transcript = self.write(
            root, '.agentsroom/handoff-transcript-agent-test.txt',
            self.privacy_canary())

        verifier = Verifier(root)
        paths = [relative for relative, _ in verifier.files('*.txt')]
        self.assertNotIn(transcript.relative_to(root).as_posix(), paths)

        verifier.check_privacy()
        self.assertEqual(verifier.new, [])

    @unittest.skipUnless(GIT, 'git is required for candidate-scope tests')
    def test_tracked_project_privacy_canary_is_detected(self):
        root = self.git_root()
        source = self.write(
            root, 'docs/privacy-canary.md', self.privacy_canary())
        subprocess.run(
            [GIT, 'add', source.relative_to(root).as_posix()], cwd=root,
            check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

        verifier = Verifier(root)
        verifier.check_privacy()

        self.assertTrue(any(
            cls == 'PRIVACY-001' and where.startswith('docs/privacy-canary.md:')
            for cls, where, _ in verifier.new
        ), verifier.new)

    @unittest.skipUnless(GIT, 'git is required for candidate-scope tests')
    def test_tracked_agentsroom_file_remains_in_scope(self):
        root = self.git_root()
        project_file = self.write(
            root, '.agentsroom/project.json', self.privacy_canary())
        subprocess.run(
            [GIT, 'add', project_file.relative_to(root).as_posix()], cwd=root,
            check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.write(root, '.gitignore', '.agentsroom/project.json\n')

        verifier = Verifier(root)
        paths = [relative for relative, _ in verifier.files('*.json')]
        self.assertIn('.agentsroom/project.json', paths)

        verifier.check_privacy()
        self.assertTrue(any(
            cls == 'PRIVACY-001'
            and where.startswith('.agentsroom/project.json:')
            for cls, where, _ in verifier.new
        ), verifier.new)

    @unittest.skipUnless(GIT, 'git is required for candidate-scope tests')
    def test_untracked_nonignored_source_remains_in_scope(self):
        root = self.git_root()
        source = self.write(root, 'src/new-source.ts', self.privacy_canary())

        verifier = Verifier(root)
        paths = [relative for relative, _ in verifier.files('*.ts')]
        self.assertIn(source.relative_to(root).as_posix(), paths)

        verifier.check_privacy()
        self.assertTrue(any(
            cls == 'PRIVACY-001' and where.startswith('src/new-source.ts:')
            for cls, where, _ in verifier.new
        ), verifier.new)

    @unittest.skipUnless(GIT, 'git is required for candidate-scope tests')
    def test_index_audit_ignores_ignored_untracked_runtime_markdown(self):
        root = self.git_root()
        self.write(root, '.gitignore', '.agentsroom/memory/\n')
        self.write(
            root, '.agentsroom/memory/runtime.md',
            '999 классов проверок\n')

        findings = check_indices.run(root)
        paths = [relative for relative, _, _ in findings]
        self.assertFalse(any(
            relative.startswith('.agentsroom/memory/') for relative in paths
        ), findings)

    @unittest.skipUnless(GIT, 'git is required for candidate-scope tests')
    def test_git_query_failure_uses_cached_conservative_fallback(self):
        root = self.git_root()
        self.write(root, '.gitignore', '.agentsroom/sessions/\n')
        runtime = self.write(
            root, '.agentsroom/sessions/runtime.txt', self.privacy_canary())

        with mock.patch.object(
                validation_paths, '_git_ignored_untracked_paths',
                side_effect=OSError('git unavailable')) as query:
            verifier = Verifier(root)
            with self.assertWarnsRegex(
                    RuntimeWarning, 'conservative filesystem scope'):
                txt_paths = [relative for relative, _ in verifier.files('*.txt')]
            verifier.files('*.md')

        self.assertIn(runtime.relative_to(root).as_posix(), txt_paths)
        query.assert_called_once_with(root)


if __name__ == '__main__':
    unittest.main()

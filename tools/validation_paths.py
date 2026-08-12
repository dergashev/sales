"""Repository path policy shared by validation file walkers."""

from __future__ import annotations

import pathlib
import subprocess
import warnings


# These directories are external to the checked product tree wherever they
# occur below the validation root. A worktree whose own root lives under a
# parent ``.worktrees`` directory remains fully scanned because paths are
# evaluated relative to that root.
EXTERNAL_REPOSITORY_DIRS = frozenset({'.git', '.worktrees', 'node_modules'})

GIT_SCOPE_TIMEOUT_SECONDS = 5


class _GitScopeUnavailable(RuntimeError):
    """Git could not provide the ignored, untracked candidate paths."""


def _git_ignored_untracked_paths(root: pathlib.Path) -> frozenset[str]:
    """Return paths Git classifies as both ignored and untracked.

    ``--directory`` may return either file entries or collapsed directory
    entries. Callers therefore treat every entry as an exact path and as a
    possible directory prefix.
    """

    result = subprocess.run(
        [
            'git', '-C', str(root), 'ls-files', '--others', '--ignored',
            '--exclude-standard', '--directory', '-z',
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        timeout=GIT_SCOPE_TIMEOUT_SECONDS,
    )
    if result.returncode:
        detail = result.stderr.decode('utf-8', errors='replace').strip()
        if detail:
            detail = detail.splitlines()[0]
        else:
            detail = f'exit status {result.returncode}'
        raise _GitScopeUnavailable(detail)

    return frozenset(
        entry.decode('utf-8', errors='surrogateescape').rstrip('/')
        for entry in result.stdout.split(b'\0')
        if entry.rstrip(b'/')
    )


def is_external_repository_path(path: pathlib.Path, root: pathlib.Path) -> bool:
    """Return whether *path* is below an external directory inside *root*."""

    relative = pathlib.Path(path).relative_to(pathlib.Path(root))
    return any(part in EXTERNAL_REPOSITORY_DIRS for part in relative.parts)


class RepositoryValidationScope:
    """Cached inclusion policy for one repository-validation run."""

    def __init__(self, root: pathlib.Path):
        self.root = pathlib.Path(root)
        self._ignored_untracked = None

    def _load_ignored_untracked(self) -> frozenset[str]:
        if self._ignored_untracked is None:
            try:
                self._ignored_untracked = _git_ignored_untracked_paths(self.root)
            except (OSError, subprocess.SubprocessError,
                    _GitScopeUnavailable) as exc:
                # The lexical floor is strictly more inclusive. Falling back
                # can produce a visible finding, but can never make a broken
                # Git lookup turn a failing validation gate green.
                self._ignored_untracked = frozenset()
                if (self.root / '.git').exists():
                    warnings.warn(
                        'Git candidate scope unavailable; validation is using '
                        f'the conservative filesystem scope ({exc})',
                        RuntimeWarning,
                        stacklevel=3,
                    )
        return self._ignored_untracked

    def excludes(self, path: pathlib.Path) -> bool:
        """Return whether *path* is outside this validation candidate."""

        if is_external_repository_path(path, self.root):
            return True
        relative = pathlib.Path(path).relative_to(self.root).as_posix()
        return any(
            relative == ignored or relative.startswith(ignored + '/')
            for ignored in self._load_ignored_untracked()
        )

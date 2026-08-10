"""Repository path policy shared by validation file walkers."""

from __future__ import annotations

import pathlib


# These directories are external to the checked product tree wherever they
# occur below the validation root. A worktree whose own root lives under a
# parent ``.worktrees`` directory remains fully scanned because paths are
# evaluated relative to that root.
EXTERNAL_REPOSITORY_DIRS = frozenset({'.git', '.worktrees', 'node_modules'})


def is_external_repository_path(path: pathlib.Path, root: pathlib.Path) -> bool:
    """Return whether *path* is below an external directory inside *root*."""

    relative = pathlib.Path(path).relative_to(pathlib.Path(root))
    return any(part in EXTERNAL_REPOSITORY_DIRS for part in relative.parts)

#!/bin/sh
# Monotonic guard for the `argo_tagging` stage (incident REL-RECOVERY-02).
#
# `update_argo_tag` writes whatever $VERSION its own pipeline carries into the
# GitOps repository's values.yaml. Nothing compared that value against the tag
# already in the file, so re-running an OLD pipeline silently rewound
# production's desired state:
#
#   2026-09-05T09:05:54Z  commit 4ad8fff "ci(argo-tag) sales-configurator 1.0.52"
#   moved apps/sales-configurator/values.yaml from imageTag 1.0.57 to 1.0.52 —
#   five releases backwards, and older than the 1.0.53 that was actually
#   running. The job went green. Nothing warned anyone.
#
# This guard makes the write FORWARD-ONLY. A version that is not strictly newer
# than the tag already in the file is refused, the file is left byte-identical,
# and the caller commits nothing. An accidental re-run becomes a no-op instead
# of a production downgrade.
#
# A DELIBERATE rollback is still possible — it just has to be deliberate:
# run the job with ARGO_TAG_ALLOW_ROLLBACK=1.
#
# Comparison is numeric per dot-separated field, not lexicographic:
# 1.0.9 -> 1.0.10 is a forward move, which a string compare gets wrong.
#
# Usage: argo-tag-guard.sh <values-file> <image-backend> <new-version>
# Exit:  0  decision made (file updated, or deliberately left untouched)
#        1  usage or parse error — the caller MUST fail the pipeline

set -eu

VALUES_FILE=${1:?usage: argo-tag-guard.sh <values-file> <image-backend> <new-version>}
IMAGE_BACKEND=${2:?usage: argo-tag-guard.sh <values-file> <image-backend> <new-version>}
NEW=${3:?usage: argo-tag-guard.sh <values-file> <image-backend> <new-version>}

[ -f "$VALUES_FILE" ] || { echo "argo-tag-guard: ERROR: no such file: $VALUES_FILE" >&2; exit 1; }

# The chart keeps `imageTag:` on the line directly after `image:`, which is the
# same shape update_argo_tag has always relied on.
IMAGE_LINE=$(grep -n "image: ${IMAGE_BACKEND}$" "$VALUES_FILE" 2>/dev/null | head -1 | cut -d: -f1 || true)
[ -n "$IMAGE_LINE" ] || {
  echo "argo-tag-guard: ERROR: no 'image: ${IMAGE_BACKEND}' line in ${VALUES_FILE}" >&2; exit 1; }

TAG_LINE=$((IMAGE_LINE + 1))
CURRENT=$(sed -n "${TAG_LINE}s/^[[:space:]]*imageTag:[[:space:]]*//p" "$VALUES_FILE")
[ -n "$CURRENT" ] || {
  echo "argo-tag-guard: ERROR: line ${TAG_LINE} of ${VALUES_FILE} is not an 'imageTag:' line" >&2; exit 1; }

# awk, not sed -i: BSD sed needs an argument to -i and this must stay runnable
# on a developer's macOS as well as on the alpine CI image.
write_tag() {
  tmp="${VALUES_FILE}.argo-tag-guard.$$"
  awk -v ln="$TAG_LINE" -v new="$NEW" \
    'NR==ln { sub(/imageTag:.*/, "imageTag: " new) } 1' "$VALUES_FILE" > "$tmp"
  mv "$tmp" "$VALUES_FILE"
}

ORDER=$(awk -v a="$NEW" -v b="$CURRENT" 'BEGIN {
  na = split(a, A, "."); nb = split(b, B, ".")
  n  = (na > nb ? na : nb)
  for (i = 1; i <= n; i++) {
    x = (i <= na ? A[i] + 0 : 0); y = (i <= nb ? B[i] + 0 : 0)
    if (x > y) { print "newer"; exit }
    if (x < y) { print "older"; exit }
  }
  print "same"
}')

case "$ORDER" in
  newer)
    write_tag
    echo "argo-tag-guard: UPDATED ${CURRENT} -> ${NEW}"
    ;;
  same)
    echo "argo-tag-guard: NOOP: desired state is already ${NEW}"
    ;;
  older)
    if [ "${ARGO_TAG_ALLOW_ROLLBACK:-0}" = "1" ]; then
      write_tag
      echo "argo-tag-guard: ROLLBACK ${CURRENT} -> ${NEW} (ARGO_TAG_ALLOW_ROLLBACK=1)"
    else
      echo "argo-tag-guard: REFUSED: ${NEW} is older than the desired state ${CURRENT}." >&2
      echo "argo-tag-guard: values.yaml left untouched. This is almost always a re-run of an" >&2
      echo "argo-tag-guard: old pipeline. For a deliberate rollback set ARGO_TAG_ALLOW_ROLLBACK=1." >&2
    fi
    ;;
esac

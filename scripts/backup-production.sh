#!/usr/bin/env bash
#
# Phase 15 Gate 15H-C — production database backup (Layer 2, independent
# of Neon's own native recovery; see docs/10-IMPLEMENTATION-PLAN.md's
# Gate 15H section for the full accepted policy).
#
# Streams pg_dump directly into age public-key encryption — no plaintext
# dump ever touches disk. Never contains, prints, or logs the production
# connection string, the age private identity, or any kDrive credential.
# Upload to kDrive is manual (operator-performed); this script only
# creates and locally validates the encrypted artifact.
#
# Usage: scripts/backup-production.sh
# (run manually, once per day during an active campaign — never via a
# scheduler or CI/CD system; see the Gate 15H-C report for why)

set -euo pipefail

# Non-secret: this is a public age recipient, safe to commit.
AGE_RECIPIENT="age19yfn8l6mvpfykn0vvnzqpa46d4ztvnjqzz0r5seqt6je25xpevaq0f0rzy"

# Dedicated, non-repository, non-cloud-synced output directory.
OUTPUT_DIR="${MELODIA_BACKUP_DIR:-$HOME/melodia-wine-shop-backups}"

# Below this size, the encrypted artifact is almost certainly the product
# of a failed/empty dump rather than a real (even early-campaign, mostly
# empty) database — conservative, not a precise measurement of expected
# dump size.
MIN_ARTIFACT_BYTES=1024

timestamp="$(date -u +%Y-%m-%d_%H%M%S)Z"
artifact_path="${OUTPUT_DIR}/melodia-prod_${timestamp}.dump.age"

mkdir -p "$OUTPUT_DIR"

echo "Melodia Wine Shop — production backup"
echo "Output directory: $OUTPUT_DIR"
echo

read -r -s -p "Production direct/unpooled Neon connection URL: " PROD_DB_URL
echo
if [ -z "$PROD_DB_URL" ]; then
  echo "No connection URL supplied — aborting." >&2
  exit 1
fi

cleanup() {
  # Never leave a partial/incomplete artifact behind, and never hold the
  # credential in the environment longer than this process needs it.
  if [ -n "${PROD_DB_URL:-}" ]; then
    unset PROD_DB_URL
  fi
  if [ "${backup_succeeded:-0}" != "1" ] && [ -e "$artifact_path" ]; then
    rm -f "$artifact_path"
  fi
}
trap cleanup EXIT

backup_succeeded=0

echo "Running pg_dump | age ..."
if ! pg_dump --format=custom --no-owner --no-privileges "$PROD_DB_URL" \
    | age --recipient "$AGE_RECIPIENT" --output "$artifact_path"
then
  echo "Backup FAILED — pg_dump or age exited non-zero. No artifact retained." >&2
  exit 1
fi

# --- Daily validation (never requires the private identity) ---------

if [ ! -f "$artifact_path" ]; then
  echo "Backup FAILED — expected artifact is missing after the pipeline completed." >&2
  exit 1
fi

artifact_size="$(stat -c%s "$artifact_path" 2>/dev/null || stat -f%z "$artifact_path")"
if [ "$artifact_size" -le 0 ]; then
  echo "Backup FAILED — artifact exists but is empty." >&2
  exit 1
fi
if [ "$artifact_size" -lt "$MIN_ARTIFACT_BYTES" ]; then
  echo "Backup FAILED — artifact is only ${artifact_size} bytes, below the ${MIN_ARTIFACT_BYTES}-byte sanity threshold." >&2
  exit 1
fi

header_line="$(head -n 1 "$artifact_path")"
case "$header_line" in
  age-encryption.org/v*) ;;
  *)
    echo "Backup FAILED — artifact does not begin with the expected age file header." >&2
    exit 1
    ;;
esac

backup_succeeded=1

human_size="$(numfmt --to=iec-i --suffix=B "$artifact_size" 2>/dev/null || echo "${artifact_size} bytes")"

echo
echo "Backup created successfully."
echo "Artifact: $artifact_path"
echo "Size: $human_size"
echo
echo "Next step:"
echo "Upload this encrypted .age file manually to the private kDrive backup folder."
echo
echo "Do not delete the local copy until the kDrive upload has been confirmed."
echo "Restore validation has NOT yet been performed."
echo
echo "(This confirms: encrypted backup creation validated — NOT restore validated. That remains Gate 15H-D.)"

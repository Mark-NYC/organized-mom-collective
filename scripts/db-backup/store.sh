#!/usr/bin/env bash
# Private, S3-compatible storage for the encrypted backups (Cloudflare R2; any S3-compatible bucket works).
# Needs BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in the environment.
#
#   store.sh put <file> <key> | get <key> <file> | list | prune <keep>
source "$(dirname "$0")/common.sh"
: "${BACKUP_S3_ENDPOINT:?}" "${BACKUP_S3_BUCKET:?}"
export AWS_DEFAULT_REGION=auto AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
s3() { aws --endpoint-url "$BACKUP_S3_ENDPOINT" --only-show-errors "$@"; }
case "$1" in
  put)  s3 s3 cp "$2" "s3://$BACKUP_S3_BUCKET/$3" ;;
  get)  s3 s3 cp "s3://$BACKUP_S3_BUCKET/$2" "$3" ;;
  list) s3 s3api list-objects-v2 --bucket "$BACKUP_S3_BUCKET" --prefix backups/ --query 'Contents[].Key' --output text | tr '\t' '\n' | grep -v '^None$' || true ;;
  prune)
    # Keep the newest <keep> VERIFIED backups (never fewer than 7). Delete only folders older than the oldest one kept,
    # so a run of failures never deletes a good backup.
    keep=$2; (( keep >= 7 )) || keep=7
    keys=$("$0" list)
    verified=$(grep '/VERIFIED$' <<<"$keys" | cut -d/ -f2 | sort -r)
    count=$(grep -c . <<<"$verified" || true)
    if (( count <= keep )); then echo "retention: $count verified backups kept, nothing to delete"; exit 0; fi
    oldest_kept=$(sed -n "${keep}p" <<<"$verified")
    old=$(cut -d/ -f2 <<<"$keys" | sort -u | awk -v k="$oldest_kept" '$0 < k')
    for d in $old; do s3 s3 rm --recursive "s3://$BACKUP_S3_BUCKET/backups/$d/"; done
    echo "retention: kept the newest $keep verified backups; deleted $(grep -c . <<<"$old" || true) older folder(s)" ;;
esac

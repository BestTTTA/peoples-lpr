#!/bin/sh
# Forced command for the GitHub Actions deploy key. Installed outside the checkout
# (~/bin/peoples-lpr-deploy) so a deploy never rewrites the script it is running,
# and referenced from ~/.ssh/authorized_keys as:
#
#   restrict,command="/home/sparkle/bin/peoples-lpr-deploy" ssh-ed25519 AAAA... peoples-lpr-ci
#
# The key can then only run: deploy <commit sha>.
set -euf
set -- ${SSH_ORIGINAL_COMMAND:-}
if [ "$#" -ne 2 ] || [ "$1" != deploy ]; then
  echo "usage: deploy <sha>" >&2
  exit 2
fi
case "$2" in
  *[!0-9a-f]* | "") echo "deploy: not a commit sha" >&2; exit 2 ;;
esac
cd "$HOME/Project/peoples-lpr"
git fetch -q --prune origin
git checkout -q --detach "$2"
exec ./docker/deploy.sh "$(echo "$2" | cut -c1-7)"

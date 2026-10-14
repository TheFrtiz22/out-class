#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
name=outclass-workspace-connector-test
image=public.ecr.aws/supabase/postgres:17.11.0.002
if docker inspect "$name" >/dev/null 2>&1; then
 echo 'Dedicated container name already exists; refusing to replace it.' >&2
 exit 1
fi
trap 'docker container rm --force "$name" >/dev/null 2>&1 || true' EXIT HUP INT TERM
docker run -d --name "$name" --label outclass.workspace-connector-test=disposable -p 127.0.0.1:58442:5432 --entrypoint bash "$image" -ec '
mkdir /tmp/decisiondb; chown postgres:postgres /tmp/decisiondb
su postgres -s /bin/bash -c "/nix/var/nix/profiles/default/bin/initdb -D /tmp/decisiondb -U fixture_superuser --auth=trust >/dev/null"
printf "host all all 0.0.0.0/0 trust\n" >> /tmp/decisiondb/pg_hba.conf
exec su postgres -s /bin/bash -c "/nix/var/nix/profiles/default/bin/postgres -D /tmp/decisiondb -c listen_addresses=\"*\""
' >/dev/null
tries=0
until docker exec "$name" /nix/var/nix/profiles/default/bin/pg_isready -U fixture_superuser >/dev/null 2>&1; do
 tries=$((tries+1)); [ "$tries" -lt 30 ] || exit 1; sleep 1
done
"${OUTCLASS_PACKAGE_TEST_PYTHON:-python3}" -B scripts/test-workspace-migration-package.py "${1:?Supply the generated package directory}"


set -euo pipefail

unset PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD PGSSLMODE DATABASE_URL

POOLER_HOST="aws-1-ap-southeast-1.pooler.supabase.com"
DBNAME="postgres"
SSL="sslmode=require"
DEFAULT_REF="zbechbzfvkvcvknmpomk"

x_on(){ [[ "${DEBUG:-}" == "1" ]] && set -x || true; }
x_off(){ [[ "${DEBUG:-}" == "1" ]] && set +x || true; }

triage() {
  echo ""
  echo "TRIAGE:"
  echo "1) DNS:"
  echo "   nslookup ${POOLER_HOST}"
  echo "2) Owner connect test (password will be prompted if not set):"
  echo "   psql \"postgresql://postgres.${SUPA_REF}@${POOLER_HOST}:5432/${DBNAME}?${SSL}\" -c \"select now(), current_user;\""
  echo "3) Roles check:"
  echo "   psql \"postgresql://postgres.${SUPA_REF}@${POOLER_HOST}:5432/${DBNAME}?${SSL}\" -c \"\\du\""
  echo "4) Pooler username format must be <role>.<project-ref>"
  echo ""
}

DNS_OUTPUT="$(nslookup "${POOLER_HOST}" 2>/dev/null || true)"
if ! echo "${DNS_OUTPUT}" | grep -q "Address:"; then
  echo "DNS fail for ${POOLER_HOST}"
  triage
  exit 1
fi

read -r -p "Supabase project ref [${DEFAULT_REF}]: " SUPA_REF_INPUT
SUPA_REF="${SUPA_REF_INPUT:-${DEFAULT_REF}}"

OWNER_USER="postgres.${SUPA_REF}"
INGEST_USER_POOLER="zoho_ingest.${SUPA_REF}"

# URLs WITHOUT passwords (passwords only via env so they never appear in logs)
OWNER_URL="postgresql://${OWNER_USER}@${POOLER_HOST}:5432/${DBNAME}?${SSL}"
INGEST_URL="postgresql://${INGEST_USER_POOLER}@${POOLER_HOST}:5432/${DBNAME}?${SSL}"

x_off
read -r -s -p "Owner password (${OWNER_USER}): " OWNER_PW
printf "\n"
x_on

echo "Testing owner connection..."
x_off
if ! PGPASSWORD="${OWNER_PW}" psql "${OWNER_URL}" -v ON_ERROR_STOP=1 -c "select now(), current_user, current_database();" ; then
  echo "Owner connection failed."
  triage
  exit 1
fi
x_on
echo "Owner connection OK."

echo "Running migrations..."
x_off
PGPASSWORD="${OWNER_PW}" psql "${OWNER_URL}" -v ON_ERROR_STOP=1 -f migrations/001_init.sql
PGPASSWORD="${OWNER_PW}" psql "${OWNER_URL}" -v ON_ERROR_STOP=1 -f migrations/002_roles.sql
x_on

x_off
read -r -s -p "Set NEW password for zoho_ingest (will be used later): " INGEST_PW
printf "\n"
read -r -s -p "Re-enter zoho_ingest password: " INGEST_PW_CONFIRM
printf "\n"
x_on

if [[ "${INGEST_PW}" != "${INGEST_PW_CONFIRM}" ]]; then
  echo "Passwords do not match. Aborting."
  exit 1
fi

echo "Setting zoho_ingest role password..."
# Safe psql variable substitution (server never sees the literal :pw token)
x_off
if ! PGPASSWORD="${OWNER_PW}" psql "${OWNER_URL}" -v ON_ERROR_STOP=1 -v pw="${INGEST_PW}" -c "ALTER ROLE zoho_ingest PASSWORD :'pw';" ; then
  echo "Failed to set zoho_ingest password."
  triage
  exit 1
fi
x_on
echo "zoho_ingest password set."

echo "Testing zoho_ingest connection..."
x_off
if ! PGPASSWORD="${INGEST_PW}" psql "${INGEST_URL}" -v ON_ERROR_STOP=1 -c "select now(), current_user, current_database();" ; then
  echo "zoho_ingest connection failed."
  triage
  exit 1
fi
x_on
echo "zoho_ingest connection OK."

read -r -p "Path to invoices.jsonl (optional, press Enter to skip): " INVOICES_PATH
if [[ -n "${INVOICES_PATH}" ]]; then
  if [[ ! -f "${INVOICES_PATH}" ]]; then
    echo "File not found: ${INVOICES_PATH}"
    exit 1
  fi

  export PGHOST="${POOLER_HOST}"
  export PGPORT="5432"
  export PGDATABASE="${DBNAME}"
  export PGSSLMODE="require"
  export PGUSER="${INGEST_USER_POOLER}"
  export PGPASSWORD="${INGEST_PW}"

  echo "Loading raw invoices..."
  python scripts/load_raw_invoices.py --src "${INVOICES_PATH}"
  echo "Transforming invoices..."
  python scripts/transform_invoices.py

  echo "Verification:"
  psql "${INGEST_URL}" -v ON_ERROR_STOP=1 -c "select count(*) from invoice_raw;"
  psql "${INGEST_URL}" -v ON_ERROR_STOP=1 -c "select count(*) from invoices;"
  psql "${INGEST_URL}" -v ON_ERROR_STOP=1 -c "select invoice_id,count(*) from invoices group by invoice_id having count(*)>1;"
fi

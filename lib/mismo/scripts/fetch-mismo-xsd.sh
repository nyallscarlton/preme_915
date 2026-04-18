#!/usr/bin/env bash
#
# Fetch MISMO 3.4 XSDs into lib/mismo/validators/schema/.
#
# MISMO licenses the reference-model schemas for use but prohibits
# redistribution — do NOT commit the resulting XSD files. The .gitignore
# in lib/mismo/validators/schema/ excludes them.
#
# Primary source: Fannie Mae Developer Center "DU Specification" ZIP contains
# the MISMO 3.4 B324 XSDs used by the DU submission endpoint. Download is free
# after registration. Alternative: direct download from MISMO.org after
# license acceptance.
#
# Usage:
#   ./lib/mismo/scripts/fetch-mismo-xsd.sh
#
# Env vars:
#   MISMO_XSD_URL        — direct URL to a ZIP containing MISMO_3.4.0_B324.xsd
#                          (set after you have a DU Spec download link)
#   MISMO_XSD_SOURCE_DIR — alternative: path to a local directory that
#                          already contains the XSDs, will be copied in
#
set -euo pipefail

DEST="$(cd "$(dirname "$0")/.." && pwd)/validators/schema"
mkdir -p "$DEST"

if [[ -n "${MISMO_XSD_SOURCE_DIR:-}" ]]; then
  if [[ ! -d "$MISMO_XSD_SOURCE_DIR" ]]; then
    echo "ERROR: MISMO_XSD_SOURCE_DIR=$MISMO_XSD_SOURCE_DIR does not exist" >&2
    exit 1
  fi
  cp -R "$MISMO_XSD_SOURCE_DIR"/*.xsd "$DEST/"
  echo "Copied XSDs from $MISMO_XSD_SOURCE_DIR → $DEST"
  exit 0
fi

if [[ -z "${MISMO_XSD_URL:-}" ]]; then
  cat <<EOF >&2
ERROR: no MISMO_XSD_URL set and no MISMO_XSD_SOURCE_DIR provided.

Next step:
  1. Register at https://developer.fanniemae.com (free) and download the
     latest "Desktop Underwriter Specification" ZIP — it contains the
     MISMO_3.4.0_B324 XSD bundle.
  2. Either:
       export MISMO_XSD_SOURCE_DIR=/path/to/unzipped/schemas
       ./lib/mismo/scripts/fetch-mismo-xsd.sh
     — or —
       export MISMO_XSD_URL='<signed URL from Fannie>'
       ./lib/mismo/scripts/fetch-mismo-xsd.sh
  3. Verify with:
       ls lib/mismo/validators/schema/MISMO_3.4.0_B324.xsd
EOF
  exit 1
fi

TMP="$(mktemp -d)"
trap "rm -rf $TMP" EXIT

echo "Downloading MISMO XSD bundle..."
curl -fsSL -o "$TMP/schema.zip" "$MISMO_XSD_URL"

echo "Extracting..."
unzip -q "$TMP/schema.zip" -d "$TMP/unzipped"
find "$TMP/unzipped" -name '*.xsd' -exec cp {} "$DEST/" \;

echo "Installed XSDs:"
ls -1 "$DEST/"*.xsd

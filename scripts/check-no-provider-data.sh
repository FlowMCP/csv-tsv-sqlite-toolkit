#!/usr/bin/env bash
#
# check-no-provider-data.sh
# -------------------------
# Pre-push guardrail for geo-csv-tsv-toolkit (Memo 092 PRD-G2).
#
# Purpose:
#   Prevents accidental commit of third-party geo CSV/TSV datasets (e.g.
#   OpenAddresses, BKG, municipal open-data dumps) into this public repo.
#   Such data carries individual licenses and MUST NOT be redistributed via
#   this repository. Only the synthetic CC0 fixture is allowed.
#
# Usage:
#   bash scripts/check-no-provider-data.sh
#
# Exit codes:
#   0 = clean (no suspicious files found)
#   1 = suspicious files detected (commit/push should be aborted)
#
# Detection heuristics (any match flags the file):
#   1. Binary signature: any .db file outside the synthetic fixture directory.
#   2. Data files: .csv/.tsv files outside the whitelisted fixture source dir.
#
# Whitelist (NEVER flagged):
#   - tests/fixtures/synthetic-csv/source/*.csv  (CC0 synthetic data)
#   - tests/fixtures/synthetic-csv/source/*.tsv  (CC0 synthetic data)
#   - tests/fixtures/synthetic-csv/README.md
#   - tests/fixtures/synthetic-csv/LICENSE
#   - scripts/check-no-provider-data.sh          (this script itself)
#

set -euo pipefail

# Exact-match whitelist (path relative to repo root)
WHITELIST_PATHS=(
    "tests/fixtures/synthetic-csv/README.md"
    "tests/fixtures/synthetic-csv/LICENSE"
    "scripts/check-no-provider-data.sh"
)

# Glob-match whitelist (bash pattern; expanded via [[ $path == $glob ]])
WHITELIST_GLOBS=(
    "tests/fixtures/synthetic-csv/source/*.csv"
    "tests/fixtures/synthetic-csv/source/*.tsv"
)

is_whitelisted() {
    local path="$1"
    local entry
    for entry in "${WHITELIST_PATHS[@]}"; do
        if [[ "$path" == "$entry" ]]; then
            return 0
        fi
    done
    for entry in "${WHITELIST_GLOBS[@]}"; do
        # shellcheck disable=SC2053
        if [[ "$path" == $entry ]]; then
            return 0
        fi
    done
    return 1
}

scan_data_file() {
    local path="$1"
    if [[ "$path" == *.csv || "$path" == *.tsv ]]; then
        return 0
    fi
    return 1
}

scan_sqlite_db() {
    local path="$1"
    [[ "$path" == *.db ]] || return 1
    if [[ "$path" == tests/fixtures/synthetic-csv/*.db ]]; then
        return 1
    fi
    return 0
}

collect_candidate_files() {
    local seen=$'\n'
    local line status path

    if git rev-parse --git-dir >/dev/null 2>&1; then
        while IFS= read -r line; do
            [[ -z "$line" ]] && continue
            path="$line"
            if [[ "$seen" != *$'\n'"$path"$'\n'* ]]; then
                seen="${seen}${path}"$'\n'
                printf '%s\n' "$path"
            fi
        done < <( git diff --cached --name-only --diff-filter=ACMR 2>/dev/null )

        while IFS= read -r line; do
            [[ -z "$line" ]] && continue
            status="${line:0:2}"
            path="${line:3}"
            path="${path#\"}"
            path="${path%\"}"
            [[ "$status" == " D" || "$status" == "D " ]] && continue
            if [[ "$seen" != *$'\n'"$path"$'\n'* ]]; then
                seen="${seen}${path}"$'\n'
                printf '%s\n' "$path"
            fi
        done < <( git status --porcelain -uall 2>/dev/null )
    fi
}

main() {
    local -a candidates=()
    local line
    while IFS= read -r line; do
        [[ -n "$line" ]] && candidates+=( "$line" )
    done < <( collect_candidate_files )

    local -a findings=()
    local path
    local candidate_count=${#candidates[@]}

    if (( candidate_count > 0 )); then
    for path in "${candidates[@]}"; do
        if is_whitelisted "$path"; then
            continue
        fi
        if scan_data_file "$path"; then
            findings+=( "[data-file] ${path}" )
            continue
        fi
        if scan_sqlite_db "$path"; then
            findings+=( "[sqlite-db] ${path}" )
            continue
        fi
    done
    fi

    local finding_count=${#findings[@]}
    if (( finding_count > 0 )); then
        printf 'ERROR: provider CSV/TSV/DB data detected in staged/untracked files.\n' >&2
        printf '       Memo 092 PRD-G2 forbids redistributing third-party geo\n' >&2
        printf '       datasets in this public repo. Only the synthetic CC0 fixture\n' >&2
        printf '       under tests/fixtures/synthetic-csv/source/ is allowed.\n\n' >&2
        printf 'Offending files (%d):\n' "$finding_count" >&2
        local entry
        for entry in "${findings[@]}"; do
            printf '  - %s\n' "$entry" >&2
        done
        exit 1
    fi

    printf 'OK: no provider data detected (%d files scanned).\n' "$candidate_count"
    exit 0
}

main "$@"

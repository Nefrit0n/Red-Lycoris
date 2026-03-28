"""BDU FSTEC vulnerability database sync from vullist.xlsx."""

import logging
import os
import re
import ssl
import tempfile
from datetime import datetime, timezone
from typing import Any

import httpx
import psycopg2
import psycopg2.extras
from openpyxl import load_workbook

logger = logging.getLogger("red_lycoris.bdu_sync")

BDU_XLSX_URL = os.getenv(
    "BDU_XLSX_URL", "https://bdu.fstec.ru/files/documents/vullist.xlsx"
)

# Column indices for Sheet 1 (0-based). Matches the xlsx header row.
COL_BDU_ID = 0
COL_NAME = 1
COL_DESCRIPTION = 2
COL_VENDOR = 3
COL_SOFTWARE_NAME = 4
COL_SOFTWARE_VERSION = 5
COL_SOFTWARE_TYPE = 6
COL_OS_HARDWARE = 7
COL_VULN_CLASS = 8
COL_DETECTION_DATE = 9
COL_CVSS_V2 = 10
COL_CVSS_V3 = 11
COL_CVSS_V4 = 12
COL_SEVERITY = 13
COL_REMEDIATION = 14
COL_STATUS = 15
COL_EXPLOIT_EXISTS = 16
COL_FIX_INFO = 17
COL_SOURCE_URLS = 18
COL_OTHER_IDS = 19
COL_OTHER_INFO = 20
COL_INCIDENT_INFO = 21
COL_EXPLOITATION_METHOD = 22
COL_FIX_METHOD = 23
COL_PUBLISHED_DATE = 24
COL_UPDATED_DATE = 25
COL_CONSEQUENCES = 26
COL_VULN_STATE = 27
COL_CWE_DESCRIPTION = 28
COL_CWE_ID = 29

TOTAL_COLUMNS = 30

# Regex to extract CVE and CWE identifiers.
CVE_RE = re.compile(r"CVE-\d{4}-\d{4,}", re.IGNORECASE)
CWE_RE = re.compile(r"CWE-\d{1,5}", re.IGNORECASE)


def _cell_str(row: tuple, idx: int) -> str:
    """Safely extract a cell value as a stripped string."""
    if idx >= len(row):
        return ""
    val = row[idx]
    if val is None:
        return ""
    return str(val).strip()


def _get_dsn() -> str:
    """Build PostgreSQL DSN from environment variables."""
    host = os.getenv("DB_HOST", "postgres")
    port = os.getenv("DB_PORT", "5432")
    user = os.getenv("DB_USER", "postgres")
    password = os.getenv("DB_PASSWORD", "postgres")
    dbname = os.getenv("DB_NAME", "red_lycoris")
    sslmode = os.getenv("DB_SSLMODE", "disable")
    return f"host={host} port={port} user={user} password={password} dbname={dbname} sslmode={sslmode}"


def _extract_identifiers(other_ids: str, cwe_id: str) -> list[tuple[str, str]]:
    """Extract (identifier, bdu_id) pairs from the other_ids and cwe_id fields."""
    identifiers: list[tuple[str, str]] = []
    seen: set[str] = set()

    for match in CVE_RE.findall(other_ids):
        norm = match.upper()
        if norm not in seen:
            seen.add(norm)
            identifiers.append((norm, ""))

    for match in CWE_RE.findall(cwe_id):
        norm = match.upper()
        if norm not in seen:
            seen.add(norm)
            identifiers.append((norm, ""))

    # Also extract CWE from other_ids if present there.
    for match in CWE_RE.findall(other_ids):
        norm = match.upper()
        if norm not in seen:
            seen.add(norm)
            identifiers.append((norm, ""))

    return identifiers


def download_xlsx(url: str) -> str:
    """Download the BDU xlsx file to a temporary location. Returns file path."""
    logger.info("Downloading BDU xlsx from %s", url)
    # BDU FSTEC uses a Russian CA — skip TLS verification.
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    with httpx.Client(verify=ctx, timeout=300, follow_redirects=True) as client:
        resp = client.get(url)
        resp.raise_for_status()

    tmp = tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False)
    tmp.write(resp.content)
    tmp.close()
    logger.info("Downloaded %d bytes to %s", len(resp.content), tmp.name)
    return tmp.name


def parse_and_store(xlsx_path: str) -> dict[str, Any]:
    """Parse the xlsx file and upsert records into PostgreSQL."""
    dsn = _get_dsn()
    logger.info("Connecting to PostgreSQL")
    conn = psycopg2.connect(dsn)

    try:
        _ensure_sync_status_row(conn)
        _mark_syncing(conn, True)

        wb = load_workbook(xlsx_path, read_only=True, data_only=True)
        ws = wb.worksheets[0]  # Sheet 1: vulnerabilities

        vuln_batch: list[tuple] = []
        ident_batch: list[tuple[str, str]] = []
        total = 0
        skipped = 0

        for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
            if row is None:
                continue
            bdu_id = _cell_str(row, COL_BDU_ID)
            if not bdu_id or not bdu_id.startswith("BDU:"):
                skipped += 1
                continue

            other_ids = _cell_str(row, COL_OTHER_IDS)
            cwe_id = _cell_str(row, COL_CWE_ID)

            vuln_batch.append((
                bdu_id,
                _cell_str(row, COL_NAME),
                _cell_str(row, COL_DESCRIPTION),
                _cell_str(row, COL_VENDOR),
                _cell_str(row, COL_SOFTWARE_NAME),
                _cell_str(row, COL_SOFTWARE_VERSION),
                _cell_str(row, COL_SOFTWARE_TYPE),
                _cell_str(row, COL_OS_HARDWARE),
                _cell_str(row, COL_VULN_CLASS),
                _cell_str(row, COL_DETECTION_DATE),
                _cell_str(row, COL_CVSS_V2),
                _cell_str(row, COL_CVSS_V3),
                _cell_str(row, COL_CVSS_V4),
                _cell_str(row, COL_SEVERITY),
                _cell_str(row, COL_REMEDIATION),
                _cell_str(row, COL_STATUS),
                _cell_str(row, COL_EXPLOIT_EXISTS),
                _cell_str(row, COL_FIX_INFO),
                _cell_str(row, COL_SOURCE_URLS),
                other_ids,
                _cell_str(row, COL_OTHER_INFO),
                _cell_str(row, COL_INCIDENT_INFO),
                _cell_str(row, COL_EXPLOITATION_METHOD),
                _cell_str(row, COL_FIX_METHOD),
                _cell_str(row, COL_PUBLISHED_DATE),
                _cell_str(row, COL_UPDATED_DATE),
                _cell_str(row, COL_CONSEQUENCES),
                _cell_str(row, COL_VULN_STATE),
                _cell_str(row, COL_CWE_DESCRIPTION),
                cwe_id,
            ))

            for ident, _ in _extract_identifiers(other_ids, cwe_id):
                ident_batch.append((ident, bdu_id))

            total += 1

            # Batch insert every 5000 rows (within the same transaction).
            if len(vuln_batch) >= 5000:
                _upsert_batch(conn, vuln_batch, ident_batch)
                vuln_batch.clear()
                ident_batch.clear()
                logger.info("Synced %d records so far...", total)

        # Final batch.
        if vuln_batch:
            _upsert_batch(conn, vuln_batch, ident_batch)

        wb.close()

        # Commit the entire sync atomically — either all rows land or none.
        conn.commit()

        _update_sync_status(conn, total, None)
        logger.info("BDU sync complete: %d records, %d skipped", total, skipped)
        return {"status": "completed", "records": total, "skipped": skipped}

    except Exception as exc:
        logger.exception("BDU sync failed")
        conn.rollback()
        try:
            _update_sync_status(conn, 0, str(exc))
        except Exception:
            pass
        raise
    finally:
        conn.close()


def _upsert_batch(
    conn,
    vulns: list[tuple],
    idents: list[tuple[str, str]],
) -> None:
    """Bulk upsert vulnerabilities and identifier mappings.

    Does NOT commit — the caller is responsible for committing the transaction
    so that the entire sync is atomic.
    """
    with conn.cursor() as cur:
        # Upsert vulnerabilities.
        psycopg2.extras.execute_values(
            cur,
            """
            INSERT INTO bdu_vulnerabilities (
                bdu_id, name, description, vendor, software_name, software_version,
                software_type, os_hardware, vuln_class, detection_date,
                cvss_v2, cvss_v3, cvss_v4, severity, remediation, status,
                exploit_exists, fix_info, source_urls, other_ids, other_info,
                incident_info, exploitation_method, fix_method, published_date,
                updated_date, consequences, vuln_state, cwe_description, cwe_id,
                synced_at
            ) VALUES %s
            ON CONFLICT (bdu_id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                vendor = EXCLUDED.vendor,
                software_name = EXCLUDED.software_name,
                software_version = EXCLUDED.software_version,
                software_type = EXCLUDED.software_type,
                os_hardware = EXCLUDED.os_hardware,
                vuln_class = EXCLUDED.vuln_class,
                detection_date = EXCLUDED.detection_date,
                cvss_v2 = EXCLUDED.cvss_v2,
                cvss_v3 = EXCLUDED.cvss_v3,
                cvss_v4 = EXCLUDED.cvss_v4,
                severity = EXCLUDED.severity,
                remediation = EXCLUDED.remediation,
                status = EXCLUDED.status,
                exploit_exists = EXCLUDED.exploit_exists,
                fix_info = EXCLUDED.fix_info,
                source_urls = EXCLUDED.source_urls,
                other_ids = EXCLUDED.other_ids,
                other_info = EXCLUDED.other_info,
                incident_info = EXCLUDED.incident_info,
                exploitation_method = EXCLUDED.exploitation_method,
                fix_method = EXCLUDED.fix_method,
                published_date = EXCLUDED.published_date,
                updated_date = EXCLUDED.updated_date,
                consequences = EXCLUDED.consequences,
                vuln_state = EXCLUDED.vuln_state,
                cwe_description = EXCLUDED.cwe_description,
                cwe_id = EXCLUDED.cwe_id,
                synced_at = EXCLUDED.synced_at
            """,
            [(v + (datetime.now(timezone.utc),)) for v in vulns],
            page_size=1000,
        )

        # Upsert identifier mappings.
        if idents:
            psycopg2.extras.execute_values(
                cur,
                """
                INSERT INTO bdu_identifier_map (identifier, bdu_id)
                VALUES %s
                ON CONFLICT (identifier, bdu_id) DO NOTHING
                """,
                idents,
                page_size=2000,
            )


def _mark_syncing(conn, syncing: bool) -> None:
    with conn.cursor() as cur:
        cur.execute(
            "UPDATE bdu_sync_status SET is_syncing = %s, updated_at = NOW() WHERE id = 1",
            (syncing,),
        )
    conn.commit()


def _update_sync_status(conn, count: int, error: str | None) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE bdu_sync_status
            SET last_synced_at = NOW(),
                record_count = %s,
                last_error = %s,
                is_syncing = FALSE,
                updated_at = NOW()
            WHERE id = 1
            """,
            (count, error),
        )
    conn.commit()


def _ensure_sync_status_row(conn) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO bdu_sync_status (id, sync_interval_hours, record_count, is_syncing, updated_at)
            VALUES (1, 24, 0, FALSE, NOW())
            ON CONFLICT (id) DO NOTHING
            """
        )
    conn.commit()

#!/usr/bin/env python3
"""Validate the 500-pin source-of-truth IDs and reconciled production assets."""
import csv
import pathlib
import re
from collections import Counter
from urllib.parse import urlsplit

ROOT = pathlib.Path(__file__).resolve().parents[1]
DIR = ROOT / "docs/editorial/pinterest"
MASTER = DIR / "OMC_500_Pin_Content_Calendar.csv"
RECON = DIR / "PRODUCTION_RECONCILIATION.csv"

def load(path):
    with path.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        if not reader.fieldnames:
            raise ValueError(f"Missing CSV header in {path}")
        for n, row in enumerate(rows, 2):
            if None in row:
                raise ValueError(f"Extra columns in {path.name}, row {n}")
        return rows

def check():
    master = load(MASTER)
    expected = {f"OMC-P{i:04d}" for i in range(1, 501)}
    ids = [r["Pin ID"].strip() for r in master]
    repeats = sorted(k for k,v in Counter(ids).items() if v > 1)
    missing = sorted(expected-set(ids))
    extra = sorted(set(ids)-expected)
    failures = []
    if len(master) != 500: failures.append(f"Expected 500 rows; got {len(master)}")
    if repeats: failures.append(f"Duplicate master IDs: {repeats}")
    if missing: failures.append(f"Missing master IDs: {missing}")
    if extra: failures.append(f"Unexpected master IDs: {extra}")

    slots = [(r["Publish date"],r["Slot"]) for r in master]
    if len(slots)!=len(set(slots)):
        failures.append("Duplicate date/slot combinations in master")
    concepts = Counter(r["Concept ID"] for r in master)
    if len(concepts)!=100 or any(v!=5 for v in concepts.values()):
        failures.append("Expected 100 concepts with exactly 5 entries each")

    production = load(RECON)
    confirmed = {}
    assets = {}
    statuses = Counter()
    for n, row in enumerate(production, 2):
        pin = row["Pin ID"].strip()
        status = row["Status"].strip().lower()
        statuses[status] += 1
        if pin not in expected: failures.append(f"Reconciliation row {n}: unknown Pin ID {pin}")
        if pin in confirmed: failures.append(f"Reconciliation row {n}: duplicate Pin ID {pin}")
        confirmed[pin] = row
        asset = row["Final asset path"].strip().casefold()
        if asset:
            if asset in assets: failures.append(f"Reused asset {asset}: {assets[asset]} and {pin}")
            assets[asset] = pin
        if status in {"created","approved","scheduled","published"} and not row["Final asset path"].strip():
            failures.append(f"{pin}: confirmed status requires final asset path")
        if status in {"scheduled","published"} and not row["Destination URL"].strip():
            failures.append(f"{pin}: scheduled/published needs destination URL")
        if row["Destination URL"].strip():
            url = urlsplit(row["Destination URL"].strip())
            if url.scheme not in {"http","https"} or not url.netloc:
                failures.append(f"{pin}: malformed destination URL")

    if failures:
        print("\n".join("ERROR: "+f for f in failures))
        raise SystemExit(1)
    print(f"PASS: {len(master)} distinct planned IDs, {len(concepts)} concepts, {len(production)} reconciled records")
    print("Reconciled states:", dict(statuses))

if __name__ == "__main__":
    check()

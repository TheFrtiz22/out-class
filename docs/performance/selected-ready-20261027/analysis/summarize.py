"""Read-only derivation of the complete isolated selected-startup comparison."""
from pathlib import Path
import collections
import hashlib
import json
import math
import re

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[2]


def read(file):
    return json.loads(file.read_text())


def distribution(values):
    values = sorted(v for v in values if type(v) in (int, float) and math.isfinite(v))
    return {"n": len(values), "p50": values[math.ceil(len(values) * .5) - 1] if values else None,
            "p95": values[math.ceil(len(values) * .95) - 1] if values else None,
            "max": values[-1] if values else None}


def request_timings(rows):
    groups = collections.defaultdict(list)
    for row in rows:
        groups[(row["route"], row.get("method"), row.get("type"))].append(row)
    result = []
    for (route, method, kind), requests in groups.items():
        phases = collections.defaultdict(list)
        for request in requests:
            for label, value in re.findall(r"([a-z_]+);dur=([0-9.]+)", request.get("serverTiming") or ""):
                phases[label].append(float(value))
        result.append({"route": route, "method": method, "type": kind, "observations": len(requests),
                       "timings": {field: distribution(r.get(field) for r in requests)
                                   for field in ["startMs", "endMs", "ttfbMs", "transferMs", "encodedBodyBytes"]},
                       "serverPhasesMs": {label: distribution(values) for label, values in phases.items()},
                       "failedSnapshots": sum(bool(r.get("failed")) for r in requests),
                       "pendingSnapshots": sum(r.get("endMs") is None and not r.get("failed") for r in requests),
                       "unknownBodySnapshots": sum(r.get("encodedBodyBytes") is None for r in requests)})
    return result


def collect():
    groups = collections.defaultdict(list)
    warmups = measured = 0
    controls = {}
    for profile in ["local", "constrained"]:
        folder = ROOT / profile
        protocol, host, power = (read(folder / name) for name in ["PROTOCOL.json", "HOST_MONITOR.json", "POWER_AUDIT.json"])
        assert protocol["complete"] and not protocol["failures"] and protocol["hostControl"]["valid"]
        assert host["valid"] and not host["violations"] and power["acceptedPowerInterval"]
        assert len(protocol["blocks"]) == 8
        for name, digest in protocol["toolHashes"].items():
            assert hashlib.sha256((REPO / "scripts" / name).read_bytes()).hexdigest() == digest
        assert hashlib.sha256((ROOT / "PLAN.json").read_bytes()).hexdigest() == protocol["planSha256"]
        controls[profile] = {"startedAt": protocol["startedAt"], "completedAt": protocol["completedAt"],
                             "hostValid": True, "actualSleepAuditValid": True, "builds": protocol["builds"]}
        for block in protocol["blocks"]:
            file = folder / block["directory"] / "browser-samples.json"
            data = read(file)
            assert block["status"] == 0 and not block["failures"] and not data["failures"]
            assert len(data["samples"]) == block["planned"] == block["observed"]
            for index, row in enumerate(data["samples"]):
                assert not row.get("failed") and row["pageErrorCount"] == 0
                if block["stage"] == "warmup":
                    warmups += 1
                    continue
                measured += 1
                row["evidence"] = {"file": str(file.relative_to(REPO)), "index": index}
                groups[(profile, block["variant"], row["path"], row["condition"])].append(row)
    assert measured == 320 and warmups == 64
    records = []
    for (profile, variant, path, condition), rows in sorted(groups.items()):
        assert len(rows) == 10
        latency = distribution(r["meaningfulMs"] for r in rows)
        records.append({"profile": profile, "variant": variant, "path": path, "condition": condition,
                        "sampleCount": len(rows), "p50Ms": latency["p50"], "p95Ms": latency["p95"], "maxMs": latency["max"],
                        "metrics": {field: distribution(r.get(field) for r in rows)
                                    for field in ["clickToUrlMs", "interactiveMs", "networkCompleteMs", "requestCount", "encodedBodyBytes", "scriptMs", "taskMs", "layoutMs", "pageErrorCount"]},
                        "sourceUsefulMs": distribution(r["preparation"]["meaningfulMs"] for r in rows),
                        "sourcePlusClickMs": distribution(r["preparation"]["meaningfulMs"] + r["meaningfulMs"] for r in rows),
                        "requestTimings": request_timings([q for r in rows for q in r["requests"]]),
                        "sourceRequestTimings": request_timings([q for r in rows for q in r["preparation"]["requests"]]),
                        "sampleReferences": [r["evidence"] for r in rows]})
    assert len(records) == 32
    return {"base": read(ROOT / "PLAN.json")["base"], "scope": "Isolated selected-startup current-main comparison; never pool with prior phases or instrumented followup.",
            "percentileMethod": "Nearest rank; n=10 p95 equals maximum. Missing metrics have n=0 and null values.",
            "membership": {"measured": measured, "excludedWarmups": warmups}, "controls": controls, "records": records,
            "limits": ["Local production builds with warm Auth/database services; cold/warm refers to destination browser context.",
                       "CDP constrained profile is 80ms latency, 200000B/s down, 93750B/s up and CPU4x; not hosted latency.",
                       "Source+click sums separate waits and excludes intervening drains/preparation; it is not continuous journey elapsed time.",
                       "Body byte counts exclude headers and unavailable bodies; failed/pending snapshots remain fully recorded.",
                       "Server phases can overlap; samples cannot isolate pure pool/provider waiting or establish multi-user capacity.",
                       "Candidate requires fresh validation before every reveal; warm latency cost versus prior retained content is explicitly reported."]}


if __name__ == "__main__":
    (ROOT / "COMPARISON.json").write_text(json.dumps(collect(), indent=2) + "\n")
    print("Verified all 320 measured outcomes, 64 warmups, 32 groups and complete controls.")

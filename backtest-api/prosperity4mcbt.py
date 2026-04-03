#!/usr/bin/env python3
"""
prosperity4mcbt - Monte Carlo backtester for Prosperity Match Viz

Usage:
    prosperity4mcbt <trader.py> [--quick | --heavy] [--sessions N] --out <dir>

Runs <trader.py> across available market data days with per-session execution
parameter randomisation (queue_penetration, hazard_strength, price_slippage_bps)
using the local prosperity4bt backtester. Writes dashboard.json to <dir>.

Data source: BACKTEST_DATASETS_ROOT env var (directory tree with
prices_round_*.csv / trades_round_*.csv files).

Execution randomisation models the real uncertainty in:
  - queue_penetration  (0.10–1.00): how far into the queue your passive order
                                     sits; lower = fewer passive fills
  - hazard_strength    (0.30–1.50): fill-hazard model intensity
  - price_slippage_bps (0.00–3.00): execution slippage in basis points
"""

from __future__ import annotations

import argparse
import json
import math
import os
import random
import statistics
import sys
import traceback
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# ── Use the LOCAL prosperity4bt (full queue/hazard model) ─────────────────────
_LOCAL_BT = Path("C:/Users/samet/Prosperity4/backtester")
if _LOCAL_BT.exists():
    sys.path.insert(0, str(_LOCAL_BT))

from prosperity4bt.data import DatasetFiles, discover_datasets, load_day_data  # noqa: E402
from prosperity4bt.engine import DEFAULT_LIMIT, run_day_backtest  # noqa: E402
from prosperity4bt.loader import instantiate_trader  # noqa: E402
from prosperity4bt.types import (  # noqa: E402
    ConversionPolicy,
    FillMode,
    MarkPriceModel,
    PublicTradeModel,
    TimeoutPolicy,
    TraderDataPolicy,
)

QUICK_SESSIONS = 100
HEAVY_SESSIONS = 1000

# ── Data discovery ─────────────────────────────────────────────────────────────

def get_available_data() -> List[DatasetFiles]:
    """Return all DatasetFiles objects found under BACKTEST_DATASETS_ROOT."""
    root_str = os.environ.get("BACKTEST_DATASETS_ROOT", "").strip()
    if root_str:
        root = Path(root_str)
        if root.exists():
            datasets = discover_datasets(root)
            if datasets:
                return list(datasets.values())
            print(f"[prosperity4mcbt] Warning: no CSVs found under {root}", flush=True)

    # Fallback: try to find the bundled prosperity4btest data
    try:
        import importlib.resources as _ir
        import prosperity4bt.resources as _res  # PyPI package resources
        pkg_root = Path(str(_ir.files("prosperity4bt.resources")))
        if pkg_root.exists():
            datasets = discover_datasets(pkg_root)
            if datasets:
                print("[prosperity4mcbt] Using bundled PyPI data (limited to 2 days). "
                      "Set BACKTEST_DATASETS_ROOT for more data.", flush=True)
                return list(datasets.values())
    except Exception:
        pass

    return []


# ── Statistics helpers ─────────────────────────────────────────────────────────

def _norm_cdf(x: float, mu: float, sigma: float) -> float:
    return 0.5 * (1.0 + math.erf((x - mu) / (sigma * math.sqrt(2.0))))


def _percentile(sv: List[float], p: float) -> float:
    n = len(sv)
    if n == 0:
        return 0.0
    idx = p / 100.0 * (n - 1)
    lo = int(idx)
    hi = min(lo + 1, n - 1)
    return sv[lo] * (1.0 - (idx - lo)) + sv[hi] * (idx - lo)


def compute_distribution(values: List[float]) -> dict:
    n = len(values)
    if n == 0:
        return {k: 0.0 for k in (
            "count mean std min p01 p05 p10 p25 p50 p75 p90 p95 p99 max "
            "positiveRate negativeRate zeroRate var95 cvar95 var99 cvar99 "
            "meanConfidenceLow95 meanConfidenceHigh95 sharpeLike sortinoLike skewness"
        ).split()}

    sv = sorted(values)
    mean_v = statistics.mean(values)
    std_v = statistics.pstdev(values)

    pos_r = sum(1 for v in values if v > 0) / n
    neg_r = sum(1 for v in values if v < 0) / n

    tail95 = sv[: max(1, int(0.05 * n))]
    tail99 = sv[: max(1, int(0.01 * n))]
    cvar95 = sum(tail95) / len(tail95)
    cvar99 = sum(tail99) / len(tail99)

    sharpe = mean_v / std_v if std_v > 1e-9 else 0.0
    neg_vals = [v for v in values if v < 0]
    down_std = statistics.pstdev(neg_vals) if len(neg_vals) > 1 else 1e-9
    sortino = mean_v / down_std if down_std > 1e-9 else 0.0

    skewness = 0.0
    if std_v > 1e-9 and n > 2:
        skewness = sum(((v - mean_v) / std_v) ** 3 for v in values) / n

    se = std_v / math.sqrt(n)
    return {
        "count": n,
        "mean": mean_v,
        "std": std_v,
        "min": sv[0],
        "p01": _percentile(sv, 1),
        "p05": _percentile(sv, 5),
        "p10": _percentile(sv, 10),
        "p25": _percentile(sv, 25),
        "p50": _percentile(sv, 50),
        "p75": _percentile(sv, 75),
        "p90": _percentile(sv, 90),
        "p95": _percentile(sv, 95),
        "p99": _percentile(sv, 99),
        "max": sv[-1],
        "positiveRate": pos_r,
        "negativeRate": neg_r,
        "zeroRate": max(0.0, 1.0 - pos_r - neg_r),
        "var95": _percentile(sv, 5),
        "cvar95": cvar95,
        "var99": _percentile(sv, 1),
        "cvar99": cvar99,
        "meanConfidenceLow95": mean_v - 1.96 * se,
        "meanConfidenceHigh95": mean_v + 1.96 * se,
        "sharpeLike": sharpe,
        "sortinoLike": sortino,
        "skewness": skewness,
    }


def compute_histogram(values: List[float], bins: int = 30) -> dict:
    if not values:
        return {"edges": [0.0, 1.0], "counts": [0]}
    lo, hi = min(values), max(values)
    if abs(hi - lo) < 1e-9:
        lo -= 0.5; hi += 0.5
    step = (hi - lo) / bins
    edges = [lo + i * step for i in range(bins + 1)]
    counts = [0] * bins
    for v in values:
        counts[min(int((v - lo) / step), bins - 1)] += 1
    return {"edges": edges, "counts": counts}


def compute_normal_fit(values: List[float]) -> dict:
    if len(values) < 2:
        return {"mu": 0.0, "sigma": 1.0, "r2": 0.0}
    mu = statistics.mean(values)
    sigma = statistics.pstdev(values) or 1e-9
    # KS statistic: max |empirical CDF - normal CDF|
    sv = sorted(values)
    n = len(sv)
    ks_d = max(abs(i / n - _norm_cdf(v, mu, sigma)) for i, v in enumerate(sv, 1))
    # Convert to approximate goodness-of-fit score (0=bad, 1=perfect)
    r2 = max(0.0, min(1.0, 1.0 - ks_d * math.sqrt(n) / 1.36))
    return {"mu": mu, "sigma": sigma, "r2": r2}


def linear_regression(xs: List[float], ys: List[float]) -> Tuple[float, float, float]:
    n = len(xs)
    if n < 2:
        return 0.0, 0.0, 0.0
    mx, my = sum(xs) / n, sum(ys) / n
    ss_xx = sum((x - mx) ** 2 for x in xs)
    if ss_xx < 1e-12:
        return 0.0, my, 0.0
    ss_xy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    slope = ss_xy / ss_xx
    intercept = my - slope * mx
    y_pred = [slope * x + intercept for x in xs]
    ss_res = sum((y - yp) ** 2 for y, yp in zip(ys, y_pred))
    ss_tot = sum((y - my) ** 2 for y in ys)
    r2 = max(0.0, 1.0 - ss_res / ss_tot) if ss_tot > 1e-9 else 0.0
    return slope, intercept, r2


def compute_band_series(
    sessions_series: List[Dict[int, float]],
    timestamps: List[int],
) -> dict:
    p05, p25, p50, p75, p95, mean_pts = [], [], [], [], [], []
    for ts in timestamps:
        vals = sorted(s.get(ts, 0.0) for s in sessions_series)
        p05.append(_percentile(vals, 5))
        p25.append(_percentile(vals, 25))
        p50.append(_percentile(vals, 50))
        p75.append(_percentile(vals, 75))
        p95.append(_percentile(vals, 95))
        mean_pts.append(sum(vals) / len(vals) if vals else 0.0)
    return {"timestamps": timestamps, "p05": p05, "p25": p25,
            "p50": p50, "p75": p75, "p95": p95, "mean": mean_pts}


# ── Main Monte Carlo run ───────────────────────────────────────────────────────

def run_mc(trader_path: Path, n_sessions: int, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[prosperity4mcbt] Loading trader: {trader_path}", flush=True)

    print("[prosperity4mcbt] Discovering available data days ...", flush=True)
    available = get_available_data()
    if not available:
        print("ERROR: No data found. Set BACKTEST_DATASETS_ROOT in .env.", file=sys.stderr)
        sys.exit(1)
    print(f"[prosperity4mcbt] Found {len(available)} data day(s). Running {n_sessions} sessions "
          f"with random execution parameters ...", flush=True)

    # Bootstrap sample sessions
    session_pool = [random.choice(available) for _ in range(n_sessions)]

    session_rows = []
    total_pnl_vals: List[float] = []
    all_product_pnls: Dict[str, List[float]] = defaultdict(list)

    total_series_list: List[Dict[int, float]] = []
    product_series_by_name: Dict[str, List[Dict[int, float]]] = defaultdict(list)

    session_total_slopes: List[float] = []
    session_total_r2s: List[float] = []
    session_product_slopes: Dict[str, List[float]] = defaultdict(list)

    timestamps_ref: Optional[List[int]] = None

    for i, files in enumerate(session_pool):
        # Per-session execution randomisation — this is what drives the distribution
        qp   = random.uniform(0.10, 1.00)   # queue penetration
        hz   = random.uniform(0.30, 1.50)   # hazard strength
        slip = random.uniform(0.00, 3.00)   # price slippage bps

        try:
            _, trader = instantiate_trader(trader_path)
            day_data = load_day_data(files)
            result = run_day_backtest(
                trader=trader,
                algorithm_path=trader_path,
                day_data=day_data,
                limits={},
                fill_mode=FillMode.ALL,
                conversion_policy=ConversionPolicy.REJECT,
                default_limit=DEFAULT_LIMIT,
                print_output=False,
                trader_data_limit=50_000,
                trader_data_policy=TraderDataPolicy.TRUNCATE,
                timeout_ms=900.0,
                timeout_policy=TimeoutPolicy.WARN,
                queue_penetration=qp,
                price_slippage_bps=slip,
                public_trade_model=PublicTradeModel.STRICT,
                queue_cancel_rate=0.5,
                hazard_strength=hz,
                require_next_book_confirmation=True,
                adverse_selection_alpha=0.0,
                mark_price_model=MarkPriceModel.MID,
            )
        except Exception as exc:
            print(f"  [session {i+1}/{n_sessions}] FAILED r={files.round_num} "
                  f"d={files.day_num}: {exc}", flush=True)
            continue

        # ── Extract PnL using clean RunResult fields ──────────────────────────
        total_pnl = result.total_profit
        product_pnl: Dict[str, float] = dict(result.product_profit)

        # Total time series from graph_points (List[Tuple[timestamp, cumulative_total]])
        total_series: Dict[int, float] = dict(result.graph_points)

        # Per-product time series from activity_rows (List[Tuple[PriceRow, cumulative_pnl]])
        product_ts: Dict[str, Dict[int, float]] = defaultdict(dict)
        for price_row, pnl in result.activity_rows:
            product_ts[price_row.product][price_row.timestamp] = pnl

        timestamps = sorted(total_series.keys())
        if timestamps_ref is None:
            timestamps_ref = timestamps

        total_pnl_vals.append(total_pnl)
        for p, v in product_pnl.items():
            all_product_pnls[p].append(v)

        total_series_list.append(total_series)
        for p, ts_map in product_ts.items():
            product_series_by_name[p].append(ts_map)

        # ── Per-session trend fit ──────────────────────────────────────────────
        ts_sorted = sorted(total_series)
        if len(ts_sorted) >= 2:
            slope_t, _, r2_t = linear_regression(
                list(range(len(ts_sorted))),
                [total_series[t] for t in ts_sorted],
            )
        else:
            slope_t, r2_t = 0.0, 0.0
        session_total_slopes.append(slope_t)
        session_total_r2s.append(r2_t)

        per_product_slopes: Dict[str, float] = {}
        for p, ts_map in product_ts.items():
            ts_p = sorted(ts_map)
            if len(ts_p) >= 2:
                sl, _, _ = linear_regression(list(range(len(ts_p))), [ts_map[t] for t in ts_p])
            else:
                sl = 0.0
            session_product_slopes[p].append(sl)
            per_product_slopes[p] = sl

        row: dict = {
            "session_id": i + 1,
            "total_pnl": total_pnl,
            "total_slope_per_step": slope_t,
            "total_r2": r2_t,
            # execution params stored for reference
            "_queue_penetration": round(qp, 3),
            "_hazard_strength": round(hz, 3),
            "_slippage_bps": round(slip, 3),
        }
        for p, v in product_pnl.items():
            row[f"{p.lower()}_pnl"] = v
        for p, sl in per_product_slopes.items():
            row[f"{p.lower()}_slope_per_step"] = sl
        session_rows.append(row)

        if (i + 1) % max(1, n_sessions // 10) == 0:
            print(f"  {i+1}/{n_sessions} sessions done", flush=True)

    actual_n = len(session_rows)
    if actual_n == 0:
        print("ERROR: All sessions failed.", file=sys.stderr)
        sys.exit(1)

    print(f"[prosperity4mcbt] {actual_n} sessions completed. Computing statistics ...", flush=True)

    timestamps_ref = timestamps_ref or []

    # ── Detect top-2 products (by absolute mean PnL) ──────────────────────────
    traded = sorted(all_product_pnls.keys(),
                    key=lambda p: -abs(statistics.mean(all_product_pnls[p])))
    product_a = traded[0] if len(traded) > 0 else "EMERALDS"
    product_b = traded[1] if len(traded) > 1 else "TOMATOES"

    pnl_a = all_product_pnls.get(product_a, [0.0] * actual_n)
    pnl_b = all_product_pnls.get(product_b, [0.0] * actual_n)

    # Pad to actual_n if needed (some sessions may have missed a product)
    pnl_a = pnl_a + [0.0] * (actual_n - len(pnl_a))
    pnl_b = pnl_b + [0.0] * (actual_n - len(pnl_b))

    # Inject canonical names into session rows for the frontend
    for row, a, b in zip(session_rows, pnl_a, pnl_b):
        row["emerald_pnl"] = a
        row["tomato_pnl"] = b
        if f"{product_a.lower()}_slope_per_step" in row:
            row["emerald_slope_per_step"] = row[f"{product_a.lower()}_slope_per_step"]
        if f"{product_b.lower()}_slope_per_step" in row:
            row["tomato_slope_per_step"] = row[f"{product_b.lower()}_slope_per_step"]

    # ── Correlation ───────────────────────────────────────────────────────────
    try:
        em_mean = statistics.mean(pnl_a)
        tom_mean = statistics.mean(pnl_b)
        cov = sum((e - em_mean) * (t - tom_mean) for e, t in zip(pnl_a, pnl_b)) / actual_n
        em_std = statistics.pstdev(pnl_a) or 1e-9
        tom_std = statistics.pstdev(pnl_b) or 1e-9
        corr = cov / (em_std * tom_std)
    except Exception:
        corr = 0.0

    # ── Scatter fit ───────────────────────────────────────────────────────────
    sc_slope, sc_int, sc_r2 = linear_regression(pnl_a, pnl_b) if actual_n >= 2 else (0.0, 0.0, 0.0)

    # ── Band series ───────────────────────────────────────────────────────────
    band_series: dict = {"TOTAL": compute_band_series(total_series_list, timestamps_ref)}
    if product_series_by_name.get(product_a):
        band_series["EMERALDS"] = compute_band_series(product_series_by_name[product_a], timestamps_ref)
    if product_series_by_name.get(product_b):
        band_series["TOMATOES"] = compute_band_series(product_series_by_name[product_b], timestamps_ref)

    # ── Trend fits ────────────────────────────────────────────────────────────
    trend_fits: dict = {}
    if session_total_slopes:
        sl, ic, r2 = linear_regression(list(range(actual_n)), session_total_slopes)
        rs, ri, rr = linear_regression(list(range(actual_n)), session_total_r2s)
        trend_fits["TOTAL"] = {
            "profitability": {"slope": sl, "intercept": ic, "r2": r2},
            "stability":     {"slope": rs, "intercept": ri, "r2": rr},
        }
    for label, key in [("EMERALDS", product_a), ("TOMATOES", product_b)]:
        sl_list = session_product_slopes.get(key, [])
        if sl_list:
            sl, ic, r2 = linear_regression(list(range(len(sl_list))), sl_list)
            trend_fits[label] = {
                "profitability": {"slope": sl, "intercept": ic, "r2": r2},
                "stability":     {"slope": 0.0, "intercept": 0.0, "r2": 0.0},
            }

    sorted_by_pnl = sorted(session_rows, key=lambda r: r["total_pnl"], reverse=True)

    dashboard = {
        "kind": "monte_carlo_dashboard",
        "meta": {
            "algorithmPath": str(trader_path),
            "sessionCount": actual_n,
            "bandSessionCount": len(total_series_list),
            "fvMode": "queue-hazard",
            "tradeMode": "all",
            "tomatoSupport": "yes" if any(v != 0 for v in pnl_b) else "no",
            "seed": random.randint(0, 2 ** 31),
            "baseDataDays": len(available),
            "productA": product_a,
            "productB": product_b,
        },
        "overall": {
            "totalPnl":   compute_distribution(total_pnl_vals),
            "emeraldPnl": compute_distribution(pnl_a),
            "tomatoPnl":  compute_distribution(pnl_b),
            "emeraldTomatoCorrelation": corr,
        },
        "products": {
            p: {"pnl": compute_distribution(vals)}
            for p, vals in all_product_pnls.items()
        },
        "histograms": {
            "totalPnl":   compute_histogram(total_pnl_vals),
            "emeraldPnl": compute_histogram(pnl_a),
            "tomatoPnl":  compute_histogram(pnl_b),
            "totalSlope": compute_histogram(session_total_slopes),
            "totalR2":    compute_histogram(session_total_r2s),
        },
        "bandSeries": band_series,
        "normalFits": {
            "totalPnl":   compute_normal_fit(total_pnl_vals),
            "emeraldPnl": compute_normal_fit(pnl_a),
            "tomatoPnl":  compute_normal_fit(pnl_b),
        },
        "sessions":       session_rows,
        "topSessions":    sorted_by_pnl[:10],
        "bottomSessions": sorted_by_pnl[-10:],
        "trendFits":      trend_fits,
        "scatterFit":     {"slope": sc_slope, "intercept": sc_int, "r2": sc_r2},
    }

    out_path = out_dir / "dashboard.json"
    out_path.write_text(json.dumps(dashboard, indent=2), encoding="utf-8")
    print(f"[prosperity4mcbt] Wrote dashboard.json: {out_path}", flush=True)


# ── CLI ────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Monte Carlo backtester — produces dashboard.json for Prosperity Match Viz"
    )
    parser.add_argument("trader", type=Path)
    parser.add_argument("--quick",    action="store_true", help=f"Run {QUICK_SESSIONS} sessions (default)")
    parser.add_argument("--heavy",    action="store_true", help=f"Run {HEAVY_SESSIONS} sessions")
    parser.add_argument("--sessions", type=int, default=None)
    parser.add_argument("--out",      type=Path, required=True)
    args = parser.parse_args()

    n = args.sessions if (args.sessions and args.sessions > 0) else (HEAVY_SESSIONS if args.heavy else QUICK_SESSIONS)

    try:
        run_mc(args.trader.resolve(), n, args.out.resolve())
    except KeyboardInterrupt:
        print("\n[prosperity4mcbt] Interrupted.", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:
        traceback.print_exc()
        print(f"[prosperity4mcbt] Fatal: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

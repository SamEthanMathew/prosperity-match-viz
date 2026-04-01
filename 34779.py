"""
Bot v0.1: EMERALDS anchor MM + selective taker; TOMATOES EWMA fair + MR + imbalance.

Upload: copy this file to `trader.py` beside `datamodel.py`. No prosperity_iv imports.

v0.1: explicit L1 (best bid/ask), per-tick reserved exposure, book-aware passive quotes,
scaled EMERALDS inventory skew, TOMATOES prev-mid momentum in MR conflict, quieter logging.
"""

from __future__ import annotations

import json
from typing import Any

from datamodel import Order, OrderDepth, TradingState

# --- Symbols (swap if your round uses different names) ---
SYMBOL_EMERALDS = "EMERALDS"
SYMBOL_TOMATOES = "TOMATOES"

# --- EMERALDS ---
FAIR_EMERALD = 10_000
CAP_EMERALD = 50
QUOTE_HALF_EM = 3
SKEW_TICKS_EM = 2
SKEW_MAX_EM = 8
STOP_SIDE_QUOTE_FRAC_EM = 0.85
NEAR_FAIR_TICKS_EM = 8
EDGE_GOOD_ENTRY_EM = 4
IMB_TAKER_EM = 0.2
PASSIVE_SIZE_EM = 8
TAKER_SIZE_EM = 4

# --- TOMATOES ---
CAP_TOMATO = 30
EWMA_N = 20
EWMA_ALPHA = 2.0 / (EWMA_N + 1)
IMB_ADJ_TH = 0.4
IMB_ADJ_TICKS = 2
MR_THRESHOLD_TICKS = 3.0
PASSIVE_BAND_TOM = 2.0
CONFLICT_IMB = 0.5
SHARP_MID_MOVE_TOM = 2.0
QUOTE_HALF_TOM = 2
SKEW_TICKS_TOM = 2
PASSIVE_SIZE_TOM = 5
TAKER_SIZE_TOM = 3

# --- State keys (JSON traderData) ---
KEY_EWMA_TOMATO = "ewma_tomato"
KEY_PREV_MID_TOMATO = "prev_mid_tomato"

# --- Logging (platform captures stdout) ---
LOG_HEARTBEAT_TS = 5000
NEAR_CAP_LOG_FRAC = 0.7


def parse_trader_data(raw: str) -> dict[str, Any]:
    if not raw or not raw.strip():
        return {}
    try:
        v = json.loads(raw)
        return v if isinstance(v, dict) else {}
    except json.JSONDecodeError:
        return {}


def serialize_trader_data(data: dict[str, Any]) -> str:
    return json.dumps(data, separators=(",", ":"))


def l1(depth: OrderDepth) -> tuple[int, int, int, int] | None:
    """Best bid = max buy price; best ask = min sell price (sizes from those levels)."""
    if not depth.buy_orders or not depth.sell_orders:
        return None
    bb = max(depth.buy_orders.keys())
    ba = min(depth.sell_orders.keys())
    bb_sz = depth.buy_orders[bb]
    ba_sz = abs(depth.sell_orders[ba])
    return bb, bb_sz, ba, ba_sz


def mid_from_l1(t: tuple[int, int, int, int]) -> float:
    bb, _, ba, _ = t
    return (bb + ba) / 2.0


def imbalance_l1(t: tuple[int, int, int, int]) -> float:
    _, bb_sz, _, ba_sz = t
    d = bb_sz + ba_sz
    if d <= 0:
        return 0.0
    return (bb_sz - ba_sz) / d


def clip_buy(inv: int, cap: int, q: int, *, reserved_buy: int = 0) -> int:
    room = cap - inv - reserved_buy
    return max(0, min(q, room))


def clip_sell(inv: int, cap: int, q: int, *, reserved_sell: int = 0) -> int:
    room = inv + cap - reserved_sell
    return max(0, min(q, room))


def reserved_buy_units(orders: list[Order]) -> int:
    return sum(o.quantity for o in orders if o.quantity > 0)


def reserved_sell_units(orders: list[Order]) -> int:
    return sum(-o.quantity for o in orders if o.quantity < 0)


def passive_clip_to_book(bid_px: int, ask_px: int, bb: int, ba: int) -> tuple[int, int]:
    """Passive: bid <= best_ask - 1, ask >= best_bid + 1; avoid crossed quotes."""
    hi_bid = ba - 1
    lo_ask = bb + 1
    bid_px = min(bid_px, hi_bid)
    ask_px = max(ask_px, lo_ask)
    if bid_px >= ask_px:
        bid_px = ask_px - 1
    bid_px = max(1, bid_px)
    ask_px = max(1, ask_px)
    if bid_px >= ask_px:
        bid_px, ask_px = bb, ba
        if bid_px >= ask_px:
            bid_px, ask_px = max(1, ba - 2), max(1, ba - 1)
    return bid_px, ask_px


def emerald_inventory_skew_ticks(inv: int) -> int:
    """Skew magnitude scales with |inv|/cap; sign pulls quotes to flatten."""
    sign_inv = (inv > 0) - (inv < 0)
    if sign_inv == 0:
        return 0
    frac = min(abs(inv) / float(CAP_EMERALD), 1.0)
    mag = SKEW_TICKS_EM + (SKEW_MAX_EM - SKEW_TICKS_EM) * frac
    return round(mag * sign_inv)


def _maybe_log(
    symbol: str,
    ts: int,
    inv: int,
    cap: int,
    mode: str,
    msg: str,
) -> None:
    if (
        mode.startswith("taker")
        or mode.startswith("skip")
        or abs(inv) >= int(cap * NEAR_CAP_LOG_FRAC)
        or ts % LOG_HEARTBEAT_TS == 0
    ):
        print(f"BOTv0.1 {symbol} ts={ts} inv={inv} cap={cap} mode={mode} {msg}")


def orders_emerald(
    symbol: str,
    depth: OrderDepth,
    inv: int,
    ts: int,
) -> tuple[list[Order], dict[str, Any]]:
    data: dict[str, Any] = {}
    top = l1(depth)
    if top is None:
        _maybe_log(symbol, ts, inv, CAP_EMERALD, "skip", "book_incomplete")
        return [], data

    bb, _, ba, _ = top
    mid = mid_from_l1(top)
    imb = imbalance_l1(top)
    skew = emerald_inventory_skew_ticks(inv)
    bid_desired = FAIR_EMERALD - QUOTE_HALF_EM - skew
    ask_desired = FAIR_EMERALD + QUOTE_HALF_EM - skew
    bid_px, ask_px = passive_clip_to_book(bid_desired, ask_desired, bb, ba)

    orders: list[Order] = []
    stop_buys = inv > 0 and inv >= int(CAP_EMERALD * STOP_SIDE_QUOTE_FRAC_EM)
    stop_sells = inv < 0 and -inv >= int(CAP_EMERALD * STOP_SIDE_QUOTE_FRAC_EM)

    qb = 0 if stop_buys else clip_buy(inv, CAP_EMERALD, PASSIVE_SIZE_EM)
    qs = 0 if stop_sells else clip_sell(inv, CAP_EMERALD, PASSIVE_SIZE_EM)
    if qb > 0 and bid_px < ba:
        orders.append(Order(symbol, bid_px, qb))
    if qs > 0 and ask_px > bb:
        orders.append(Order(symbol, ask_px, -qs))

    rb = reserved_buy_units(orders)
    rs = reserved_sell_units(orders)

    mode = "passive"
    taker_done = False

    if abs(mid - FAIR_EMERALD) <= NEAR_FAIR_TICKS_EM:
        if imb >= IMB_TAKER_EM and clip_buy(
            inv, CAP_EMERALD, TAKER_SIZE_EM, reserved_buy=rb
        ) >= TAKER_SIZE_EM:
            orders.append(Order(symbol, ba, TAKER_SIZE_EM))
            taker_done = True
            mode = "taker_imb"
        elif imb <= -IMB_TAKER_EM and clip_sell(
            inv, CAP_EMERALD, TAKER_SIZE_EM, reserved_sell=rs
        ) >= TAKER_SIZE_EM:
            orders.append(Order(symbol, bb, -TAKER_SIZE_EM))
            taker_done = True
            mode = "taker_imb"

    if not taker_done:
        if ba < FAIR_EMERALD - EDGE_GOOD_ENTRY_EM and clip_buy(
            inv, CAP_EMERALD, TAKER_SIZE_EM, reserved_buy=rb
        ) >= TAKER_SIZE_EM:
            orders.append(Order(symbol, ba, TAKER_SIZE_EM))
            mode = "taker_edge_buy"
            taker_done = True
        elif bb > FAIR_EMERALD + EDGE_GOOD_ENTRY_EM and clip_sell(
            inv, CAP_EMERALD, TAKER_SIZE_EM, reserved_sell=rs
        ) >= TAKER_SIZE_EM:
            orders.append(Order(symbol, bb, -TAKER_SIZE_EM))
            mode = "taker_edge_sell"
            taker_done = True

    _maybe_log(
        symbol,
        ts,
        inv,
        CAP_EMERALD,
        mode,
        f"fair={FAIR_EMERALD} mid={mid:.2f} I={imb:.3f} skew={skew} n_orders={len(orders)}",
    )
    return orders, data


def orders_tomato(
    symbol: str,
    depth: OrderDepth,
    inv: int,
    ts: int,
    data: dict[str, Any],
) -> tuple[list[Order], dict[str, Any]]:
    top = l1(depth)
    if top is None:
        _maybe_log(symbol, ts, inv, CAP_TOMATO, "skip", "book_incomplete")
        return [], data

    bb, _, ba, _ = top
    mid = mid_from_l1(top)
    imb = imbalance_l1(top)

    prev_mid_raw = data.get(KEY_PREV_MID_TOMATO)
    prev_mid = float(prev_mid_raw) if isinstance(prev_mid_raw, (int, float)) else mid
    mid_delta = mid - prev_mid

    prev = data.get(KEY_EWMA_TOMATO)
    if prev is None or not isinstance(prev, (int, float)):
        ewma = mid
    else:
        ewma = EWMA_ALPHA * mid + (1.0 - EWMA_ALPHA) * float(prev)

    adj = 0.0
    if imb > IMB_ADJ_TH:
        adj = float(IMB_ADJ_TICKS)
    elif imb < -IMB_ADJ_TH:
        adj = float(-IMB_ADJ_TICKS)
    fair = ewma + adj

    out_data = dict(data)
    out_data[KEY_EWMA_TOMATO] = ewma
    out_data[KEY_PREV_MID_TOMATO] = mid

    sign_inv = (inv > 0) - (inv < 0)
    skew = SKEW_TICKS_TOM * sign_inv
    bid_desired = round(fair - QUOTE_HALF_TOM - skew)
    ask_desired = round(fair + QUOTE_HALF_TOM - skew)
    bid_px, ask_px = passive_clip_to_book(bid_desired, ask_desired, bb, ba)

    orders: list[Order] = []
    qb = clip_buy(inv, CAP_TOMATO, PASSIVE_SIZE_TOM)
    qs = clip_sell(inv, CAP_TOMATO, PASSIVE_SIZE_TOM)
    if qb > 0 and bid_px < ba:
        orders.append(Order(symbol, bid_px, qb))
    if qs > 0 and ask_px > bb:
        orders.append(Order(symbol, ask_px, -qs))

    rb = reserved_buy_units(orders)
    rs = reserved_sell_units(orders)

    mode = "passive"
    dev = mid - fair

    momentum_conflict_sell = imb > CONFLICT_IMB and mid_delta > SHARP_MID_MOVE_TOM
    momentum_conflict_buy = imb < -CONFLICT_IMB and mid_delta < -SHARP_MID_MOVE_TOM

    if abs(dev) > PASSIVE_BAND_TOM:
        if dev > MR_THRESHOLD_TICKS:
            conflict = (imb > CONFLICT_IMB and mid > fair) or momentum_conflict_sell
            if not conflict and clip_sell(
                inv, CAP_TOMATO, TAKER_SIZE_TOM, reserved_sell=rs
            ) >= TAKER_SIZE_TOM:
                orders.append(Order(symbol, bb, -TAKER_SIZE_TOM))
                mode = "taker_mr_sell"
        elif -dev > MR_THRESHOLD_TICKS:
            conflict = (imb < -CONFLICT_IMB and mid < fair) or momentum_conflict_buy
            if not conflict and clip_buy(
                inv, CAP_TOMATO, TAKER_SIZE_TOM, reserved_buy=rb
            ) >= TAKER_SIZE_TOM:
                orders.append(Order(symbol, ba, TAKER_SIZE_TOM))
                mode = "taker_mr_buy"

    _maybe_log(
        symbol,
        ts,
        inv,
        CAP_TOMATO,
        mode,
        f"fair={fair:.2f} ewma={ewma:.2f} mid={mid:.2f} dMid={mid_delta:.2f} "
        f"I={imb:.3f} n_orders={len(orders)}",
    )
    return orders, out_data


class Trader:
    """Prosperity IV Bot v0.1 â€” hybrid MM + selective takers for EMERALDS and TOMATOES."""

    def bid(self) -> int:
        return 0

    def run(self, state: TradingState):
        data = parse_trader_data(state.traderData)
        result: dict[str, list[Order]] = {}
        ts = state.timestamp

        if SYMBOL_EMERALDS in state.order_depths:
            inv_e = state.position.get(SYMBOL_EMERALDS, 0)
            oe, _ = orders_emerald(SYMBOL_EMERALDS, state.order_depths[SYMBOL_EMERALDS], inv_e, ts)
            result[SYMBOL_EMERALDS] = oe

        if SYMBOL_TOMATOES in state.order_depths:
            inv_t = state.position.get(SYMBOL_TOMATOES, 0)
            ot, data = orders_tomato(
                SYMBOL_TOMATOES,
                state.order_depths[SYMBOL_TOMATOES],
                inv_t,
                ts,
                data,
            )
            result[SYMBOL_TOMATOES] = ot

        return result, 0, serialize_trader_data(data)
"""
IMC Prosperity 4 - Tutorial Round Algorithm
Products: EMERALDS (stable ~10,000) and TOMATOES (volatile random walk ~5,000)

Strategy Summary:
  EMERALDS: Aggressive market-making around hardcoded fair value of 10,000.
            - Take any mispriced orders (buy below fair, sell above fair)
            - Quote inside the spread to attract taker bots
            - Skew quotes based on inventory to mean-revert position

  TOMATOES: Market-making around a dynamic fair value estimated via
            exponential moving average of the **best bid/ask mid** (not wall mid).
            - Take only when edge ≥ 2 ticks and edge > half-spread (vs top-of-book)
            - Cap order sizes (see MAX_ORDER_SIZE; align with round position limits on wiki)
            - Quote passively around fair value with inventory-aware skew

Allowed imports: pandas, numpy, statistics, math, typing, jsonpickle
Return signature: (result, conversions, traderData)
"""

from datamodel import OrderDepth, TradingState, Order
from typing import List, Dict, Any
import jsonpickle
import math


class Trader:
    """
    Main trader class. The `run` method is called every tick by the exchange.
    Since the class is re-instantiated each tick, we persist state via traderData.
    """

    # ── CONFIGURATION ──────────────────────────────────────────────────
    # Position limits per product (check wiki for exact values; 50 is typical for tutorial)
    POSITION_LIMITS = {
        "EMERALDS": 50,
        "TOMATOES": 50,
    }

    # EMERALDS: fixed fair value based on our data analysis
    EMERALDS_FAIR = 10_000

    # EMERALDS: how far inside the spread we quote (tighter = more fills, riskier)
    EMERALDS_SPREAD = 4  # we'll bid at 9996, ask at 10004

    # TOMATOES: EMA smoothing factor (IMC Prosperity: tune per product; typical 0.1–0.3)
    TOMATOES_EMA_ALPHA = 0.2

    # TOMATOES: half-spread for passive quotes around fair value
    TOMATOES_SPREAD = 4

    # Cap per-order size (tutorial/round limits: see Prosperity wiki for symbol limits)
    MAX_ORDER_SIZE = 20

    # Inventory penalty: how aggressively to skew quotes when we have inventory
    # Higher = more aggressive position reduction
    INVENTORY_SKEW = 1

    def run(self, state: TradingState):
        """
        Called every tick. Returns (result, conversions, traderData).

        result:      Dict[str, List[Order]] — orders to place per product
        conversions: int — currency conversions (0 for tutorial)
        traderData:  str — state to persist to next tick (serialized via jsonpickle)
        """

        # ── LOAD PERSISTED STATE ───────────────────────────────────────
        stored = self._load_state(state.traderData)

        # ── COMPUTE ORDERS FOR EACH PRODUCT ────────────────────────────
        result: Dict[str, List[Order]] = {}

        if "EMERALDS" in state.order_depths:
            result["EMERALDS"] = self._trade_emeralds(state, stored)

        if "TOMATOES" in state.order_depths:
            result["TOMATOES"] = self._trade_tomatoes(state, stored)

        # ── SAVE STATE & RETURN ────────────────────────────────────────
        traderData = self._save_state(stored)
        conversions = 0  # no conversions in tutorial round

        return result, conversions, traderData

    # ══════════════════════════════════════════════════════════════════
    #  EMERALDS STRATEGY: Market-making around fixed fair value (10,000)
    # ══════════════════════════════════════════════════════════════════

    def _trade_emeralds(self, state: TradingState, stored: dict) -> List[Order]:
        """
        EMERALDS sits at 10,000 with a wide 16-point spread (9992/10008).
        We do two things:
          1) TAKE: instantly buy anything offered below fair, sell anything bid above fair
          2) MAKE: place passive orders inside the spread to capture the spread ourselves
        """
        product = "EMERALDS"
        orders: List[Order] = []
        order_depth = state.order_depths[product]
        position = state.position.get(product, 0)
        limit = self.POSITION_LIMITS[product]
        fair = self.EMERALDS_FAIR

        best_bid = max(order_depth.buy_orders.keys()) if order_depth.buy_orders else None
        best_ask = min(order_depth.sell_orders.keys()) if order_depth.sell_orders else None
        spread = (best_ask - best_bid) if best_bid is not None and best_ask is not None else 0
        min_edge = self._min_take_edge_ticks(spread)

        # ── PHASE 1: TAKE (hit mispriced quotes with edge ≥ 2 ticks and > spread/2) ─
        remaining_buy = limit - position  # how many more we CAN buy

        if len(order_depth.sell_orders) > 0:
            for ask_price in sorted(order_depth.sell_orders.keys()):
                edge = fair - ask_price
                if ask_price < fair and edge >= min_edge and remaining_buy > 0:
                    ask_vol = -order_depth.sell_orders[ask_price]
                    take_qty = min(ask_vol, remaining_buy, self.MAX_ORDER_SIZE)
                    orders.append(Order(product, ask_price, take_qty))
                    remaining_buy -= take_qty

        remaining_sell = limit + position

        if len(order_depth.buy_orders) > 0:
            for bid_price in sorted(order_depth.buy_orders.keys(), reverse=True):
                edge = bid_price - fair
                if bid_price > fair and edge >= min_edge and remaining_sell > 0:
                    bid_vol = order_depth.buy_orders[bid_price]
                    take_qty = min(bid_vol, remaining_sell, self.MAX_ORDER_SIZE)
                    orders.append(Order(product, bid_price, -take_qty))
                    remaining_sell -= take_qty

        # ── PHASE 2: MAKE (place passive quotes inside the spread) ─────
        # Recalculate remaining capacity after taking
        position_after_takes = position
        for o in orders:
            position_after_takes += o.quantity  # + for buys, - for sells

        buy_capacity = limit - position_after_takes
        sell_capacity = limit + position_after_takes

        # Inventory skew: shift our quotes to reduce inventory
        # If we're long, lower our bid (less eager to buy) and lower our ask (more eager to sell)
        # If we're short, raise our bid (more eager to buy) and raise our ask (less eager to sell)
        skew = round(position_after_takes * self.INVENTORY_SKEW / limit)

        bid_price = fair - self.EMERALDS_SPREAD - skew
        ask_price = fair + self.EMERALDS_SPREAD - skew

        if buy_capacity > 0:
            orders.append(
                Order(product, int(bid_price), min(buy_capacity, self.MAX_ORDER_SIZE))
            )

        if sell_capacity > 0:
            orders.append(
                Order(product, int(ask_price), -min(sell_capacity, self.MAX_ORDER_SIZE))
            )

        return orders

    # ══════════════════════════════════════════════════════════════════
    #  TOMATOES STRATEGY: Market-making around EMA fair value
    # ══════════════════════════════════════════════════════════════════

    def _trade_tomatoes(self, state: TradingState, stored: dict) -> List[Order]:
        """
        TOMATOES is a random walk around ~5,000. We use an exponential moving
        average (EMA) of the mid-price as our fair value estimate, then:
          1) TAKE: buy below fair, sell above fair
          2) MAKE: quote around fair with inventory-aware skew
        """
        product = "TOMATOES"
        orders: List[Order] = []
        order_depth = state.order_depths[product]
        position = state.position.get(product, 0)
        limit = self.POSITION_LIMITS[product]

        # ── COMPUTE FAIR VALUE (best bid/ask mid only; no wall mid) ────
        mid_price = self._get_mid_price(order_depth)

        if mid_price is None:
            return orders

        best_bid = max(order_depth.buy_orders.keys())
        best_ask = min(order_depth.sell_orders.keys())
        spread = best_ask - best_bid
        min_edge = self._min_take_edge_ticks(spread)

        # Update EMA on mid
        ema_key = "tomatoes_ema"
        if ema_key in stored and stored[ema_key] is not None:
            alpha = self.TOMATOES_EMA_ALPHA
            stored[ema_key] = alpha * mid_price + (1 - alpha) * stored[ema_key]
        else:
            stored[ema_key] = mid_price

        fair = stored[ema_key]

        # ── PHASE 1: TAKE (edge ≥ 2 ticks and > spread/2 vs fair) ──────
        remaining_buy = limit - position

        if len(order_depth.sell_orders) > 0:
            for ask_price in sorted(order_depth.sell_orders.keys()):
                edge = fair - ask_price
                if ask_price < fair and edge >= min_edge and remaining_buy > 0:
                    ask_vol = -order_depth.sell_orders[ask_price]
                    take_qty = min(ask_vol, remaining_buy, self.MAX_ORDER_SIZE)
                    orders.append(Order(product, ask_price, take_qty))
                    remaining_buy -= take_qty

        remaining_sell = limit + position

        if len(order_depth.buy_orders) > 0:
            for bid_price in sorted(order_depth.buy_orders.keys(), reverse=True):
                edge = bid_price - fair
                if bid_price > fair and edge >= min_edge and remaining_sell > 0:
                    bid_vol = order_depth.buy_orders[bid_price]
                    take_qty = min(bid_vol, remaining_sell, self.MAX_ORDER_SIZE)
                    orders.append(Order(product, bid_price, -take_qty))
                    remaining_sell -= take_qty

        # ── PHASE 2: MAKE ──────────────────────────────────────────────
        position_after_takes = position
        for o in orders:
            position_after_takes += o.quantity

        buy_capacity = limit - position_after_takes
        sell_capacity = limit + position_after_takes

        # Inventory skew
        skew = round(position_after_takes * self.INVENTORY_SKEW / limit)

        bid_price = math.floor(fair) - self.TOMATOES_SPREAD - skew
        ask_price = math.ceil(fair) + self.TOMATOES_SPREAD - skew

        if buy_capacity > 0:
            orders.append(
                Order(product, int(bid_price), min(buy_capacity, self.MAX_ORDER_SIZE))
            )

        if sell_capacity > 0:
            orders.append(
                Order(product, int(ask_price), -min(sell_capacity, self.MAX_ORDER_SIZE))
            )

        return orders

    # ══════════════════════════════════════════════════════════════════
    #  HELPER METHODS
    # ══════════════════════════════════════════════════════════════════

    def _min_take_edge_ticks(self, spread: int) -> int:
        """
        Minimum edge (in ticks) required to lift an offer or hit a bid:
        at least 2 ticks, and strictly more than half the top-of-book spread
        (integer-tick form of edge > spread/2).
        """
        half_spread_edge = spread // 2 + 1
        return max(2, half_spread_edge)

    def _get_mid_price(self, order_depth: OrderDepth):
        """
        Simple midpoint of best bid and best ask.
        Returns None if either side is empty.
        """
        if not order_depth.buy_orders or not order_depth.sell_orders:
            return None
        best_bid = max(order_depth.buy_orders.keys())
        best_ask = min(order_depth.sell_orders.keys())
        return (best_bid + best_ask) / 2.0

    def _load_state(self, traderData: str) -> dict:
        """
        Deserialize persisted state from the traderData string.
        Returns an empty dict if no state exists yet (first tick).
        """
        if traderData and traderData.strip():
            try:
                return jsonpickle.decode(traderData)
            except Exception:
                return {}
        return {}

    def _save_state(self, stored: dict) -> str:
        """
        Serialize state to a string for persistence to next tick.
        Keep this small — there's a log size limit.
        """
        return jsonpickle.encode(stored)
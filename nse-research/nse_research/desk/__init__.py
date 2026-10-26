"""Trading desk: eleven research and paper-trading tools built on the
existing analysis engine.

    scanner      many charts -> patterns and setups, ranked
    news         headlines per stock, tagged by event type
    entry        are the entry rules met today, and at what price
    exits        stop, targets, trailing stop and time stop
    timemachine  replay the rules on history, then Monte Carlo the odds
    risk         position size and portfolio limits
    budget       capital, cash reserve and loss limits
    orders       paper broker by default; live only with explicit confirmation
    alerts       price and rule alerts, with free push notifications
    earnings     reported results from SEC filings and the price reaction
    congress     US House members' trade disclosures (the "Pelosi tracker")

Every output is research, not advice. Backtests and simulations estimate odds
from the past; they cannot guarantee a profit.
"""

DISCLAIMER = (
    "Research and paper trading only. Not financial advice. Backtests and "
    "simulations estimate odds from past data and cannot guarantee profit."
)

"""Fixed wording shown wherever data or a conclusion is displayed.

Keeping the strings in one place stops the UI and the API from drifting into
softer wording (for example calling end-of-day data "live").
"""

SOURCE_TAPETIDE = "Tapetide (secondary source)"
SOURCE_NSE = "NSE (primary source)"
CALCULATED = "CALCULATED FROM OHLCV DATA"

DATA_NOT_AVAILABLE = "DATA NOT AVAILABLE"
SOURCE_UNAVAILABLE = "DATA SOURCE UNAVAILABLE"
NOT_AVAILABLE_WITH_SOURCE = "NOT AVAILABLE WITH CURRENT DATA SOURCE"
NO_SIGNAL_DATA = "NO SIGNAL — DATA QUALITY/FRESHNESS INSUFFICIENT"
NOT_BACKTESTED = "NOT YET BACKTESTED"
CLASSIFICATION_PENDING = (
    "NOT AVAILABLE — research classification needs regime, news and "
    "validated strategies, which are not built yet"
)

FREQUENCY_EOD = "End-of-day (daily bars)"

DISCLAIMER = (
    "Research and paper trading only. Not financial advice. This tool is not a "
    "SEBI-registered research analyst or investment adviser."
)

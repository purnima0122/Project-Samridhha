"""Factory to create the appropriate data provider based on configuration."""

from config import Config
from providers.base import DataProvider
from providers.simulator import SimulatorProvider


def create_provider() -> DataProvider:
    """Create and return the configured data provider.

    Reads DATA_PROVIDER from config:
        - "simulator" (default): Uses the simulation engine
        - "nepse": Uses the live NEPSE API (not yet implemented)
    """
    provider_type = Config.DATA_PROVIDER.lower()

    if provider_type == "simulator":
        return SimulatorProvider()
    elif provider_type == "nepse":
        from providers.nepse_api import NepseApiProvider
        return NepseApiProvider()
    else:
        raise ValueError(
            f"Unknown DATA_PROVIDER: '{provider_type}'. "
            f"Supported: 'simulator', 'nepse'"
        )

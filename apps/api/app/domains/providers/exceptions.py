"""Provider exception hierarchy."""


class ProviderError(Exception):
    """Base provider error."""
    retryable: bool = False


class ProviderTimeoutError(ProviderError):
    """Provider timed out."""
    retryable = True


class ProviderAuthenticationError(ProviderError):
    """Bad API key."""
    retryable = False


class ProviderRateLimitError(ProviderError):
    """Rate limited."""
    retryable = True

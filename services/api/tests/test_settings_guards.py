from __future__ import annotations

import pytest
from django.core.exceptions import ImproperlyConfigured

from accesosen_api.base import _validate_runtime_database_guard


def test_rejects_supabase_pooler_5432_in_production() -> None:
    with pytest.raises(ImproperlyConfigured, match="port 5432"):
        _validate_runtime_database_guard(
            django_env="production",
            host="aws-0-us-west-2.pooler.supabase.com",
            port="5432",
            use_pgbouncer=True,
        )


def test_allows_same_host_in_non_production() -> None:
    _validate_runtime_database_guard(
        django_env="development",
        host="aws-0-us-west-2.pooler.supabase.com",
        port="5432",
        use_pgbouncer=True,
    )

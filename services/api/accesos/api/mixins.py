from __future__ import annotations

from accesos.domain.services.authorization import AuthorizationService


class ScopedQuerysetMixin:
    """
    Forces server-side queryset scoping based on role memberships.
    """

    scope_resource: str | None = None

    def apply_scope(self, qs):
        resource = str(self.scope_resource or "").strip()
        if not resource:
            return qs
        return AuthorizationService.scoped_queryset(self.request.user, qs, resource=resource)


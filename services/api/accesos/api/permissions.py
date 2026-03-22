from __future__ import annotations

import json
from collections.abc import Iterable, Mapping

from django.utils import timezone
from rest_framework.permissions import BasePermission

from accesos.domain.services.authorization import AuthorizationService
from accesos.models import ControlPanelSession, Sede, Turno, Usuario


def _request_ip(request) -> str:
    forwarded = str(request.META.get("HTTP_X_FORWARDED_FOR", "") or "").strip()
    if forwarded:
        return forwarded.split(",")[0].strip()
    return str(request.META.get("REMOTE_ADDR", "") or "").strip()


def _request_user_agent(request) -> str:
    return str(request.META.get("HTTP_USER_AGENT", "") or "").strip()


def _request_mapping_sources(request) -> list[Mapping]:
    sources: list[Mapping] = []

    data = None
    if hasattr(request, "data"):
        try:
            data = request.data
        except Exception:
            data = None
    if isinstance(data, Mapping):
        sources.append(data)

    post_data = getattr(request, "POST", None)
    if isinstance(post_data, Mapping):
        sources.append(post_data)

    query_params = getattr(request, "query_params", None)
    if isinstance(query_params, Mapping):
        sources.append(query_params)
    elif isinstance(getattr(request, "GET", None), Mapping):
        sources.append(request.GET)

    if data is None:
        raw_body = getattr(request, "body", b"") or b""
        content_type = str(getattr(request, "content_type", "") or getattr(request, "META", {}).get("CONTENT_TYPE", "") or "")
        if raw_body and "json" in content_type.lower():
            try:
                parsed = json.loads(raw_body.decode("utf-8"))
            except (ValueError, UnicodeDecodeError):
                parsed = None
            if isinstance(parsed, Mapping):
                sources.append(parsed)

    return sources


def _iter_source_values(source: Mapping, name: str) -> Iterable:
    if hasattr(source, "getlist"):
        values = source.getlist(name)
        if values:
            return values
    if name in source:
        return [source.get(name)]
    return []


def _request_values(request, names: Iterable[str]) -> list:
    values: list = []
    for source in _request_mapping_sources(request):
        for name in names:
            values.extend(_iter_source_values(source, name))
    return values


def _flatten_values(values: Iterable) -> list:
    flattened: list = []
    for value in values:
        if value in (None, ""):
            continue
        if isinstance(value, (list, tuple, set, frozenset)):
            flattened.extend(_flatten_values(value))
            continue
        flattened.append(value)
    return flattened


def _resolve_sede_ids(values: Iterable) -> set[int]:
    resolved: set[int] = set()
    raw_values = _flatten_values(values)
    if not raw_values:
        return resolved

    int_ids = [int(str(value).strip()) for value in raw_values if str(value).strip().isdigit()]
    if int_ids:
        resolved.update(Sede.objects.filter(id__in=int_ids).values_list("id", flat=True))

    codes = [str(value).strip() for value in raw_values if str(value).strip() and not str(value).strip().isdigit()]
    if codes:
        matched_codes = Sede.objects.filter(code__in=codes)
        resolved.update(matched_codes.values_list("id", flat=True))
        matched_lower = {str(code).strip().lower() for code in matched_codes.values_list("code", flat=True)}
        unresolved_codes = {code.lower() for code in codes} - matched_lower
        for unresolved_code in unresolved_codes:
            resolved.update(Sede.objects.filter(code__iexact=unresolved_code).values_list("id", flat=True))

    return {int(value) for value in resolved}


def _resolve_turno_sede_ids(values: Iterable) -> set[int]:
    turno_ids = [int(str(value).strip()) for value in _flatten_values(values) if str(value).strip().isdigit()]
    if not turno_ids:
        return set()
    return {int(value) for value in Turno.objects.filter(id__in=turno_ids).values_list("sede_id", flat=True) if value is not None}


def _resolve_usuario_sede_ids(values: Iterable) -> set[int]:
    user_ids = [int(str(value).strip()) for value in _flatten_values(values) if str(value).strip().isdigit()]
    if not user_ids:
        return set()
    resolved: set[int] = set()
    for user in Usuario.objects.filter(id__in=user_ids):
        resolved.update(AuthorizationService.allowed_sede_ids(user))
    return resolved


def _requested_sede_ids(request) -> set[int]:
    candidate_sede_ids = set()
    candidate_sede_ids.update(_resolve_sede_ids(_request_values(request, ["sede_id", "sede", "sede_principal"])))
    candidate_sede_ids.update(_resolve_turno_sede_ids(_request_values(request, ["turno_id", "turno"])))
    candidate_sede_ids.update(
        _resolve_usuario_sede_ids(
            _request_values(
                request,
                [
                    "usuario",
                    "usuario_id",
                    "aprendiz_id",
                    "propietario",
                    "propietario_id",
                    "guarda",
                    "guarda_id",
                    "registrado_por",
                    "registrado_por_id",
                    "user",
                    "user_id",
                ],
            )
        )
    )
    return candidate_sede_ids


def _requested_role_codes(request) -> set[str]:
    return {
        AuthorizationService._normalize_role_code(value)
        for value in _flatten_values(_request_values(request, ["rol", "role", "role_code", "target_role", "new_role"]))
        if AuthorizationService._normalize_role_code(value)
    }


def _violates_admin_sede_policy(request, perm_code: str, *, obj=None) -> bool:
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if AuthorizationService.is_superadmin(user):
        return False
    if AuthorizationService.runtime_role_for_user(user) != AuthorizationService.ADMIN_SEDE_CODE:
        return False

    if AuthorizationService.is_admin_only_permission(perm_code):
        return True

    if not str(perm_code or "").startswith("user."):
        return False

    requested_roles = _requested_role_codes(request)
    existing_role = getattr(obj, "rol", None) if obj is not None else None
    if not requested_roles:
        return not AuthorizationService.can_admin_sede_mutate_role(
            user,
            requested_role_code=None,
            existing_role_code=existing_role,
        )

    return not all(
        AuthorizationService.can_admin_sede_mutate_role(
            user,
            requested_role_code=role_code,
            existing_role_code=existing_role,
        )
        for role_code in requested_roles
    )


def resolve_control_panel_session(request):
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return None

    raw_id = str(request.META.get("HTTP_X_CONTROL_PANEL_SESSION", "") or "").strip()
    if not raw_id:
        return None

    session = (
        ControlPanelSession.objects.filter(
            id=raw_id,
            user=user,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
        )
        .order_by("-granted_at")
        .first()
    )
    if session is None:
        return None

    request_ip = _request_ip(request)
    request_user_agent = _request_user_agent(request)
    if session.ip_address and request_ip and session.ip_address != request_ip:
        return None
    if session.user_agent and request_user_agent and session.user_agent != request_user_agent:
        return None

    request.control_panel_session = session
    if (timezone.now() - session.last_used_at).total_seconds() >= 30:
        session.last_used_at = timezone.now()
        session.save(update_fields=["last_used_at"])
    return session


class RequiresPermission(BasePermission):
    """
    Generic permission checker backed by AuthorizationService.

    View configuration:
    - permission_map: dict[action, perm_code]
    - object_permission_map: optional dict[action, perm_code]
    """

    def _action(self, view) -> str:
        return str(getattr(view, "action", "") or "").strip()

    def _allow_own_without_object(self, view, action: str) -> bool:
        allowed = getattr(view, "allow_own_scope_actions", set())
        if isinstance(allowed, (list, tuple, set)):
            return action in allowed
        return False

    def _perm_for_action(self, view, *, object_level: bool = False) -> str | None:
        action = self._action(view)
        if not action:
            return None
        source = getattr(view, "object_permission_map", {}) if object_level else getattr(view, "permission_map", {})
        if not isinstance(source, dict):
            return None
        code = source.get(action)
        if not code and object_level:
            code = getattr(view, "permission_map", {}).get(action)
        return str(code).strip() if code else None

    def has_permission(self, request, view) -> bool:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False

        action = self._action(view)
        if not isinstance(getattr(view, "permission_map", None), dict):
            # Fail secure: permission map is mandatory.
            return False
        perm_code = self._perm_for_action(view, object_level=False)
        if not perm_code:
            return False
        if _violates_admin_sede_policy(request, perm_code):
            return False

        requested_sede_ids = _requested_sede_ids(request)
        enforce_requested_scope = str(getattr(request, "method", "") or "").upper() not in {"GET", "HEAD", "OPTIONS"}
        scoped_sede_ids = requested_sede_ids if enforce_requested_scope else set()
        if action and self._allow_own_without_object(view, action) and not scoped_sede_ids:
            return AuthorizationService.has_perm(user, perm_code, obj=user)
        return AuthorizationService.has_perm(user, perm_code, sede=scoped_sede_ids or None)

    def has_object_permission(self, request, view, obj) -> bool:
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False

        if not isinstance(getattr(view, "permission_map", None), dict):
            return False
        perm_code = self._perm_for_action(view, object_level=True)
        if not perm_code:
            return False
        if _violates_admin_sede_policy(request, perm_code, obj=obj):
            return False

        requested_sede_ids = _requested_sede_ids(request)
        return AuthorizationService.has_perm(user, perm_code, sede=requested_sede_ids or None, obj=obj)


class RequiresControlPanelSession(BasePermission):
    message = "Se requiere una sesion reforzada vigente del panel de control."

    def has_permission(self, request, view) -> bool:
        return resolve_control_panel_session(request) is not None

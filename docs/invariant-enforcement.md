# Invariant Enforcement

Estado actual de endurecimiento de invariantes criticos en SADI.

## Invariantes

| Invariante | Mecanismo principal | Cobertura |
| --- | --- | --- |
| Maximo 4 equipos por aprendiz | Trigger DB en PostgreSQL (`0017_hardening_constraints_and_soft_delete`) + guardia de modelo `Equipo.clean()` | Tests de modelo y prueba raw SQL en PostgreSQL |
| Un solo turno activo por guarda | `UniqueConstraint` parcial sobre `Turno(guarda)` cuando `activo=true` y `fin is null` | Test de `IntegrityError` |
| `Turno.fin >= Turno.inicio` | `CheckConstraint` | Test de `IntegrityError` |
| `Acceso.sede == Turno.sede` cuando hay turno | Trigger DB en PostgreSQL (`0027_access_invariants_hardening`) + validacion de modelo `Acceso.clean()` | Tests de modelo y prueba raw SQL en PostgreSQL |
| No usar turno inactivo en `Acceso` | Trigger DB en PostgreSQL (`0027_access_invariants_hardening`) + validacion de modelo `Acceso.clean()` | Test de modelo y prueba raw SQL en PostgreSQL |
| No acceso sin turno activo cuando la politica lo exige | Regla de servicio/view usando `SedePolicy.access_requires_active_turno` | Tests de API para flujo de guarda |
| Aislamiento por sede en operaciones sensibles | `AuthorizationService.scoped_queryset`, permisos explicitos y checks por sede en endpoints mutantes | Tests de API por alcance y cross-sede |

## Notas

- El hard-cap no negociable sigue siendo `4` equipos por aprendiz. Si una sede configura un valor menor en `SedePolicy.max_equipos_aprendiz`, esa politica aplica adicionalmente en la capa de aplicacion.
- Las invariantes que dependen de politica por sede siguen necesitando enforcement en servicio porque la base no conoce el contexto de actor ni la semantica operacional completa.

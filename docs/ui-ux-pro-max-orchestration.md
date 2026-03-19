# UI UX Pro Max Orchestration for SADI

Use `ui-ux-pro-max` as the lead skill for any frontend task that changes how SADI looks, feels, or is interacted with.

## Lead Skill

- `ui-ux-pro-max`
  Use first for page structure, visual direction, typography, color systems, responsive behavior, accessibility priorities, and UX review.

## Recommended Support Skills

- `frontend-design`
  Use after `ui-ux-pro-max` when implementing or refactoring complete pages in React/Next.js.

- `accessibility-auditor`
  Use after implementation to verify keyboard access, contrast, semantics, focus states, and WCAG issues.

- `responsive-web-design`
  Use when a screen has dense data, multi-column layouts, or mobile/desktop divergence.

- `shadcn-ui`
  Use when the implementation needs reusable UI primitives, dialogs, tables, forms, and consistent component patterns.

- `table-builder`
  Use for access logs, equipos, turnos, and admin list views with filters, sorting, empty states, and actions.

- `form-wizard-builder`
  Use for multi-step onboarding or profile flows.

- `state-ux-flow-builder`
  Use for loading, empty, success, and error states in dashboards and operational screens.

## SADI Defaults

- Prioritize mobile-first layouts for `Guarda` workflows.
- Keep QR scan, access registration, and shift actions one tap away where possible.
- Use high-contrast surfaces and clear success/error states for operational use.
- Favor fast forms over decorative layouts.
- Preserve backend-driven RBAC in UI copy and affordances; never imply cross-sede access.
- Treat `Admin_Sede` screens as dense operational views and `Aprendiz` screens as simpler self-service flows.

## Suggested Workflow

1. Run `ui-ux-pro-max` first to choose design direction and UX rules.
2. Implement with `frontend-design` or `shadcn-ui`, depending on whether the task is page-level or component-level.
3. Apply `responsive-web-design` if the screen has tablet/desktop variants.
4. Finish with `accessibility-auditor` and `state-ux-flow-builder`.

## Prompt Starters

- `Usa ui-ux-pro-max para rediseñar el dashboard de Admin_Sede con enfoque operativo y responsive.`
- `Usa ui-ux-pro-max + table-builder para mejorar la tabla de accesos con filtros, estados vacíos y acciones claras.`
- `Usa ui-ux-pro-max + shadcn-ui para rehacer el formulario de registro de equipos del Aprendiz.`
- `Usa ui-ux-pro-max + accessibility-auditor para revisar contraste, foco y navegación por teclado de la app web.`

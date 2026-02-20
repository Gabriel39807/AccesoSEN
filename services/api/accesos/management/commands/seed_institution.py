from __future__ import annotations

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accesos.models import Sede
from core.institution_settings import DEFAULT_SEDES_PROFILE


GENERIC_SEDES = [
    {"code": "sede-1", "name": "Sede 1"},
    {"code": "sede-2", "name": "Sede 2"},
    {"code": "sede-3", "name": "Sede 3"},
    {"code": "sede-4", "name": "Sede 4"},
]

SENA_SEDES = [
    {"code": "cegafe", "name": "CEGAFE"},
    {"code": "santa-clara", "name": "SANTA CLARA"},
    {"code": "itedris", "name": "ITEDRIS"},
    {"code": "gastronomia", "name": "GASTRONOMIA"},
]


class Command(BaseCommand):
    help = "Crea/actualiza sedes segun un perfil institucional (generic|sena)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--profile",
            choices=["generic", "sena"],
            default=DEFAULT_SEDES_PROFILE if DEFAULT_SEDES_PROFILE in {"generic", "sena"} else "generic",
            help="Perfil de sedes a sembrar.",
        )
        parser.add_argument(
            "--deactivate-others",
            action="store_true",
            help="Desactiva sedes que no esten en el perfil seleccionado.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        profile = options["profile"]
        deactivate_others = bool(options["deactivate_others"])

        if profile == "generic":
            seed_rows = GENERIC_SEDES
        elif profile == "sena":
            seed_rows = SENA_SEDES
        else:
            raise CommandError("Perfil invalido.")

        active_codes = set()
        created = 0
        updated = 0

        for row in seed_rows:
            active_codes.add(row["code"])
            sede, was_created = Sede.objects.update_or_create(
                code=row["code"],
                defaults={
                    "name": row["name"],
                    "is_active": True,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1

        deactivated = 0
        if deactivate_others:
            deactivated = Sede.objects.exclude(code__in=active_codes).filter(is_active=True).update(is_active=False)

        self.stdout.write(
            self.style.SUCCESS(
                f"Perfil '{profile}' aplicado. creadas={created}, actualizadas={updated}, desactivadas={deactivated}."
            )
        )

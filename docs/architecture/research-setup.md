# Physical Research setup (2026-10-22)

Production now supplies a separate full32 physical Research catalog from baseGameScannedTokenEncounters. START_GAME validates all canonical IDs and their four printed decks before random use, then shuffles only the selected Ancient One's eight physical cards. This creates hidden decks for Shub-Niggurath and Yog-Sothoth even though their instruction trees remain untranscribed. No Research card is drawn or revealed at setup.

The pure engine accepts optional GameContent.researchEncounterSetup. Configured catalogs must contain all32 known unique IDs; malformed or sparse catalogs reject instead of falling back. Selected shuffle output must conserve the exact eight. The setup checkpoint rolls back retained random input across any rejected setup, including downstream Spell setup. Callers omitting the optional field retain the previous rule-derived fixture behavior. No new package or protocol/Schema field is introduced.

Two-client tests cover all four choices, exact private order restoration, peer privacy and atomic refusal of unsupported actual Shub/Yog tops. Scanned fronts do not imply executable effects; readiness stays incomplete and no top is skipped. Research inventory/continuation restoration integrity, physical discard/recycle and origin-marker binding remain separate follow-ups. Location completion also retains bottom cycling.

Spec and execution journal: docs/superpowers/specs/2026-10-22-research-setup-design.md and docs/superpowers/plans/2026-10-22-research-setup.md.

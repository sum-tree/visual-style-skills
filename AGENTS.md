# Repository instructions

## Skill boundaries

- Keep every style under `skills/<skill-name>/` and make that directory independently installable.
- A skill must not import runtime files from another skill or from a repository-level shared directory.
- Preserve the invariant that the original-photo region is composed deterministically from the untouched source file; image generation may produce only the effect region.
- Keep batch input and output one-to-one and preserve upload order. Never combine unrelated source photos on one canvas.

## Validation

- Run the bundled Skill Creator `quick_validate.py` against every changed skill directory.
- Run the bundled Plugin Creator `validate_plugin.py` against the repository root.
- Run every changed `compose_comparison.py` with both portrait and landscape fixtures outside the repository, and verify that an aspect-ratio mismatch above 0.5% is rejected.
- Do not commit generated comparison images, temporary effects, or packaged ZIP files.

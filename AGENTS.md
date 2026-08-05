# Repository workflow

## npm release handoff

- Prepare package releases completely before handoff: version bumps, dependency
  alignment, documentation, tests, builds, compatibility checks, and
  `npm pack --dry-run` validation.
- When the Atlas default release changes, publish and verify its immutable
  catalog and model assets before handing off npm commands.
- Do not perform npm authentication or the final npm publish operation. The
  repository maintainer runs those commands interactively.
- Always publish the Viewer package before the Atlas package because Atlas may
  declare a peer dependency on the new Viewer version.
- Give the maintainer these root-level commands at release time:

  ```bash
  npm login
  npm whoami
  npm publish --workspace @vixotic/vanatome-react --access public --provenance=false
  npm publish --workspace @vixotic/vanatome-atlas --access public --provenance=false
  ```

- Local terminal publishing must explicitly disable provenance because automatic
  provenance generation requires a supported CI provider. CI release workflows
  may retain each package's `publishConfig.provenance` setting.

- Include package-version verification commands in the handoff so the
  maintainer can confirm both registry releases.

# SAQR Phase 2 UI-Safe Workflow Integration Plan

Date: 2026-04-07
Scope: `P2-109`

## Purpose

This document closes `P2-109` by defining how Phase 2 workflow capabilities may be integrated into SAQR without compromising the approved UI/UX baseline.

This is a control document, not a UI change authorization.

## Current Position

The Phase 1 UI baseline remains frozen under:

- `apps/shield-ui/ui-baseline.manifest.json`
- `docs/SAQR_Phase1_UI_Freeze_and_Regression_Guardrails.md`

The default Phase 2 posture remains:

- backend-first
- no visible UI change approved
- no baseline refresh approved
- demo and production-ready runtimes both preserved

## Integration Policy

### Default Mode

Phase 2 workflow integration must stay in `backend_only` mode unless a separate written approval is granted.

That means Phase 2 work may freely extend:

- `services/workflow-engine/**`
- `apps/api/**`
- `shared/**`
- `fixtures/**`
- `tools/**`
- `docs/**`
- workflow contracts and delivery artifacts

without requesting UI approval, as long as no tracked UI baseline file is modified.

### UI-Safe Rule

No tracked file listed in `apps/shield-ui/ui-baseline.manifest.json` may be changed as part of normal Phase 2 workflow delivery.

If a Phase 2 capability can be completed through:

- engine changes
- API changes
- response-shape additions
- runtime flags outside tracked UI baseline files
- delivery documentation

then that path must be taken instead of touching the UI.

## Candidate Integration Surface Map

The purpose of this map is to rank future touchpoints by risk. It does not grant permission to change them.

| Tier | Meaning | Paths | Policy |
|---|---|---|---|
| `Tier 0` | Safe without UI approval if behavior remains non-visual | `services/workflow-engine/**`, `apps/api/**`, `shared/**`, `docs/**`, `fixtures/**`, `tools/**`, `apps/shield-ui/runtime-config*.js` | Allowed |
| `Tier 1` | Lowest-risk future UI touchpoints if a minimal approved integration becomes unavoidable | `apps/shield-ui/WorkflowManager.js`, `apps/shield-ui/Dispatcher.js`, `apps/shield-ui/SessionArchitect.js` | Approval required |
| `Tier 2` | High-risk tracked UI shell or visual-system files | `apps/shield-ui/app.js`, `apps/shield-ui/index.html`, `apps/shield-ui/GatewaySelector.html`, `apps/shield-ui/styles.css`, `apps/shield-ui/SettingsModal.js`, `apps/shield-ui/CourtReadyReport.js` | Approval required, last resort only |

## Explicitly Prohibited Without Separate Approval

The following are not allowed under the default Phase 2 posture:

- adding new pages, dashboards, tabs, or navigation items
- changing typography, color system, spacing, layout hierarchy, or visual density
- changing labels, headings, workflow copy, or button language
- introducing workflow administration screens
- exposing new workflow panels, boards, committee views, or approval modals
- refreshing `apps/shield-ui/ui-baseline.manifest.json`

## Approved Integration Sequence

If Phase 2 workflow features need to move closer to the UI, they must follow this order:

1. Add backend runtime capability first.
2. Publish service and API contracts first.
3. Confirm that the delivery use case cannot be satisfied through backend or API work alone.
4. Use the approval gate in `docs/checklists/SAQR_Phase2_UI_Approval_Gate.md`.
5. Limit any approved UI work to the smallest possible tracked-file surface.
6. Review the result in both demo and production-ready runtimes.
7. Refresh the UI baseline only after explicit written approval is recorded.

## Approval Gate Requirements

Any proposed UI touch for Phase 2 workflow work must include all of the following:

- business reason for the UI change
- proof that backend-only delivery is insufficient
- exact list of tracked files to be changed
- expected user-visible impact
- before screenshots
- after screenshots or wireframes
- demo-runtime review evidence
- production-ready-runtime review evidence
- successful `npm --prefix apps/shield-ui run ui:baseline:check` before and after review
- explicit written sign-off before any baseline refresh

The working approval artifact is:

- `docs/checklists/SAQR_Phase2_UI_Approval_Gate.md`

The machine-readable contract for this control is:

- `docs/contracts/saqr-workflow-ui-integration.yaml`

## Delivery-Team Interpretation

The delivery team should read this plan bluntly:

- Phase 2 does not currently authorize any visible UI workflow integration.
- Existing UI guardrails remain fully active.
- Any future UI work is exception-based, not roadmap-default behavior.
- The first acceptable exposure path for workflow capabilities remains API and backend contract delivery, not interface redesign.

## Exit Condition for P2-109

`P2-109` is complete when:

- the no-change default is explicit
- candidate touchpoints are ranked by risk
- the approval gate is documented
- the machine-readable control file exists
- the UI baseline still passes unchanged

## Verification

Commands used:

```powershell
npm --prefix apps/shield-ui run ui:baseline:check
python - <<'PY'
from pathlib import Path
import yaml
yaml.safe_load(Path('docs/contracts/saqr-workflow-ui-integration.yaml').read_text(encoding='utf-8'))
print('parsed docs/contracts/saqr-workflow-ui-integration.yaml')
PY
```

## References

- Phase 1 UI guardrails: `docs/SAQR_Phase1_UI_Freeze_and_Regression_Guardrails.md`
- Phase 2 roadmap: `docs/SAQR_Phase2_Roadmap.md`
- Phase 2 tracker: `docs/SAQR_Phase_1_Phase_2_Tracker.md`
- Workflow audit model: `docs/SAQR_Phase2_Workflow_Audit_Model.md`

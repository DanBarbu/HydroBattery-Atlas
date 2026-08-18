# Invalid: high-risk AI in loop without conformity reference

**Invariant:** every `ai_models_in_loop` entry whose ADR-020 registry entry is classified `ai_act_risk_class = HIGH_RISK` must carry an `ai_act_conformity_ref` on the envelope.

**What the admission service must catch:** the envelope references model `8f3c2b1d-…` at version `2.1.0`, purpose `TARGET_CLASS_MATCH`, but provides no `ai_act_conformity_ref`. The admission service looks up the model in the ADR-020 registry; if the registry entry is `HIGH_RISK`, the envelope is refused for missing conformity linkage.

**Why the invariant exists:** DEA envelopes are the point at which an AI's output can influence a kinetic outcome. The EU AI Act conformity file is the human-legible record of how the model was assessed for that role. If the envelope cannot cite it, the audit trail from shot → model → conformity → training data → responsible engineer is broken at commitment time — long before the shot happens.

This is the machine-checked back-end of `will-compliance-officer`'s process: an envelope that would have failed conformity review at draft time is refused, not delegated to human review at post-action time.

**Not catchable by JSON Schema alone:** JSON Schema allows `ai_act_conformity_ref` to be optional (some models are `LIMITED` or `MINIMAL` risk and don't need one). The requirement is conditional on the registry entry's classification, which JSON Schema cannot see. This is a consumer-side admission check (`TestDEAInvariants` case 4).

**Correct fix:** add the field, referencing the model's conformity assessment record:
```json
{
  "model_id": "8f3c2b1d-4e5a-6b7c-8d9e-0a1b2c3d4e5f",
  "version": "2.1.0",
  "purpose": "TARGET_CLASS_MATCH",
  "ai_act_conformity_ref": "ROU-AIACT-2026-M014"
}
```
If no conformity record exists yet, the model is not ready for in-loop use and must not be referenced by a DEA envelope. It may still be used advisory-only outside the DEA loop.

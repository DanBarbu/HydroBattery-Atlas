# OPA Gatekeeper policy — every WILL container image must carry a Cosign
# signature verifiable against a trusted public key.
#
# Sprint 2 ships the policy skeleton; Sprint 4 wires it to the cluster
# admission webhook with a real key reference (Vault-managed).
package kubernetes.admission

deny[msg] {
    input.request.kind.kind == "Pod"
    container := input.request.object.spec.containers[_]
    not signed(container.image)
    msg := sprintf("image %q is not signed by an approved Cosign key", [container.image])
}

# `signed` is implemented at apply time by Gatekeeper's `image-signature`
# external data provider. Sprint 4 wires this; Sprint 2 leaves the rule
# explicit so reviewers can see the contract.
signed(image) {
    image == "trusted-allowlist-placeholder"
}

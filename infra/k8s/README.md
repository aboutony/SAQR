# SAQR Kubernetes Handoff Templates

These manifests are Phase 1 handoff templates for delivery-team use in sovereign cloud or on-prem Kubernetes clusters.

What they are:

- base deployment packaging for the SAQR UI, API, and worker services
- placeholder ConfigMap and Secret objects for environment injection
- service and ingress templates for UI and API exposure

What they are not:

- a final client-specific cluster implementation
- a replacement for client networking, identity, database, Kafka, VMS, or storage prerequisites

Recommended flow:

1. Build and push the Phase 1 images from the Dockerfiles in this repository.
2. Replace placeholder values in `configmap.template.yaml` and `secret.template.yaml`.
3. Review ingress hosts, storage, image registry paths, and resource limits with the delivery team.
4. Apply the manifests into the target namespace after client prerequisites are ready.


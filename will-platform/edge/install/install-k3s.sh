#!/usr/bin/env bash
# Sprint 5 — S5-06 — install K3s on rugged edge hardware and deploy the
# WILL edge stack.
#
# Tested on:
#   - Getac S410 with Linux 6.6 (Debian 12)
#   - Dell Latitude 5424 with Linux 6.6 (Ubuntu 22.04)
#   - Romanian-prime panel PCs (TBD per partner)
#
# Profile: rugged on-prem. The cloud and CPG profiles use Helm against an
# existing Kubernetes cluster (see helm/values/).
#
# Usage:
#   sudo EDGE_ID=br2vm-edge-01 \
#        TENANT_ID=00000000-0000-0000-0000-000000000001 \
#        CORE_SYNC_URL=https://core.will.example.ro \
#        WILL_VERSION=$(git describe --tags) \
#        ./install-k3s.sh

set -euo pipefail

EDGE_ID=${EDGE_ID:?EDGE_ID required}
TENANT_ID=${TENANT_ID:?TENANT_ID required}
CORE_SYNC_URL=${CORE_SYNC_URL:?CORE_SYNC_URL required}
WILL_VERSION=${WILL_VERSION:-latest}
IMAGE_REGISTRY=${IMAGE_REGISTRY:-registry.will-platform.ro}
DATA_DIR=${DATA_DIR:-/var/lib/will-edge}

if [ "$(id -u)" -ne 0 ]; then
    echo "[install-k3s] must run as root" >&2
    exit 1
fi

echo "[install-k3s] hostname=$(hostname); kernel=$(uname -r); EDGE_ID=$EDGE_ID"

# 1. Disable swap (K3s requirement) and load required modules.
swapoff -a || true
sed -i.bak '/swap/s/^/#/' /etc/fstab
modprobe overlay
modprobe br_netfilter

# 2. Install K3s in single-node server mode without traefik (we use our own
#    ingress in Sprint 7+); no metrics-server (we observe via Prometheus).
if ! command -v k3s >/dev/null; then
    curl -sfL https://get.k3s.io | \
        INSTALL_K3S_EXEC="--disable=traefik,metrics-server --write-kubeconfig-mode=0644" \
        sh -
fi

systemctl enable --now k3s
sleep 5

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

# 3. Persistent data dir for the edge SQLite cache.
install -d -m 0750 "$DATA_DIR"
chown 65532:65532 "$DATA_DIR"

# 4. Apply WILL edge namespace + edge-agent Deployment + Service.
cat <<EOF | k3s kubectl apply -f -
apiVersion: v1
kind: Namespace
metadata:
  name: will-edge
---
apiVersion: v1
kind: PersistentVolume
metadata:
  name: will-edge-cache
spec:
  capacity:
    storage: 5Gi
  accessModes: ["ReadWriteOnce"]
  storageClassName: local-path
  hostPath:
    path: ${DATA_DIR}
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: will-edge-cache
  namespace: will-edge
spec:
  accessModes: ["ReadWriteOnce"]
  resources: { requests: { storage: 5Gi } }
  storageClassName: local-path
  volumeName: will-edge-cache
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: edge-agent
  namespace: will-edge
spec:
  replicas: 1
  selector: { matchLabels: { app: edge-agent } }
  template:
    metadata: { labels: { app: edge-agent } }
    spec:
      containers:
        - name: edge-agent
          image: ${IMAGE_REGISTRY}/will-edge-agent:${WILL_VERSION}
          ports: [{ containerPort: 8090 }]
          env:
            - { name: HTTP_ADDR,      value: ":8090" }
            - { name: EDGE_ID,        value: "${EDGE_ID}" }
            - { name: TENANT_ID,      value: "${TENANT_ID}" }
            - { name: CORE_SYNC_URL,  value: "${CORE_SYNC_URL}" }
            - { name: CACHE_PATH,     value: "/var/lib/will-edge/cache.db" }
          volumeMounts:
            - { name: cache, mountPath: /var/lib/will-edge }
          readinessProbe: { httpGet: { path: /healthz, port: 8090 }, periodSeconds: 5 }
      volumes:
        - { name: cache, persistentVolumeClaim: { claimName: will-edge-cache } }
---
apiVersion: v1
kind: Service
metadata:
  name: edge-agent
  namespace: will-edge
spec:
  type: NodePort
  selector: { app: edge-agent }
  ports:
    - { port: 8090, targetPort: 8090, nodePort: 30090 }
EOF

echo "[install-k3s] done. edge-agent reachable at http://$(hostname -I | awk '{print $1}'):30090/healthz"

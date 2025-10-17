#!/bin/sh

echo "🚀 Đang khởi tạo Vault demo với đầy đủ tính năng..."

# Đợi Vault sẵn sàng
sleep 5

# ============================================
# 1. ENABLE AUDIT LOG (Yêu cầu: Audit log)
# ============================================
echo "📝 Bật audit log..."
vault audit enable file file_path=/vault/logs/audit.log

# ============================================
# 2. ENABLE SECRETS ENGINES
# ============================================
echo "🔐 Cấu hình secrets engines..."

# KV v2 cho secrets thông thường
vault secrets enable -path=secret kv-v2

# KV v2 cho team secrets (shared)
vault secrets enable -path=team kv-v2

# PKI cho certificates (PEM files)
vault secrets enable -path=pki pki
vault secrets tune -max-lease-ttl=87600h pki

# Generate root CA
vault write -field=certificate pki/root/generate/internal \
    common_name="Demo Root CA" \
    ttl=87600h > /tmp/root_ca.crt

vault write pki/config/urls \
    issuing_certificates="http://vault:8200/v1/pki/ca" \
    crl_distribution_points="http://vault:8200/v1/pki/crl"

# ============================================
# 3. TẠO POLICIES (Yêu cầu: Phân quyền)
# ============================================
echo "👮 Tạo policies phân quyền..."

# Admin Policy - Full quyền
cat > /tmp/admin-policy.hcl <<EOF
# Full access to all secrets
path "secret/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "team/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "pki/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
# Có thể xem audit logs
path "sys/audit" {
  capabilities = ["read", "list", "sudo"]
}
# Backup & snapshot
path "sys/storage/raft/snapshot" {
  capabilities = ["read", "sudo"]
}
EOF
vault policy write admin-policy /tmp/admin-policy.hcl

# Developer Policy - Team dev secrets + read shared
cat > /tmp/dev-policy.hcl <<EOF
# Personal dev secrets (KV v2)
path "secret/data/dev/*" {
  capabilities = ["create", "read", "update", "delete"]
}
# Cho phép list/read metadata để liệt kê key
path "secret/metadata/dev/*" {
  capabilities = ["list", "read"]
}
# Quan trọng: cho phép list chính thư mục dev để UI/CLI liệt kê được
path "secret/metadata/dev" {
  capabilities = ["list", "read"]
}

path "secret/metadata" {
  capabilities = ["list"]
}

# Shared team secrets (read-only) - KV v2
path "team/data/development/*" {
  capabilities = ["read"]
}
path "team/metadata/development/*" {
  capabilities = ["list", "read"]
}
path "team/metadata/development" {
  capabilities = ["list", "read"]
}
path "team/metadata" {
  capabilities = ["list"]
}

# PKI issue
path "pki/issue/dev-role" {
  capabilities = ["create", "update"]
}

EOF
vault policy write dev-policy /tmp/dev-policy.hcl

# Operations Policy - Ops secrets + monitoring
cat > /tmp/ops-policy.hcl <<EOF
# =======================
# Ops secrets (RW)
# =======================
# Data: đọc/ghi/xóa phiên bản
path "secret/data/ops/*" {
  capabilities = ["create", "read", "update", "delete"]
}
# Metadata: liệt kê và đọc metadata
path "secret/metadata/ops/*" {
  capabilities = ["list", "read"]
}
# List chính thư mục 'ops'
path "secret/metadata/ops" {
  capabilities = ["list", "read"]
}

# (khuyến nghị) Để nhìn thấy 'ops' dưới root
path "secret/metadata" {
  capabilities = ["list"]
}

# (tùy chọn) Xóa vĩnh viễn phiên bản (destroy) & xóa toàn bộ key
# path "secret/destroy/ops/*" { capabilities = ["update"] }  # destroy versions
# path "secret/metadata/ops/*" { capabilities = ["delete"] } # delete all versions+metadata

# =======================
# Infrastructure secrets (RO)
# =======================
# Data: chỉ đọc (KHÔNG cần list ở /data)
path "secret/data/infrastructure/*" {
  capabilities = ["read"]
}
# Metadata: liệt kê và đọc metadata
path "secret/metadata/infrastructure/*" {
  capabilities = ["list", "read"]
}
# List chính thư mục 'infrastructure'
path "secret/metadata/infrastructure" {
  capabilities = ["list", "read"]
}

# (khuyến nghị) thấy 'infrastructure' dưới root
path "secret/metadata" {
  capabilities = ["list"]
}

# =======================
# Team ops secrets (RW) - mount 'team' (KV v2)
# =======================
path "team/data/operations/*" {
  capabilities = ["create", "read", "update", "delete"]
}
path "team/metadata/operations/*" {
  capabilities = ["list", "read"]
}
path "team/metadata/operations" {
  capabilities = ["list", "read"]
}
# (khuyến nghị) để thấy 'operations' dưới root của mount 'team'
path "team/metadata" {
  capabilities = ["list"]
}

# (tùy chọn) destroy & delete trên mount 'team'
# path "team/destroy/operations/*" { capabilities = ["update"] }
# path "team/metadata/operations/*" { capabilities = ["delete"] }

EOF
vault policy write ops-policy /tmp/ops-policy.hcl

# Team Lead Policy - Quản lý team secrets
cat > /tmp/teamlead-policy.hcl <<EOF
# Manage team secrets
path "team/data/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "team/metadata/*" {
  capabilities = ["list", "read", "delete"]
}
# Read all secrets để giúp team
path "secret/data/*" {
  capabilities = ["read", "list"]
}
path "secret/metadata/*" {
  capabilities = ["list", "read"]
}
EOF
vault policy write teamlead-policy /tmp/teamlead-policy.hcl

# Read-only Policy - Chỉ xem
cat > /tmp/readonly-policy.hcl <<EOF
path "secret/data/*" {
  capabilities = ["read", "list"]
}
path "secret/metadata/*" {
  capabilities = ["list", "read"]
}
path "team/data/*" {
  capabilities = ["read", "list"]
}
path "team/metadata/*" {
  capabilities = ["list", "read"]
}
EOF
vault policy write readonly-policy /tmp/readonly-policy.hcl

# ============================================
# 4. TẠO USERS (Yêu cầu: User/Group)
# ============================================
echo "👥 Tạo demo users..."

vault auth enable userpass

# Admin user
vault write auth/userpass/users/admin \
    password=admin123 \
    policies=admin-policy \
    token_ttl=8h \
    token_max_ttl=24h

# Team leads
vault write auth/userpass/users/lead1 \
    password=lead123 \
    policies=teamlead-policy \
    token_ttl=8h

# Developers
vault write auth/userpass/users/dev1 \
    password=dev123 \
    policies=dev-policy \
    token_ttl=4h

vault write auth/userpass/users/dev2 \
    password=dev123 \
    policies=dev-policy \
    token_ttl=4h

# Operations
vault write auth/userpass/users/ops1 \
    password=ops123 \
    policies=ops-policy \
    token_ttl=4h

vault write auth/userpass/users/ops2 \
    password=ops123 \
    policies=ops-policy \
    token_ttl=4h

# Guest (read-only)
vault write auth/userpass/users/guest \
    password=guest123 \
    policies=readonly-policy \
    token_ttl=1h

# ============================================
# 5. TẠO DEMO SECRETS
# ============================================
echo "📦 Tạo demo secrets..."

# === Personal Secrets ===
# Database credentials
vault kv put secret/database/mysql \
    host=mysql.example.com \
    port=3306 \
    username=root \
    password='MyS3cr3tP@ssw0rd!' \
    description="Production MySQL Database"

vault kv put secret/database/postgres \
    host=postgres.example.com \
    port=5432 \
    username=postgres \
    password='P0stgr3sS3cr3t!' \
    connection_string='postgresql://postgres:P0stgr3sS3cr3t!@postgres.example.com:5432/mydb'

# API Keys
vault kv put secret/api/stripe \
    api_key='sk_live_51HqLyjWDarjtT1zdp7dcXYZ123' \
    webhook_secret='whsec_prod_abc123def456' \
    environment='production' \
    description="Stripe Payment Gateway"

vault kv put secret/api/aws \
    access_key_id='AKIAIOSFODNN7EXAMPLE' \
    secret_access_key='wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' \
    region='us-east-1' \
    account_id='123456789012'

vault kv put secret/api/github \
    token='ghp_1234567890abcdefghijklmnopqrstuvwxyz' \
    username='companybot' \
    description="GitHub API Personal Access Token"

# SSH Keys
vault kv put secret/ssh/production-server \
    private_key='-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAy8Dbv8prpJ/0kKhlGeJYozo2t60EG8L0561g13R29LvMR5hy
vGZlGJpmn65+A4xHXInJYiPuKzrKUnApeLZ+vw1HocOAZtWK0z3r26uA8kQYOKX9
U1ihOYtNt8vN+S6TU4J/tLRmTm+yIIyj5kHSJc9m/UeXDx8CyfYNGzKVMHRPLsGd
-----END RSA PRIVATE KEY-----' \
    public_key='ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQD...' \
    server='prod-server-01.example.com' \
    username='deploy'

# SSL/TLS Certificates (PEM)
vault kv put secret/ssl/example.com \
    certificate='-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKL0UG+mRkSvMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkFVMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
-----END CERTIFICATE-----' \
    private_key='-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDLwNu/ymukn/SQ
qGUZ4lijOja3rQQbwvTnrWDXdHb0u8xHmHK8ZmUYmmafr...
-----END PRIVATE KEY-----' \
    domain='example.com' \
    expires='2025-12-31'

# === Infrastructure Secrets ===
vault kv put secret/infrastructure/kubernetes \
    api_server='https://k8s.example.com:6443' \
    token='eyJhbGciOiJSUzI1NiIsImtpZCI6IiJ9...' \
    ca_cert='-----BEGIN CERTIFICATE-----
MIICyDCCAbCgAwIBAgIBADANBgkqhkiG9w0BAQsFADAVMRMw...
-----END CERTIFICATE-----'

vault kv put secret/infrastructure/docker-registry \
    url='registry.example.com' \
    username='registry-admin' \
    password='R3g1stryP@ss!' \
    email='admin@example.com'

# === Dev Team Personal Secrets ===
vault kv put secret/dev/dev1-api-keys \
    service='dev-service' \
    api_key='dev1_personal_key_xyz123' \
    environment='development' \
    owner='dev1'

vault kv put secret/dev/dev2-database \
    host='localhost' \
    database='dev2_testdb' \
    username='dev2' \
    password='dev2local'

# === Ops Team Personal Secrets ===
vault kv put secret/ops/monitoring-grafana \
    url='https://grafana.example.com' \
    api_key='glsa_abc123def456ghi789' \
    admin_user='ops-admin' \
    admin_password='Gr@fana123!'

vault kv put secret/ops/monitoring-prometheus \
    url='http://prometheus.example.com:9090' \
    basic_auth_user='prometheus' \
    basic_auth_password='Prom3th3us!'

# ============================================
# 6. TEAM SHARED SECRETS (Không lộ plaintext)
# ============================================
echo "🤝 Tạo team shared secrets..."

# Development Team Shared
vault kv put team/development/staging-db \
    host='staging-db.internal' \
    port=5432 \
    username='staging_user' \
    password='St@g1ngDB2024!' \
    description="Shared staging database - Development team only"

vault kv put team/development/test-api-keys \
    stripe_test_key='sk_test_123456789' \
    aws_test_access='AKIATESTKEY123' \
    aws_test_secret='TestSecretKey123' \
    description="Shared test API keys for development"

# Operations Team Shared
vault kv put team/operations/backup-credentials \
    aws_backup_bucket='company-backups' \
    aws_access_key='AKIABACKUP123' \
    aws_secret_key='BackupS3cr3tK3y!' \
    encryption_key='backup-encryption-key-xyz' \
    description="Backup system credentials - Ops team only"

vault kv put team/operations/monitoring-shared \
    pagerduty_token='pdt_abc123xyz' \
    slack_webhook='https://hooks.slack.com/services/T00/B00/xxx' \
    opsgenie_key='opsgenie-123-abc' \
    description="Shared monitoring alert credentials"

# ============================================
# 7. CONFIGURE PKI FOR CERTIFICATES
# ============================================
echo "🔐 Cấu hình PKI role cho certificates..."

vault write pki/roles/dev-role \
    allowed_domains="dev.example.com" \
    allow_subdomains=true \
    max_ttl="720h" \
    generate_lease=true

vault write pki/roles/prod-role \
    allowed_domains="example.com" \
    allow_subdomains=true \
    max_ttl="8760h" \
    generate_lease=true

# ============================================
# 8. TẠO DEMO CERTIFICATES
# ============================================
echo "📜 Tạo demo certificates..."

# Generate dev certificate
vault write -format=json pki/issue/dev-role \
    common_name="app.dev.example.com" \
    ttl="720h" > /tmp/dev-cert.json

DEV_CERT=$(cat /tmp/dev-cert.json | grep -o '"certificate":"[^"]*' | cut -d'"' -f4)
DEV_KEY=$(cat /tmp/dev-cert.json | grep -o '"private_key":"[^"]*' | cut -d'"' -f4)

# Store certificate in secrets
vault kv put secret/certificates/dev-app \
    certificate="$DEV_CERT" \
    private_key="$DEV_KEY" \
    domain="app.dev.example.com" \
    issued_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ============================================
# 9. TẠO DEMO PEM FILES
# ============================================
echo "📁 Tạo demo PEM files..."

# Generate demo SSH keypair
ssh-keygen -t rsa -b 2048 -f /tmp/demo_ssh_key -N "" -C "demo@vault" > /dev/null 2>&1

vault kv put secret/pem-files/ssh-production \
    content="$(cat /tmp/demo_ssh_key)" \
    public_key="$(cat /tmp/demo_ssh_key.pub)" \
    filename="ssh-production.pem" \
    type="rsa_private_key" \
    size="$(wc -c < /tmp/demo_ssh_key)" \
    fingerprint="$(ssh-keygen -lf /tmp/demo_ssh_key.pub | awk '{print $2}' | cut -c1-16)" \
    description="Production server SSH key" \
    uploaded_by="system" \
    uploaded_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Store SSL certificate from PKI
vault kv put secret/pem-files/ssl-dev-app \
    content="$DEV_CERT" \
    private_key="$DEV_KEY" \
    filename="dev-app.pem" \
    type="certificate" \
    size="$(echo -n "$DEV_CERT" | wc -c)" \
    fingerprint="$(echo -n "$DEV_CERT" | sha256sum | cut -c1-16)" \
    description="Development app SSL certificate from PKI" \
    uploaded_by="system" \
    uploaded_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Create demo RSA keypair for API signing
openssl genrsa -out /tmp/api_private.pem 2048 2>/dev/null
openssl rsa -in /tmp/api_private.pem -pubout -out /tmp/api_public.pem 2>/dev/null

vault kv put secret/pem-files/api-signing-key \
    private_key="$(cat /tmp/api_private.pem)" \
    public_key="$(cat /tmp/api_public.pem)" \
    filename="api-signing-key.pem" \
    type="private_key" \
    size="$(wc -c < /tmp/api_private.pem)" \
    fingerprint="$(openssl rsa -in /tmp/api_private.pem -pubout 2>/dev/null | sha256sum | cut -c1-16)" \
    description="RSA keypair for API request signing" \
    generated_by="system" \
    generated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Cleanup temp files
rm -f /tmp/demo_ssh_key /tmp/demo_ssh_key.pub /tmp/api_private.pem /tmp/api_public.pem

echo "✅ PEM files demo đã được tạo"

echo "✅ Vault khởi tạo hoàn tất!"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📋 THÔNG TIN HỆ THỐNG"
echo "═══════════════════════════════════════════════════════════"
echo "🌐 Vault URL: http://localhost:8200"
echo "🔑 Root Token: root-token-demo"
echo "🎨 Custom UI: http://localhost:8080"
echo "📝 Audit Log: /vault/logs/audit.log"
echo "💾 Backup: /vault/backups/"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "👥 DEMO USERS"
echo "═══════════════════════════════════════════════════════════"
echo "🔴 admin/admin123          - Full quyền (8h session)"
echo "🟡 lead1/lead123           - Team lead, quản lý team secrets"
echo "🟢 dev1/dev123, dev2/dev123 - Developers (4h session)"
echo "🔵 ops1/ops123, ops2/ops123 - Operations (4h session)"
echo "⚪ guest/guest123          - Read-only (1h session)"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📦 SECRETS STRUCTURE"
echo "═══════════════════════════════════════════════════════════"
echo "secret/                    - Personal & shared secrets"
echo "  ├── database/           - Database credentials"
echo "  ├── api/                - API keys (Stripe, AWS, GitHub)"
echo "  ├── ssh/                - SSH keys"
echo "  ├── ssl/                - SSL/TLS certificates (PEM)"
echo "  ├── infrastructure/     - K8s, Docker registry"
echo "  ├── dev/                - Dev personal secrets"
echo "  ├── ops/                - Ops personal secrets"
echo "  ├── certificates/       - Generated certificates"
echo "  └── pem-files/          - Uploaded PEM files (NEW!)"
echo "      ├── ssh-production  - Demo SSH key"
echo "      ├── ssl-dev-app     - Demo SSL certificate"
echo "      └── api-signing-key - Demo RSA keypair"
echo ""
echo "team/                      - Team shared secrets (policy-based)"
echo "  ├── development/        - Dev team only"
echo "  └── operations/         - Ops team only"
echo ""
echo "pki/                       - Certificate Authority"
echo "  ├── issue/dev-role      - Issue dev certificates"
echo "  └── issue/prod-role     - Issue prod certificates"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🎯 TÍNH NĂNG CHÍNH"
echo "═══════════════════════════════════════════════════════════"
echo "✅ Lưu trữ tập trung: Passwords, PEM files, SSH keys, API keys"
echo "✅ Phân quyền: Policy-based access control"
echo "✅ Audit log: Ghi lại tất cả truy cập (/vault/logs/audit.log)"
echo "✅ Team secrets: Chia sẻ không lộ plaintext (policy control)"
echo "✅ Auto backup: Mỗi giờ snapshot vào /vault/backups/"
echo "✅ Web UI: Non-technical users dùng http://localhost:8080"
echo "✅ PKI: Generate SSL/TLS certificates on-demand"
echo "✅ PEM Management: Upload, generate, download PEM files securely (NEW!)"
echo "═══════════════════════════════════════════════════════════"
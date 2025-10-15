# 🔐 HashiCorp Vault Enterprise Demo

Demo đầy đủ HashiCorp Vault với tất cả tính năng enterprise cho môi trường development:

✅ **Lưu trữ tập trung**: Passwords, PEM files, SSH keys, API keys  
✅ **Phân quyền**: Policy-based access control (User/Group)  
✅ **Audit Log**: Ghi lại ai truy cập gì lúc nào  
✅ **Team Secrets**: Chia sẻ không lộ plaintext  
✅ **Backup & Recovery**: Auto backup mỗi giờ + restore script  
✅ **Web UI**: Dành cho non-technical users  
✅ **PKI**: Generate SSL/TLS certificates on-demand  

---

## 📋 Yêu cầu

- Docker & Docker Compose
- Port 8080 và 8200 trống
- 2GB RAM khả dụng

---

## 🚀 Cách chạy

### 1. Chuẩn bị files

Đảm bảo có tất cả files trong cùng thư mục:

```
vault-demo/
├── docker-compose.yml
├── Dockerfile
├── init-vault.sh
├── backup-script.sh
├── restore-script.sh
├── server.js
├── package.json
└── ui_enhanced.html
```

### 2. Tạo thư mục backup

```bash
mkdir -p backups
chmod +x init-vault.sh backup-script.sh restore-script.sh
```

### 3. Khởi động

```bash
docker-compose up -d
```

### 4. Xem quá trình khởi tạo

```bash
docker-compose logs -f vault-init
```

Đợi đến khi thấy message "✅ Vault đã được khởi tạo thành công!"

---

## 🌐 Truy cập

- **Custom UI**: http://localhost:8080
- **Vault API**: http://localhost:8200
- **Vault Official UI**: http://localhost:8200/ui (Token: `root-token-demo`)

---

## 👥 Demo Users

| Username | Password | Quyền truy cập | Session TTL |
|----------|----------|----------------|-------------|
| admin | admin123 | Full quyền + audit log | 8h |
| lead1 | lead123 | Quản lý team secrets | 8h |
| dev1, dev2 | dev123 | Chỉ dev/* secrets + team/development/* (read) | 4h |
| ops1, ops2 | ops123 | Chỉ ops/* secrets + team/operations/* | 4h |
| guest | guest123 | Read-only tất cả secrets | 1h |

---

## 📦 Cấu trúc Secrets

### Personal Secrets (`secret/`)

```
secret/
├── database/
│   ├── mysql              # MySQL credentials
│   └── postgres           # PostgreSQL credentials
├── api/
│   ├── stripe            # Stripe API keys
│   ├── aws               # AWS credentials
│   └── github            # GitHub token
├── ssh/
│   └── production-server # SSH private/public keys
├── ssl/
│   └── example.com       # SSL/TLS certificates (PEM format)
├── infrastructure/
│   ├── kubernetes        # K8s API token + CA cert
│   └── docker-registry   # Docker registry credentials
├── dev/
│   ├── dev1-api-keys     # Dev1 personal keys
│   └── dev2-database     # Dev2 personal DB
├── ops/
│   ├── monitoring-grafana    # Grafana credentials
│   └── monitoring-prometheus # Prometheus credentials
└── certificates/
    └── *.dev.example.com     # Issued certificates
```

### Team Shared Secrets (`team/`)

```
team/
├── development/
│   ├── staging-db        # Shared staging database (dev team only)
│   └── test-api-keys     # Shared test API keys
└── operations/
    ├── backup-credentials    # Backup system (ops team only)
    └── monitoring-shared     # Shared monitoring alerts
```

### PKI (`pki/`)

```
pki/
├── issue/dev-role       # Issue *.dev.example.com certificates
└── issue/prod-role      # Issue *.example.com certificates
```

---

## 🎯 Tính năng chi tiết

### 1. Lưu trữ mật khẩu, PEM, key tập trung ✅

**Vault đáp ứng:**
- KV v2 Secrets Engine (AES-256 encryption)
- Lưu trữ bất kỳ loại data: passwords, API keys, SSH keys, PEM certificates
- Versioning: Mỗi secret có history, có thể rollback

**Demo:**
```bash
# Lưu password
vault kv put secret/myapp/db password="MySecretPass123"

# Lưu SSH key
vault kv put secret/ssh/server \
    private_key=@~/.ssh/id_rsa \
    public_key=@~/.ssh/id_rsa.pub

# Lưu certificate (PEM)
vault kv put secret/ssl/mydomain \
    certificate=@cert.pem \
    private_key=@key.pem
```

### 2. Phân quyền user/group ✅

**Vault đáp ứng:**
- Policy-based access control
- Token có TTL, tự động expire
- Mapping user -> policies

**Demo policies:**
```hcl
# Developer chỉ truy cập dev/* secrets
path "secret/data/dev/*" {
  capabilities = ["create", "read", "update", "delete"]
}

# Operations chỉ truy cập ops/* secrets
path "secret/data/ops/*" {
  capabilities = ["create", "read", "update", "delete"]
}

# Guest read-only mọi thứ
path "secret/data/*" {
  capabilities = ["read", "list"]
}
```

**Test phân quyền:**
```bash
# Login as dev1
vault login -method=userpass username=dev1
# Password: dev123

# Dev1 có thể đọc dev/* secrets
vault kv get secret/dev/dev1-api-keys  # ✅ OK

# Dev1 KHÔNG thể đọc ops/* secrets
vault kv get secret/ops/monitoring-grafana  # ❌ Permission denied
```

### 3. Audit log: biết ai truy cập lúc nào ✅

**Vault đáp ứng:**
- Audit device enabled (file-based)
- Ghi lại EVERY request/response
- Format: JSON, dễ parse

**Xem audit log:**
```bash
# Xem 50 dòng cuối
docker exec vault-demo cat /vault/logs/audit.log | tail -n 50

# Filter theo user
docker exec vault-demo cat /vault/logs/audit.log | jq 'select(.auth.metadata.username=="dev1")'

# Filter theo path
docker exec vault-demo cat /vault/logs/audit.log | jq 'select(.request.path | contains("secret/database"))'
```

**Audit log chứa:**
- `time`: Timestamp chính xác
- `auth.display_name`: Username đăng nhập
- `request.path`: Secret path được truy cập
- `request.operation`: read/write/delete
- `request.remote_address`: IP address
- `response.data`: Data trả về (nếu read)

### 4. Chia sẻ secret cho team mà không lộ plaintext ✅

**Vault đáp ứng:**
- Team secrets mount (`team/`) với policy riêng
- User KHÔNG THỂ export toàn bộ secrets
- Mỗi access phải qua Vault, được audit

**Cách hoạt động:**
1. Admin/Team Lead tạo secret trong `team/development/`
2. Chỉ users có `dev-policy` mới đọc được
3. Secret KHÔNG BAO GIỜ lưu local, luôn fetch từ Vault
4. Mỗi lần đọc đều ghi audit log

**Demo:**
```bash
# Team lead tạo shared secret
vault kv put team/development/staging-db \
    host="staging.internal" \
    password="SharedPass123"

# Dev1 đọc (OK, có quyền)
vault kv get team/development/staging-db

# Ops1 đọc (FAIL, không có quyền)
vault kv get team/development/staging-db  # ❌ Permission denied

# Audit log ghi lại ai đọc
{
  "time": "2025-01-15T10:30:00Z",
  "auth": {"display_name": "dev1"},
  "request": {
    "path": "team/data/development/staging-db",
    "operation": "read"
  }
}
```

### 5. Backup & khôi phục khi máy user hỏng ✅

**Vault đáp ứng:**
- Auto backup mỗi giờ (container `vault-backup`)
- Backup format: JSON, nén gzip
- Restore script để khôi phục

**Cách hoạt động:**

**Auto backup:**
```bash
# Backup tự động chạy mỗi giờ
# File lưu tại: ./backups/vault_backup_YYYYMMDD_HHMMSS.json.gz

# Liệt kê backups
ls -lh backups/

# Output:
# vault_backup_20250115_100000.json.gz  (145KB)
# vault_backup_20250115_110000.json.gz  (148KB)
# vault_backup_20250115_120000.json.gz  (150KB)
```

**Manual backup:**
```bash
docker exec vault-backup sh /backup-script.sh
```

**Restore từ backup:**
```bash
# Vào container Vault
docker exec -it vault-demo sh

# Restore từ backup cụ thể
VAULT_ADDR=http://localhost:8200 VAULT_TOKEN=root-token-demo \
  sh /vault/backups/../restore-script.sh /vault/backups/vault_backup_20250115_120000.json.gz

# Hoặc từ host
docker exec -e VAULT_ADDR=http://localhost:8200 -e VAULT_TOKEN=root-token-demo \
  vault-demo sh -c "gunzip -c /vault/backups/vault_backup_20250115_120000.json.gz | vault kv put secret/restored -"
```

**Kịch bản thực tế:**
1. ✅ User laptop hỏng → Data VẪN CÒN trên Vault server
2. ✅ Vault server restart → Data restore từ backup tự động
3. ✅ Cần rollback → Restore từ backup cũ hơn
4. ✅ Disaster recovery → Copy thư mục `backups/` sang server khác

### 6. Giao diện web cho user non-technical ✅

**Vault đáp ứng:**
- Custom UI tại http://localhost:8080
- Không cần biết CLI, API
- Tự động ẩn/hiện secrets theo quyền

**Tính năng UI:**
- 🔑 Login đơn giản (username/password)
- 📦 Xem secrets theo mount (Personal, Team)
- 🔐 Generate SSL certificates (PKI)
- 📊 Dashboard thống kê
- 📝 Xem audit log info
- ➕ Tạo/xóa secrets
- 📋 Copy secrets dễ dàng
- 🔒 Auto-hide passwords/keys
- 🎨 Responsive, mobile-friendly

**Demo cho non-technical:**
1. Mở http://localhost:8080
2. Login: `guest` / `guest123`
3. Click tab "📦 Secrets" → Xem được database passwords
4. Click "Copy" bên cạnh password → Paste vào app
5. ✅ Không cần biết CLI hay API!

---

## 🔧 Vault CLI Commands

### Authentication

```bash
# Set Vault address
export VAULT_ADDR='http://localhost:8200'

# Login với root token
export VAULT_TOKEN='root-token-demo'

# Hoặc login với userpass
vault login -method=userpass username=admin
# Password: admin123

# Check current token
vault token lookup
```

### Secrets Management

```bash
# List secrets
vault kv list secret/
vault kv list secret/database/

# Get secret
vault kv get secret/database/mysql
vault kv get -format=json secret/database/mysql

# Get specific field
vault kv get -field=password secret/database/mysql

# Create/Update secret
vault kv put secret/myapp/config \
    api_url=https://api.example.com \
    api_key=my-secret-key

# Delete secret
vault kv delete secret/myapp/config

# Get secret history
vault kv metadata get secret/database/mysql

# Rollback to version 1
vault kv rollback -version=1 secret/database/mysql
```

### PKI - Issue Certificates

```bash
# Issue development certificate
vault write pki/issue/dev-role \
    common_name="myapp.dev.example.com" \
    ttl="720h"

# Issue production certificate
vault write pki/issue/prod-role \
    common_name="api.example.com" \
    ttl="8760h"

# Save certificate to files
vault write -format=json pki/issue/dev-role \
    common_name="app.dev.example.com" \
    ttl="720h" | jq -r '.data.certificate' > cert.pem

vault write -format=json pki/issue/dev-role \
    common_name="app.dev.example.com" \
    ttl="720h" | jq -r '.data.private_key' > key.pem
```

### Policy Management

```bash
# List policies
vault policy list

# Read policy
vault policy read dev-policy

# Create new policy
cat > my-policy.hcl <<EOF
path "secret/data/myapp/*" {
  capabilities = ["create", "read", "update", "delete"]
}
EOF

vault policy write my-policy my-policy.hcl

# Delete policy
vault policy delete my-policy
```

### User Management

```bash
# Create new user
vault write auth/userpass/users/newuser \
    password=password123 \
    policies=dev-policy

# Update user password
vault write auth/userpass/users/newuser/password \
    password=newpassword456

# Delete user
vault delete auth/userpass/users/newuser

# List users
vault list auth/userpass/users
```

### Audit Commands

```bash
# List audit devices
vault audit list

# Read audit log (in container)
docker exec vault-demo cat /vault/logs/audit.log | tail -n 100

# Parse audit log with jq
docker exec vault-demo cat /vault/logs/audit.log | \
    jq 'select(.auth.metadata.username=="dev1")'

# Count requests by user
docker exec vault-demo cat /vault/logs/audit.log | \
    jq -r '.auth.metadata.username' | sort | uniq -c
```

---

## 📊 Monitoring & Health Check

### Health Check

```bash
# Vault status
vault status

# Via API
curl http://localhost:8200/v1/sys/health

# Custom UI health
curl http://localhost:8080/health
```

### View Logs

```bash
# Vault logs
docker-compose logs vault

# Custom UI logs
docker-compose logs custom-ui

# Backup logs
docker-compose logs vault-backup

# All logs
docker-compose logs -f
```

### Statistics

```bash
# Via Custom UI
# → Open http://localhost:8080
# → Login
# → Click "📊 Statistics" tab

# Via CLI
vault read sys/internal/ui/mounts

# Count secrets
vault kv list -format=json secret/ | jq '.[]' | wc -l
```

---

## 🔄 Common Operations

### Scenario 1: Thêm user mới vào team

```bash
# 1. Tạo user
vault write auth/userpass/users/dev3 \
    password=dev123 \
    policies=dev-policy \
    token_ttl=4h

# 2. User login
vault login -method=userpass username=dev3

# 3. User có thể truy cập dev/* secrets
vault kv get secret/dev/dev1-api-keys
```

### Scenario 2: Tạo shared secret cho team

```bash
# 1. Team lead login
vault login -method=userpass username=lead1

# 2. Tạo shared secret
vault kv put team/development/new-service \
    api_url=https://new-service.dev \
    api_key=shared-key-123

# 3. Tất cả dev users có thể đọc
# Dev1 login và đọc
vault login -method=userpass username=dev1
vault kv get team/development/new-service  # ✅ OK
```

### Scenario 3: Rotate password

```bash
# 1. Update secret với version mới
vault kv put secret/database/mysql \
    host=mysql.example.com \
    port=3306 \
    username=root \
    password='NewPassword123!'

# 2. Xem history
vault kv metadata get secret/database/mysql

# 3. Nếu cần rollback
vault kv rollback -version=1 secret/database/mysql
```

### Scenario 4: User quên password

```bash
# Admin reset password
vault write auth/userpass/users/dev1/password \
    password=newdev123

# User login với password mới
vault login -method=userpass username=dev1
```

### Scenario 5: Backup trước khi thay đổi lớn

```bash
# 1. Manual backup
docker exec vault-backup sh /backup-script.sh

# 2. Thực hiện thay đổi
vault kv put secret/database/mysql ...

# 3. Nếu có vấn đề, restore
docker exec vault-demo sh /vault/backups/../restore-script.sh \
    /vault/backups/vault_backup_20250115_143000.json.gz
```

---

## 🛑 Dừng và Xóa

```bash
# Dừng services
docker-compose down

# Xóa cả volumes (MẤT DỮ LIỆU!)
docker-compose down -v

# Xóa backups
rm -rf backups/

# Rebuild từ đầu
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

---

## 🔍 Troubleshooting

### Container không khởi động

```bash
# Kiểm tra status
docker-compose ps

# Xem logs
docker-compose logs vault
docker-compose logs vault-init
docker-compose logs custom-ui

# Restart
docker-compose restart
```

### Không kết nối được Vault

```bash
# Kiểm tra Vault health
curl http://localhost:8200/v1/sys/health

# Kiểm tra Vault status
docker exec vault-demo vault status

# Restart Vault
docker-compose restart vault
```

### Custom UI không load

```bash
# Kiểm tra logs
docker-compose logs custom-ui

# Kiểm tra backend health
curl http://localhost:8080/health

# Rebuild
docker-compose build custom-ui
docker-compose up -d custom-ui
```

### Permission denied khi truy cập secrets

```bash
# Kiểm tra policies của user
vault token lookup

# Kiểm tra policy content
vault policy read dev-policy

# Test với root token
export VAULT_TOKEN=root-token-demo
vault kv get secret/database/mysql
```

### Backup không chạy

```bash
# Kiểm tra backup container
docker-compose logs vault-backup

# Manual trigger backup
docker exec vault-backup sh /backup-script.sh

# Kiểm tra backups
ls -lh backups/
```

### Audit log không ghi

```bash
# Kiểm tra audit device
vault audit list

# Xem audit log file
docker exec vault-demo ls -lh /vault/logs/

# Re-enable audit
vault audit disable file/
vault audit enable file file_path=/vault/logs/audit.log
```

---

## 📚 Tài liệu tham khảo

- [Vault Documentation](https://www.vaultproject.io/docs)
- [Vault API](https://www.vaultproject.io/api-docs)
- [KV Secrets Engine v2](https://www.vaultproject.io/docs/secrets/kv/kv-v2)
- [PKI Secrets Engine](https://www.vaultproject.io/docs/secrets/pki)
- [Policies](https://www.vaultproject.io/docs/concepts/policies)
- [Audit Devices](https://www.vaultproject.io/docs/audit)

---

## ⚠️ Lưu ý quan trọng

### Chỉ cho Development!

- ❌ **DEV MODE**: Vault chạy dev mode, data lưu in-memory
- ❌ **NO TLS**: HTTP plain text, không mã hóa transport
- ❌ **WEAK TOKEN**: Root token cố định, dễ đoán
- ❌ **NO HA**: Single instance, không high availability
- ❌ **AUTO UNSEAL**: Không có seal/unseal mechanism

### Production Requirements

Để deploy production, cần:
- ✅ Vault production mode (sealed)
- ✅ TLS/HTTPS bắt buộc
- ✅ Storage backend (Consul, etcd, PostgreSQL)
- ✅ High Availability (3+ nodes)
- ✅ Auto-unseal (Cloud KMS, HSM)
- ✅ Network isolation
- ✅ Regular backups offsite
- ✅ Monitoring & alerting
- ✅ Disaster recovery plan

---

## 🎯 Tóm tắt

| Yêu cầu | Giải pháp Vault | Status |
|---------|----------------|--------|
| Lưu trữ passwords, PEM, keys | KV v2, AES-256 | ✅ |
| Phân quyền user/group | Policies + Token | ✅ |
| Audit log | File audit device | ✅ |
| Chia sẻ không lộ plaintext | Policy-based access | ✅ |
| Backup & recovery | Auto backup + restore script | ✅ |
| Web UI non-technical | Custom UI Express.js | ✅ |

---

## 🤝 Hỗ trợ

Nếu gặp vấn đề:

1. **Kiểm tra logs**: `docker-compose logs -f`
2. **Restart**: `docker-compose restart`
3. **Rebuild**: `docker-compose build --no-cache && docker-compose up -d`
4. **Reset toàn bộ**: `docker-compose down -v && docker-compose up -d`

---

## 📝 License

Demo này chỉ cho mục đích học tập và development. Không sử dụng cho production.
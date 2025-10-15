# 📋 Mapping Yêu Cầu → Giải Pháp Vault

Tài liệu này giải thích chi tiết cách Vault đáp ứng từng yêu cầu cụ thể.

---

## 1️⃣ Lưu trữ mật khẩu, PEM, key tập trung

### ❓ Yêu cầu
- Lưu passwords, API keys, SSH keys, PEM certificates ở một nơi
- Không lưu trên máy user (mất khi máy hỏng)
- Truy cập từ nhiều máy/nhiều user

### ✅ Vault giải quyết

**Công nghệ:**
- **KV v2 Secrets Engine**: Key-Value storage với versioning
- **AES-256-GCM encryption**: Mã hóa data at rest
- **TLS transport**: Mã hóa data in transit (trong prod)

**Cách lưu trong demo:**

```bash
# Passwords
secret/database/mysql
  ├── host: mysql.example.com
  ├── username: root
  └── password: MyS3cr3tP@ssw0rd!

# PEM Certificates
secret/ssl/example.com
  ├── certificate: -----BEGIN CERTIFICATE-----...
  └── private_key: -----BEGIN PRIVATE KEY-----...

# SSH Keys
secret/ssh/production-server
  ├── private_key: -----BEGIN RSA PRIVATE KEY-----...
  ├── public_key: ssh-rsa AAAAB3NzaC1...
  └── server: prod-server-01.example.com

# API Keys
secret/api/stripe
  ├── api_key: sk_live_51HqLyjWDarjtT1zdp7dc...
  └── webhook_secret: whsec_prod_abc123...
```

**Test:**

```bash
# User A tạo secret
vault kv put secret/myapp/db password="secret123"

# User B (máy khác) đọc được
vault kv get secret/myapp/db
# Output: password=secret123

# Máy User A hỏng → Data vẫn còn trên Vault!
```

**Files liên quan:**
- `init-vault.sh`: Dòng 89-165 - Tạo demo secrets
- `server.js`: `GET /api/secret/:mount/:path` - API đọc secrets

---

## 2️⃣ Phân quyền user/group

### ❓ Yêu cầu
- Developer chỉ xem được dev secrets
- Operations chỉ xem được ops secrets
- Admin xem được tất cả
- Guest chỉ read-only

### ✅ Vault giải quyết

**Công nghệ:**
- **Policies**: HCL-based access rules
- **Token**: Mỗi user có token với TTL
- **Path-based ACL**: Kiểm soát theo đường dẫn

**Policies trong demo:**

```hcl
# Developer Policy
path "secret/data/dev/*" {
  capabilities = ["create", "read", "update", "delete"]
}
path "team/data/development/*" {
  capabilities = ["read"]  # Chỉ đọc team secrets
}

# Operations Policy
path "secret/data/ops/*" {
  capabilities = ["create", "read", "update", "delete"]
}
path "secret/data/infrastructure/*" {
  capabilities = ["read"]
}

# Read-Only Policy
path "secret/data/*" {
  capabilities = ["read", "list"]
}
```

**Test phân quyền:**

```bash
# Dev1 login
vault login -method=userpass username=dev1

# ✅ Dev1 có thể đọc dev secrets
vault kv get secret/dev/dev1-api-keys
# Success!

# ❌ Dev1 KHÔNG thể đọc ops secrets
vault kv get secret/ops/monitoring-grafana
# Error: permission denied

# ❌ Dev1 KHÔNG thể xóa team secrets
vault kv delete team/development/staging-db
# Error: permission denied
```

**Mapping User → Policies:**

| User | Policies | Quyền truy cập |
|------|----------|----------------|
| admin | admin-policy | `secret/*`, `team/*`, `pki/*`, audit |
| lead1 | teamlead-policy | `team/*` (full), `secret/*` (read) |
| dev1, dev2 | dev-policy | `secret/dev/*`, `team/development/*` (read) |
| ops1, ops2 | ops-policy | `secret/ops/*`, `team/operations/*` |
| guest | readonly-policy | `secret/*` (read), `team/*` (read) |

**Files liên quan:**
- `init-vault.sh`: Dòng 30-88 - Định nghĩa policies
- `init-vault.sh`: Dòng 94-136 - Tạo users + assign policies

---

## 3️⃣ Audit log: biết ai truy cập lúc nào

### ❓ Yêu cầu
- Ghi lại ai đăng nhập
- Ai đọc/ghi secret nào
- Timestamp chính xác
- Có thể trace lại lịch sử

### ✅ Vault giải quyết

**Công nghệ:**
- **File Audit Device**: Ghi log ra file JSON
- **Detailed logging**: Request + Response + Metadata
- **Tamper-proof**: Append-only log

**Cấu hình:**

```bash
# Enable audit (trong init-vault.sh)
vault audit enable file file_path=/vault/logs/audit.log
```

**Audit log format:**

```json
{
  "time": "2025-01-15T10:30:45.123Z",
  "type": "response",
  "auth": {
    "display_name": "dev1",
    "policies": ["dev-policy"],
    "metadata": {
      "username": "dev1"
    }
  },
  "request": {
    "id": "abc-123-def",
    "operation": "read",
    "path": "secret/data/database/mysql",
    "remote_address": "172.18.0.5"
  },
  "response": {
    "data": {
      "data": {
        "password": "hmac-sha256:xyz..."
      }
    }
  }
}
```

**Test audit:**

```bash
# 1. Dev1 login
vault login -method=userpass username=dev1
# → Ghi log: auth/userpass/login/dev1

# 2. Dev1 đọc secret
vault kv get secret/database/mysql
# → Ghi log: secret/data/database/mysql (read)

# 3. Xem audit log
docker exec vault-demo cat /vault/logs/audit.log | tail -n 5

# 4. Filter theo user
docker exec vault-demo cat /vault/logs/audit.log | \
  jq 'select(.auth.metadata.username=="dev1")'

# 5. Filter theo path
docker exec vault-demo cat /vault/logs/audit.log | \
  jq 'select(.request.path | contains("database"))'
```

**Thông tin audit log ghi lại:**
- ✅ Username đăng nhập
- ✅ Timestamp chính xác (UTC)
- ✅ Secret path được truy cập
- ✅ Operation (read/write/delete/list)
- ✅ IP address
- ✅ Request ID (để trace)
- ✅ Response (password được HMAC, không plain)

**Files liên quan:**
- `init-vault.sh`: Dòng 10-11 - Enable audit
- `server.js`: `GET /api/audit` - API xem audit config
- `ui_enhanced.html`: Tab "📝 Audit Log" - UI hiển thị audit info

---

## 4️⃣ Chia sẻ secret cho team mà không lộ plaintext

### ❓ Yêu cầu
- Share database password cho cả team dev
- Developer không thể copy toàn bộ về máy local
- Mỗi lần access phải qua Vault
- Biết được ai đã xem

### ✅ Vault giải quyết

**Công nghệ:**
- **Separate mount**: `team/` mount riêng cho shared secrets
- **Policy control**: Chỉ team members mới truy cập được
- **Audit log**: Ghi lại mọi access
- **No bulk export**: API không cho phép export toàn bộ

**Cấu trúc team secrets:**

```
team/
├── development/
│   ├── staging-db        # Dev team shared
│   └── test-api-keys     # Dev team shared
└── operations/
    ├── backup-credentials  # Ops team shared
    └── monitoring-shared   # Ops team shared
```

**Policy cho team:**

```hcl
# Developer chỉ đọc development team secrets
path "team/data/development/*" {
  capabilities = ["read", "list"]
}

# Operations full access vào operations team secrets
path "team/data/operations/*" {
  capabilities = ["create", "read", "update", "delete"]
}
```

**Workflow:**

```bash
# 1. Team Lead tạo shared secret
vault login -method=userpass username=lead1
vault kv put team/development/staging-db \
    host="staging.internal" \
    password="SharedTeamPassword123"

# 2. Dev1 đọc (có quyền)
vault login -method=userpass username=dev1
vault kv get team/development/staging-db
# ✅ Success! Dev1 thấy password

# 3. Dev1 KHÔNG thể sửa/xóa (read-only)
vault kv delete team/development/staging-db
# ❌ Error: permission denied

# 4. Ops1 KHÔNG thể đọc dev team secrets
vault login -method=userpass username=ops1
vault kv get team/development/staging-db
# ❌ Error: permission denied

# 5. Audit log ghi lại
docker exec vault-demo cat /vault/logs/audit.log | \
  jq 'select(.request.path | contains("team/development/staging-db"))'
# Output: dev1 đã read lúc 10:30:45
```

**Tại sao KHÔNG lộ plaintext:**

1. **Không có bulk export API**
   ```bash
   # ❌ KHÔNG CÓ lệnh này
   vault kv export team/  # API không tồn tại
   ```

2. **Mỗi lần fetch phải qua Vault**
   - Application phải gọi Vault API mỗi lần cần secret
   - Không cache local = không có plaintext trên disk

3. **Token có TTL**
   - Dev token: 4h → Auto expire
   - Phải login lại → Audit log ghi lại

4. **Policy enforcement**
   - Vault kiểm tra policy mỗi request
   - Từ chối nếu không có quyền

**So sánh với shared file:**

| Phương pháp | Vấn đề |
|-------------|--------|
| Shared .env file | ❌ File copy được, plaintext trên disk |
| Git repository | ❌ History chứa plaintext mãi mãi |
| Shared document | ❌ Ai có link đều đọc được |
| Vault | ✅ Policy control + audit + no plaintext local |

**Files liên quan:**
- `init-vault.sh`: Dòng 184-211 - Tạo team shared secrets
- `server.js`: Không có bulk export endpoint
- `ui_enhanced.html`: Tab "🤝 Team Secrets" - UI riêng cho team secrets

---

## 5️⃣ Backup & khôi phục khi máy user hỏng

### ❓ Yêu cầu
- User laptop hỏng → không mất secrets
- Định kỳ backup tự động
- Restore khi cần
- Không phụ thuộc vào máy user

### ✅ Vault giải queuet

**Công nghệ:**
- **Centralized storage**: Data lưu trên Vault server
- **Auto backup**: Cron job mỗi giờ
- **Compressed backup**: gzip để tiết kiệm
- **Retention policy**: Giữ 7 ngày, xóa cũ

**Kiến trúc:**

```
┌─────────────┐
│  User A     │ → Mất máy ❌
│  (Laptop)   │
└─────────────┘

┌─────────────┐
│  User B     │ → Vẫn truy cập được ✅
│  (Desktop)  │
└─────────────┘
       ↓
┌─────────────┐
│    Vault    │ ← Data lưu ở đây
│   Server    │
└─────────────┘
       ↓
┌─────────────┐
│   Backup    │ ← Auto backup mỗi giờ
│   Storage   │   /backups/*.json.gz
└─────────────┘
```

**Auto Backup:**

```bash
# Container vault-backup chạy loop
while true; do
  sh /backup-script.sh
  sleep 3600  # 1 giờ
done
```

**Backup script logic:**

```bash
# 1. Export tất cả secrets
vault kv list secret/ | while read path; do
  vault kv get -format=json "secret/$path" >> backup.json
done

# 2. Export policies
vault policy list -format=json >> backup.json

# 3. Compress
gzip backup.json

# 4. Cleanup cũ > 7 ngày
find /backups -mtime +7 -delete
```

**Backup file structure:**

```json
{
  "timestamp": "2025-01-15T10:00:00Z",
  "vault_version": "Vault v1.15.0",
  "secrets": {
    "secret": [
      {
        "path": "database/mysql",
        "data": {
          "host": "mysql.example.com",
          "password": "encrypted..."
        }
      }
    ],
    "team": [...]
  },
  "policies": ["admin-policy", "dev-policy", ...],
  "auth_methods": {...}
}
```

**Restore:**

```bash
# 1. Chọn backup file
ls -lh backups/
# vault_backup_20250115_100000.json.gz

# 2. Restore
docker exec vault-demo sh /restore-script.sh \
  /vault/backups/vault_backup_20250115_100000.json.gz

# 3. Verify
vault kv list secret/
vault kv get secret/database/mysql
```

**Test scenario máy hỏng:**

```bash
# 1. User A tạo secret từ laptop
vault kv put secret/myproject/config api_key="abc123"

# 2. Laptop hỏng ❌ → User A mất máy

# 3. User A mượn máy khác, login Vault
vault login -method=userpass username=dev1

# 4. Secret VẪN CÒN ✅
vault kv get secret/myproject/config
# api_key = abc123
```

**Backup statistics:**

```bash
# Xem danh sách backups
ls -lh backups/

# Output:
# -rw-r--r--  vault_backup_20250115_100000.json.gz  145K
# -rw-r--r--  vault_backup_20250115_110000.json.gz  148K
# -rw-r--r--  vault_backup_20250115_120000.json.gz  150K

# Tổng số backups
ls backups/ | wc -l
# 168 (7 ngày × 24 giờ)
```

**Files liên quan:**
- `docker-compose.yml`: Service `vault-backup` - Container chạy backup
- `backup-script.sh`: Logic backup
- `restore-script.sh`: Logic restore
- Volume `./backups:/vault/backups` - Persist backups

---

## 6️⃣ Giao diện web cho user non-technical

### ❓ Yêu cầu
- Không biết CLI/API
- Point & click
- Copy/paste dễ dàng
- Responsive mobile

### ✅ Vault giải quyết

**Công nghệ:**
- **Custom UI**: Express.js + HTML/CSS/JS
- **Session-based auth**: Không cần token management
- **Responsive design**: CSS Grid + Flexbox
- **Auto-hide passwords**: Type=password cho sensitive fields

**UI Features:**

```
┌─────────────────────────────────────┐
│  🔐 Vault Enterprise Manager        │
├─────────────────────────────────────┤
│                                     │
│  Username: [dev1        ]           │
│  Password: [••••••••    ]           │
│           [Đăng nhập]              │
│                                     │
│  Demo Users:                        │
│  • admin/admin123 - Full quyền     │
│  • dev1/dev123 - Developer         │
│  • guest/guest123 - Read-only      │
└─────────────────────────────────────┘
```

**After login:**

```
┌─────────────────────────────────────┐
│ 👤 dev1  🎯 dev-policy  ⏱️ 4h      │
│                          [Logout]   │
├─────────────────────────────────────┤
│ [📦 Secrets] [🤝 Team] [🔐 PKI]    │
│ [📊 Stats] [📝 Audit]               │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────┐ ┌──────────────┐│
│  │ 🔑 database/  │ │ 🔑 api/      ││
│  │   mysql       │ │   stripe     ││
│  │               │ │              ││
│  │ host: mysql.. │ │ api_key: ••• ││
│  │ password: ••• │ │ [Copy]       ││
│  │ [Copy]        │ └──────────────┘│
│  └───────────────┘                 │
│                                     │
│         [+ Tạo Secret Mới]         │
└─────────────────────────────────────┘
```

**User workflow (non-technical):**

1. **Login**
   - Mở http://localhost:8080
   - Nhập username/password
   - Click "Đăng nhập"

2. **Xem secrets**
   - Click tab "📦 Secrets"
   - Secrets hiển thị dạng cards
   - Password tự động ẩn (••••)

3. **Copy password**
   - Click button "Copy" bên cạnh password
   - Paste vào app
   - ✅ Không cần biết CLI!

4. **Tạo secret mới**
   - Click "+ Tạo Secret Mới"
   - Nhập path: `myapp/config`
   - Nhập data dạng JSON
   - Click "Tạo Secret"

5. **Issue certificate**
   - Click tab "🔐 PKI"
   - Click "Issue Certificate"
   - Nhập domain: `app.dev.example.com`
   - Click "Issue"
   - Copy certificate & private key

**Mobile responsive:**

```
┌──────────────┐
│ 🔐 Vault     │
│              │
│ Username:    │
│ [dev1     ]  │
│              │
│ Password:    │
│ [••••••••]   │
│              │
│ [Đăng nhập]  │
│              │
│ Demo Users:  │
│ • admin/...  │
│ • dev1/...   │
└──────────────┘
```

**So sánh:**

| Method | Technical Level | User Experience |
|--------|----------------|-----------------|
| Vault CLI | ⭐⭐⭐⭐⭐ Advanced | Terminal, commands |
| Vault API | ⭐⭐⭐⭐ Intermediate | Postman, curl |
| Official UI | ⭐⭐⭐ Intermediate | Token management |
| Custom UI | ⭐ Beginner | Username/password only |

**Files liên quan:**
- `ui_enhanced.html`: Full UI với tabs, modals, forms
- `server.js`: Backend API proxy
- Dockerfile`: Build custom UI container

---

## 📊 Tổng kết Feature Matrix

| Yêu cầu | Vault Solution | Files | Test |
|---------|---------------|-------|------|
| **1. Lưu trữ tập trung** | KV v2 + AES-256 | `init-vault.sh` L89-165 | `vault kv get secret/database/mysql` |
| **2. Phân quyền** | Policies + Token | `init-vault.sh` L30-136 | Login dev1 → read ops secrets ❌ |
| **3. Audit log** | File Audit Device | `init-vault.sh` L10-11 | `docker exec vault-demo cat /vault/logs/audit.log` |
| **4. Team secrets** | Separate mount + Policy | `init-vault.sh` L184-211 | dev1 read `team/development/*` ✅ |
| **5. Backup** | Auto backup container | `backup-script.sh` | `ls backups/` |
| **6. Web UI** | Custom Express UI | `ui_enhanced.html` | Open http://localhost:8080 |

---

## 🧪 Testing Checklist

### Test 1: Lưu trữ tập trung
```bash
# ✅ Tạo secret với PEM certificate
vault kv put secret/test/cert \
    certificate="$(cat cert.pem)" \
    private_key="$(cat key.pem)"

# ✅ Đọc lại từ máy khác
vault kv get secret/test/cert
```

### Test 2: Phân quyền
```bash
# ✅ Dev1 đọc dev secrets
vault login -method=userpass username=dev1
vault kv get secret/dev/dev1-api-keys  # Success

# ✅ Dev1 KHÔNG đọc ops secrets
vault kv get secret/ops/monitoring-grafana  # Permission denied
```

### Test 3: Audit log
```bash
# ✅ Thực hiện action
vault kv get secret/database/mysql

# ✅ Kiểm tra audit log
docker exec vault-demo cat /vault/logs/audit.log | \
  jq 'select(.request.path | contains("database/mysql"))' | tail -n 1
# Có ghi log với username + timestamp
```

### Test 4: Team secrets
```bash
# ✅ Lead tạo team secret
vault login -method=userpass username=lead1
vault kv put team/development/shared password="team123"

# ✅ Dev đọc được (read-only)
vault login -method=userpass username=dev1
vault kv get team/development/shared  # Success

# ✅ Dev KHÔNG xóa được
vault kv delete team/development/shared  # Permission denied
```

### Test 5: Backup
```bash
# ✅ Trigger manual backup
docker exec vault-backup sh /backup-script.sh

# ✅ Check backup file
ls -lh backups/ | tail -n 1
# vault_backup_YYYYMMDD_HHMMSS.json.gz

# ✅ Restore test
docker exec vault-demo sh /restore-script.sh \
  /vault/backups/vault_backup_*.json.gz
```

### Test 6: Web UI
```bash
# ✅ Open UI
open http://localhost:8080

# ✅ Login as guest
# Username: guest
# Password: guest123

# ✅ Verify read-only
# - Click "📦 Secrets" → See all secrets
# - Try create secret → Should fail (no permission)

# ✅ Login as dev1
# - Click "📦 Secrets" → See only dev secrets
# - Click "🤝 Team Secrets" → See team/development
# - Click "+ Tạo Secret Mới" → Can create in dev/*
```

---

## 🎯 Demo Script (5 phút)

### Chuẩn bị (1 phút)
```bash
./quickstart.sh
# Đợi services khởi động
```

### Demo 1: Phân quyền (1 phút)
```bash
# Terminal 1: Admin full access
export VAULT_ADDR=http://localhost:8200
vault login -method=userpass username=admin
vault kv get secret/database/mysql  # ✅ OK

# Terminal 2: Guest read-only
vault login -method=userpass username=guest
vault kv get secret/database/mysql  # ✅ OK (read)
vault kv delete secret/database/mysql  # ❌ Permission denied
```

### Demo 2: Audit log (1 phút)
```bash
# Thực hiện vài actions
vault kv get secret/api/stripe
vault kv get secret/database/postgres

# Xem audit log
docker exec vault-demo cat /vault/logs/audit.log | \
  jq -r '[.time, .auth.display_name, .request.path] | @tsv' | tail -n 5

# Output:
# 2025-01-15T10:30:45Z  admin  secret/data/database/mysql
# 2025-01-15T10:31:02Z  admin  secret/data/api/stripe
```

### Demo 3: Web UI (2 phút)
```bash
# Mở browser
open http://localhost:8080

# Login: dev1 / dev123
# 1. Click "📦 Secrets" → Thấy dev/* secrets
# 2. Click "🤝 Team Secrets" → Thấy team/development/*
# 3. Click button "Copy" → Paste vào notepad
# 4. Click "🔐 PKI" → Issue certificate cho app.dev.example.com
# 5. Click "📊 Statistics" → Xem thống kê
```

---

## 💡 Best Practices

### Production Considerations

1. **TLS/HTTPS bắt buộc**
   ```bash
   # Dev: HTTP OK
   VAULT_ADDR=http://localhost:8200
   
   # Prod: HTTPS only
   VAULT_ADDR=https://vault.company.com
   ```

2. **Storage backend**
   ```bash
   # Dev: In-memory (mất khi restart)
   # Prod: Consul, etcd, PostgreSQL
   ```

3. **High Availability**
   ```bash
   # Dev: Single instance
   # Prod: 3+ nodes cluster
   ```

4. **Backup strategy**
   ```bash
   # Dev: Local backups folder
   # Prod: S3, GCS, offsite storage
   ```

5. **Audit log**
   ```bash
   # Dev: File audit device
   # Prod: Syslog to SIEM (Splunk, ELK)
   ```

---

## 📝 Summary

| # | Yêu cầu | ✅ Đã đáp ứng | Cách test |
|---|---------|--------------|-----------|
| 1 | Lưu trữ tập trung | ✅ | `vault kv get secret/database/mysql` |
| 2 | Phân quyền | ✅ | Login dev1, try read ops secrets → denied |
| 3 | Audit log | ✅ | `cat /vault/logs/audit.log` |
| 4 | Team secrets | ✅ | `vault kv get team/development/staging-db` |
| 5 | Backup | ✅ | `ls backups/` → auto backup mỗi giờ |
| 6 | Web UI | ✅ | http://localhost:8080 |

**Demo này sẵn sàng cho development và testing!** 🎉
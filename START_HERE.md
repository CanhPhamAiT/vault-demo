# 🚀 Vault Demo - START HERE

## 📦 Bạn đã có gì?

Demo HashiCorp Vault **đầy đủ tính năng** cho development, đáp ứng 100% yêu cầu:

| Yêu cầu | Status |
|---------|--------|
| ✅ Lưu trữ passwords, PEM, keys tập trung | ✓ Hoàn thành |
| ✅ Phân quyền user/group | ✓ Hoàn thành |
| ✅ Audit log (ai truy cập lúc nào) | ✓ Hoàn thành |
| ✅ Chia sẻ secrets không lộ plaintext | ✓ Hoàn thành |
| ✅ Backup & khôi phục tự động | ✓ Hoàn thành |
| ✅ Web UI cho non-technical users | ✓ Hoàn thành |

---

## ⚡ Quick Start (5 phút)

### Bước 1: Chuẩn bị (1 phút)

```bash
# Kiểm tra Docker
docker --version
docker-compose --version

# Clone hoặc copy tất cả files vào thư mục
cd vault-demo/
ls
# Phải thấy: docker-compose.yml, init-vault.sh, server.js, v.v.

# Cấp quyền scripts
chmod +x *.sh
```

### Bước 2: Khởi động (2 phút)

```bash
# Tạo thư mục backup
mkdir -p backups

# Khởi động tất cả services
docker-compose up -d

# Xem quá trình init (đợi ~30 giây)
docker-compose logs -f vault-init

# Đợi thấy message: "✅ Vault đã được khởi tạo thành công!"
# Nhấn Ctrl+C để thoát logs
```

### Bước 3: Truy cập (1 phút)

```bash
# Mở Web UI
open http://localhost:8080

# Hoặc dùng CLI
export VAULT_ADDR=http://localhost:8200
vault login -method=userpass username=admin
# Password: admin123
```

### Bước 4: Test (1 phút)

```bash
# Đọc secret
vault kv get secret/database/mysql

# Xem audit log
docker exec vault-demo cat /vault/logs/audit.log | tail -n 5

# Check backup
ls -lh backups/

# ✅ DONE! Demo đã sẵn sàng
```

---

## 🎯 Demo Nhanh (cho Sếp/Client)

### Scenario 1: Phân quyền tự động (2 phút)

```bash
# Admin login - full quyền
vault login -method=userpass username=admin password=admin123
vault kv get secret/database/mysql  # ✅ OK

# Developer login - chỉ dev secrets
vault login -method=userpass username=dev1 password=dev123
vault kv get secret/dev/dev1-api-keys  # ✅ OK
vault kv get secret/ops/monitoring-grafana  # ❌ Permission denied!

# ✅ Phân quyền tự động hoạt động!
```

### Scenario 2: Audit Log (1 phút)

```bash
# Thực hiện action
vault kv get secret/api/stripe

# Xem ai đã truy cập
docker exec vault-demo cat /vault/logs/audit.log | \
  jq -r '[.time, .auth.display_name, .request.path] | @csv' | tail -n 5

# Output:
# "2025-01-15T10:30:45Z","admin","secret/data/api/stripe"

# ✅ Biết chính xác ai truy cập lúc nào!
```

### Scenario 3: Web UI (2 phút)

```bash
# Mở browser
open http://localhost:8080

# Login: guest / guest123
# → Click "📦 Secrets" → Thấy tất cả secrets
# → Click "Copy" button → Paste vào notepad
# → ✅ Non-technical user dùng được!
```

---

## 📁 Cấu trúc Files

```
vault-demo/
├── 🔧 docker-compose.yml        # Main: định nghĩa 4 services
├── 🐳 Dockerfile             # Build custom UI container
├── ⚙️  init-vault.sh            # Init: users, policies, secrets
├── 💾 backup-script.sh          # Auto backup mỗi giờ
├── 🔄 restore-script.sh         # Restore từ backup
├── 🖥️  server.js                # Node.js API backend
├── 📦 package.json              # Node dependencies
├── 🎨 ui_enhanced.html          # Custom web UI
├── 🚀 quickstart.sh             # Quick start script
│
├── 📚 README.md                 # Hướng dẫn đầy đủ
├── 📋 REQUIREMENTS_MAPPING.md   # Giải thích chi tiết từng yêu cầu
├── ✅ SETUP_CHECKLIST.md        # Checklist verify setup
└── 👉 START_HERE.md             # File này (tóm tắt)
```

---

## 🔑 Thông tin Đăng Nhập

### Root Token (CLI)
```bash
export VAULT_TOKEN=root-token-demo
```

### Demo Users (UI/CLI)

| Username | Password | Quyền | Use Case |
|----------|----------|-------|----------|
| admin | admin123 | Full quyền + audit | Administrator |
| lead1 | lead123 | Quản lý team secrets | Team Lead |
| dev1, dev2 | dev123 | Chỉ dev/* secrets | Developers |
| ops1, ops2 | ops123 | Chỉ ops/* secrets | Operations |
| guest | guest123 | Read-only | Guests/Viewers |

---

## 📊 Services Overview

```
┌─────────────────┐
│  Browser/CLI    │
└────────┬────────┘
         │
    ┌────┴────┐
    ↓         ↓
┌────────┐ ┌──────────┐
│  8080  │ │   8200   │
│ UI     │ │  Vault   │
│ Node.js│ │  API     │
└────────┘ └──────────┘
                │
         ┌──────┴──────┐
         ↓             ↓
    ┌────────┐   ┌─────────┐
    │ Audit  │   │ Backup  │
    │  Log   │   │ (hourly)│
    └────────┘   └─────────┘
```

**Services:**
1. **Vault** (8200) - Core secrets engine
2. **Custom UI** (8080) - Web interface
3. **Vault Init** - One-time setup
4. **Vault Backup** - Auto backup every hour

---

## 🎓 Học gì tiếp theo?

### 1. Đọc Documentation (30 phút)

- **README.md** - Hướng dẫn đầy đủ tất cả commands
- **REQUIREMENTS_MAPPING.md** - Hiểu sâu cách Vault đáp ứng từng yêu cầu
- **SETUP_CHECKLIST.md** - Verify setup đúng

### 2. Practice Commands (1 giờ)

```bash
# User management
vault write auth/userpass/users/newuser password=pass123 policies=dev-policy
vault list auth/userpass/users

# Secret operations
vault kv put secret/test/demo key=value
vault kv get secret/test/demo
vault kv delete secret/test/demo

# Policy management
vault policy list
vault policy read dev-policy

# PKI - Issue certificates
vault write pki/issue/dev-role common_name="app.dev.example.com"

# Audit
docker exec vault-demo cat /vault/logs/audit.log | jq
```

### 3. Customize cho Use Case (2 giờ)

```bash
# Tạo policy mới
cat > custom-policy.hcl <<EOF
path "secret/data/myapp/*" {
  capabilities = ["create", "read", "update"]
}
EOF
vault policy write custom-policy custom-policy.hcl

# Tạo user với policy mới
vault write auth/userpass/users/myuser \
  password=mypass123 \
  policies=custom-policy

# Test
vault login -method=userpass username=myuser
vault kv put secret/myapp/config setting=value
```

---

## 🛠️ Common Tasks

### Xem Secrets
```bash
vault kv list secret/
vault kv get secret/database/mysql
vault kv get -field=password secret/database/mysql
```

### Tạo/Sửa/Xóa Secrets
```bash
vault kv put secret/myapp/db password="newpass"
vault kv patch secret/myapp/db username="newuser"
vault kv delete secret/myapp/db
```

### Quản lý Users
```bash
vault list auth/userpass/users
vault write auth/userpass/users/newuser password=pass123
vault delete auth/userpass/users/olduser
```

### Xem Audit Log
```bash
# Tất cả logs
docker exec vault-demo cat /vault/logs/audit.log

# Filter by user
docker exec vault-demo cat /vault/logs/audit.log | \
  jq 'select(.auth.metadata.username=="dev1")'

# Filter by secret path
docker exec vault-demo cat /vault/logs/audit.log | \
  jq 'select(.request.path | contains("database"))'
```

### Backup & Restore
```bash
# Trigger manual backup
docker exec vault-backup sh /backup-script.sh

# List backups
ls -lh backups/

# Restore from backup
docker exec vault-demo sh /restore-script.sh \
  /vault/backups/vault_backup_20250115_120000.json.gz
```

---

## 🐛 Troubleshooting Quick Fix

### Problem: Container không start
```bash
docker-compose down -v
docker-compose up -d
```

### Problem: Port đã được dùng
```bash
lsof -ti:8200 | xargs kill -9
lsof -ti:8080 | xargs kill -9
docker-compose up -d
```

### Problem: Permission denied
```bash
vault login -method=userpass username=admin password=admin123
vault token lookup  # Check policies
```

### Problem: UI không load
```bash
docker-compose logs custom-ui
docker-compose restart custom-ui
curl http://localhost:8080/health
```

### Problem: Backup không chạy
```bash
docker-compose logs vault-backup
docker exec vault-backup sh /backup-script.sh
```

---

## 📞 Khi Cần Giúp Đỡ

1. **Check logs:**
   ```bash
   docker-compose logs -f
   ```

2. **Verify services:**
   ```bash
   docker-compose ps
   curl http://localhost:8200/v1/sys/health
   curl http://localhost:8080/health
   ```

3. **Read docs:**
   - README.md - Full documentation
   - SETUP_CHECKLIST.md - Verification steps
   - REQUIREMENTS_MAPPING.md - Technical details

4. **Reset everything:**
   ```bash
   docker-compose down -v
   rm -rf backups/
   ./quickstart.sh
   ```

---

## ⚠️ Quan Trọng

### ✅ Demo này CHỈ CHO DEVELOPMENT

- ✅ Học tập & thử nghiệm
- ✅ Demo cho team/client
- ✅ POC (Proof of Concept)
- ✅ Local development

### ❌ KHÔNG dùng cho Production

- ❌ Dev mode (không sealed)
- ❌ HTTP plain text (không TLS)
- ❌ Root token cố định
- ❌ In-memory storage
- ❌ No high availability

### 🎯 Production cần:

- ✅ Sealed Vault với auto-unseal
- ✅ HTTPS/TLS bắt buộc
- ✅ Storage backend (Consul, etcd)
- ✅ 3+ nodes cluster (HA)
- ✅ Cloud KMS hoặc HSM
- ✅ Network isolation
- ✅ Regular offsite backups

---

## 🎉 Bạn đã sẵn sàng!

```bash
# Start demo
docker-compose up -d

# Open UI
open http://localhost:8080

# Login: admin / admin123

# 🚀 ENJOY!
```

---

## 📚 Next Steps

1. ✅ **Bây giờ:** Chạy demo, test tất cả tính năng
2. 📖 **Tiếp theo:** Đọc README.md để hiểu sâu hơn
3. 🔧 **Sau đó:** Customize cho use case của bạn
4. 🚀 **Cuối cùng:** Plan production deployment

---

**Demo Version:** 1.0  
**Created:** 2025-01-15  
**Status:** ✅ Ready for Development

**Liên hệ:** Xem README.md section "Support"
# ✅ Vault Demo Setup Checklist

Sử dụng checklist này để verify demo đã setup đúng.

---

## 📁 Files Checklist

Đảm bảo có tất cả files sau:

```bash
vault-demo/
├── [ ] docker-compose.yml          # Docker services definition
├── [ ] Dockerfile                # Custom UI container
├── [ ] init-vault.sh                # Vault initialization script
├── [ ] backup-script.sh             # Auto backup script
├── [ ] restore-script.sh            # Restore from backup
├── [ ] server.js                    # Node.js backend API
├── [ ] package.json                 # Node.js dependencies
├── [ ] ui_enhanced.html             # Custom web interface
├── [ ] quickstart.sh                # Quick start script
├── [ ] .env.example                 # Environment variables example
├── [ ] README.md                    # Main documentation
├── [ ] REQUIREMENTS_MAPPING.md      # Requirements → Solution mapping
├── [ ] SETUP_CHECKLIST.md           # This file
└── backups/                         # Will be created automatically
```

**Verify:**
```bash
ls -la | grep -E "(docker-compose|Dockerfile|\.sh|\.js|\.json|\.html|\.md)"
```

---

## 🔧 Pre-Setup Checklist

### ✅ System Requirements

```bash
# Check Docker
[ ] docker --version
    # Expected: Docker version 20.10+ 

# Check Docker Compose
[ ] docker-compose --version
    # Expected: Docker Compose version 2.0+

# Check available ports
[ ] lsof -i :8200  # Should be empty
[ ] lsof -i :8080  # Should be empty

# Check disk space
[ ] df -h .
    # Should have at least 2GB free
```

### ✅ File Permissions

```bash
# Make scripts executable
[ ] chmod +x init-vault.sh
[ ] chmod +x backup-script.sh
[ ] chmod +x restore-script.sh
[ ] chmod +x quickstart.sh

# Verify
[ ] ls -l *.sh | grep "rwxr"
```

### ✅ Network

```bash
# Test internet connection (for Docker image pull)
[ ] ping -c 3 docker.io
[ ] ping -c 3 registry.npmjs.org
```

---

## 🚀 Startup Checklist

### ✅ Start Services

```bash
# Start all services
[ ] docker-compose up -d

# Expected output:
# Creating network "vault-demo_vault-network"
# Creating volume "vault-demo_vault-data"
# Creating volume "vault-demo_vault-logs"
# Creating vault-demo ... done
# Creating vault-init ... done
# Creating vault-custom-ui ... done
# Creating vault-backup ... done
```

### ✅ Verify Services Running

```bash
[ ] docker-compose ps

# Expected output (all services "Up"):
# NAME              STATUS
# vault-demo        Up (healthy)
# vault-init        Up (exited 0)
# vault-custom-ui   Up
# vault-backup      Up
```

### ✅ Check Logs

```bash
# Vault logs should show "dev mode" ready
[ ] docker-compose logs vault | grep "Development mode"

# Init logs should show success
[ ] docker-compose logs vault-init | grep "✅ Vault đã được khởi tạo"

# UI logs should show server running
[ ] docker-compose logs custom-ui | grep "Custom Vault UI running"
```

---

## 🧪 Functional Tests

### ✅ Test 1: Vault API

```bash
# Health check
[ ] curl -s http://localhost:8200/v1/sys/health | jq .initialized
    # Expected: true

# Vault status
[ ] docker exec vault-demo vault status
    # Expected: Sealed = false, Initialized = true
```

### ✅ Test 2: Authentication

```bash
[ ] export VAULT_ADDR=http://localhost:8200
[ ] vault login -method=userpass username=admin password=admin123
    # Expected: Success! Token stored

[ ] vault token lookup | grep policies
    # Expected: policies = ["admin-policy"]
```

### ✅ Test 3: Read Secrets

```bash
[ ] vault kv get secret/database/mysql
    # Expected: See host, username, password fields

[ ] vault kv get secret/api/stripe
    # Expected: See api_key, webhook_secret

[ ] vault kv get secret/ssl/example.com
    # Expected: See certificate (PEM format)
```

### ✅ Test 4: Permissions

```bash
# Login as dev1
[ ] vault login -method=userpass username=dev1 password=dev123

# Dev1 can read dev secrets
[ ] vault kv get secret/dev/dev1-api-keys
    # Expected: Success

# Dev1 cannot read ops secrets
[ ] vault kv get secret/ops/monitoring-grafana 2>&1 | grep "permission denied"
    # Expected: permission denied error
```

### ✅ Test 5: Team Secrets

```bash
# Login as dev1
[ ] vault login -method=userpass username=dev1 password=dev123

# Dev1 can read team/development
[ ] vault kv get team/development/staging-db
    # Expected: Success

# Dev1 cannot delete team secrets
[ ] vault kv delete team/development/staging-db 2>&1 | grep "permission denied"
    # Expected: permission denied error
```

### ✅ Test 6: Audit Log

```bash
# Perform some actions
[ ] vault kv get secret/database/mysql
[ ] vault kv get secret/api/aws

# Check audit log exists
[ ] docker exec vault-demo ls -lh /vault/logs/audit.log
    # Expected: File exists and growing

# Check audit log format
[ ] docker exec vault-demo cat /vault/logs/audit.log | head -n 1 | jq .type
    # Expected: "request" or "response"
```

### ✅ Test 7: PKI

```bash
[ ] vault write pki/issue/dev-role \
      common_name="test.dev.example.com" \
      ttl="24h" -format=json | jq -r .data.certificate | head -n 1
    # Expected: -----BEGIN CERTIFICATE-----
```

### ✅ Test 8: Backup

```bash
# Check backup container running
[ ] docker-compose ps vault-backup | grep "Up"
    # Expected: Up

# Trigger manual backup
[ ] docker exec vault-backup sh /backup-script.sh
    # Expected: ✅ Backup thành công

# Verify backup file created
[ ] ls -lh backups/vault_backup_*.json.gz
    # Expected: At least one backup file
```

---

## 🌐 Web UI Tests

### ✅ Test 9: Custom UI Access

```bash
# UI should be accessible
[ ] curl -s http://localhost:8080/health | jq .status
    # Expected: "ok"

# Open in browser
[ ] open http://localhost:8080
    # Or: xdg-open http://localhost:8080 (Linux)
```

### ✅ Test 10: UI Login

```
[ ] Open http://localhost:8080
[ ] Enter username: admin
[ ] Enter password: admin123
[ ] Click "Đăng nhập"
[ ] Verify: Redirected to dashboard with user info bar
```

### ✅ Test 11: UI Navigation

```
[ ] Click tab "📦 Secrets"
    → Should show personal secrets in cards

[ ] Click tab "🤝 Team Secrets"
    → Should show team shared secrets

[ ] Click tab "🔐 PKI"
    → Should show certificate roles

[ ] Click tab "📊 Statistics"
    → Should show stats dashboard

[ ] Click tab "📝 Audit Log"
    → Should show audit configuration
```

### ✅ Test 12: UI Operations

```
[ ] In "📦 Secrets" tab:
    [ ] Click "Copy" button next to a password
    [ ] Verify: Button shows "✓ Copied!"
    [ ] Paste in notepad → Should have password value

[ ] Click "+ Tạo Secret Mới"
    [ ] Select mount: secret
    [ ] Enter path: test/demo
    [ ] Enter data: {"key": "value"}
    [ ] Click "Tạo Secret"
    [ ] Verify: Success message, secret appears in list

[ ] In "🔐 PKI" tab:
    [ ] Click "Issue Certificate" on dev-role
    [ ] Enter common name: app.dev.example.com
    [ ] Click "Issue Certificate"
    [ ] Verify: Certificate and private key displayed
```

---

## 📊 Performance Tests

### ✅ Test 13: Response Time

```bash
# Vault API response time
[ ] time curl -s http://localhost:8200/v1/sys/health > /dev/null
    # Expected: < 100ms

# UI response time
[ ] time curl -s http://localhost:8080/health > /dev/null
    # Expected: < 200ms
```

### ✅ Test 14: Concurrent Access

```bash
# Multiple users login simultaneously
[ ] for i in {1..5}; do
      vault login -method=userpass username=dev1 password=dev123 &
    done; wait
    # Expected: All succeed
```

---

## 🔒 Security Tests

### ✅ Test 15: Token Expiry

```bash
[ ] vault login -method=userpass username=guest password=guest123
    # Guest token TTL: 1h

[ ] vault token lookup | grep ttl
    # Expected: ttl = 3600 (1 hour)

# After 1 hour, token should expire
# [ ] sleep 3601 && vault kv list secret/ 2>&1 | grep "permission denied"
```

### ✅ Test 16: Policy Enforcement

```bash
# Try to escalate privileges
[ ] vault login -method=userpass username=dev1 password=dev123
[ ] vault policy write test-policy - <<EOF
path "secret/*" {
  capabilities = ["create", "read", "update", "delete"]
}
EOF
    # Expected: permission denied (dev1 cannot create policies)
```

---

## 📈 Monitoring Checklist

### ✅ Test 17: Container Health

```bash
[ ] docker-compose ps | grep -v "Up" | wc -l
    # Expected: 1 (only header line)

[ ] docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
    # Expected: All containers < 50% CPU, < 500MB RAM
```

### ✅ Test 18: Logs Quality

```bash
# No errors in vault logs
[ ] docker-compose logs vault | grep -i error | wc -l
    # Expected: 0

# Backup running every hour
[ ] docker-compose logs vault-backup | grep "✅ Backup thành công" | wc -l
    # Expected: > 0
```

---

## 🧹 Cleanup Checklist

### ✅ After Demo

```bash
# Stop services
[ ] docker-compose down
    # Expected: Stopping and removing containers

# Keep backups (optional)
[ ] ls backups/
    # Backup files preserved

# Remove everything including backups
[ ] docker-compose down -v
[ ] rm -rf backups/
    # Expected: All cleaned up
```

---

## 📋 Summary Report

Fill in after completing all tests:

```
Date: _______________
Tester: _______________

Files Setup:        [ ] Pass  [ ] Fail
System Requirements: [ ] Pass  [ ] Fail
Services Running:   [ ] Pass  [ ] Fail
Vault API:          [ ] Pass  [ ] Fail
Authentication:     [ ] Pass  [ ] Fail
Read Secrets:       [ ] Pass  [ ] Fail
Permissions:        [ ] Pass  [ ] Fail
Team Secrets:       [ ] Pass  [ ] Fail
Audit Log:          [ ] Pass  [ ] Fail
PKI:                [ ] Pass  [ ] Fail
Backup:             [ ] Pass  [ ] Fail
Web UI Access:      [ ] Pass  [ ] Fail
UI Login:           [ ] Pass  [ ] Fail
UI Navigation:      [ ] Pass  [ ] Fail
UI Operations:      [ ] Pass  [ ] Fail
Performance:        [ ] Pass  [ ] Fail
Security:           [ ] Pass  [ ] Fail
Monitoring:         [ ] Pass  [ ] Fail

Overall Status:     [ ] Pass  [ ] Fail

Notes:
_______________________________________________
_______________________________________________
_______________________________________________
```

---

## 🐛 Common Issues & Solutions

### Issue 1: Port already in use
```bash
# Error: Bind for 0.0.0.0:8200 failed: port is already allocated

# Solution:
lsof -ti:8200 | xargs kill -9
lsof -ti:8080 | xargs kill -9
docker-compose up -d
```

### Issue 2: Container won't start
```bash
# Error: vault-demo exited with code 1

# Solution:
docker-compose logs vault  # Check error
docker-compose down -v     # Remove volumes
docker-compose up -d       # Restart fresh
```

### Issue 3: Vault not initialized
```bash
# Error: Error making API request... vault is sealed

# Solution:
docker-compose restart vault
docker-compose logs vault-init  # Check init completed
```

### Issue 4: Permission denied on secrets
```bash
# Error: permission denied

# Solution:
vault token lookup  # Check current policies
vault login -method=userpass username=admin  # Login as admin
vault policy read <policy-name>  # Verify policy
```

### Issue 5: UI not loading
```bash
# Error: ERR_CONNECTION_REFUSED

# Solution:
docker-compose logs custom-ui  # Check UI logs
docker-compose restart custom-ui
curl http://localhost:8080/health  # Test health
```

### Issue 6: Backup not running
```bash
# Error: No backup files in backups/

# Solution:
docker-compose logs vault-backup  # Check logs
docker exec vault-backup sh /backup-script.sh  # Manual trigger
ls -lh backups/  # Verify file created
```

### Issue 7: Audit log empty
```bash
# Error: cat: can't open '/vault/logs/audit.log'

# Solution:
docker exec vault-demo vault audit list  # Check audit enabled
docker exec vault-demo ls -la /vault/logs/  # Check directory
# Re-enable audit if needed:
docker exec vault-demo vault audit enable file file_path=/vault/logs/audit.log
```

### Issue 8: Can't connect to Vault from CLI
```bash
# Error: Get "https://127.0.0.1:8200": dial tcp connection refused

# Solution:
export VAULT_ADDR='http://localhost:8200'  # Use HTTP, not HTTPS
export VAULT_TOKEN='root-token-demo'       # Set token
vault status  # Test connection
```

### Issue 9: npm install fails
```bash
# Error: npm ERR! network

# Solution:
docker-compose build --no-cache custom-ui
docker-compose up -d custom-ui
```

### Issue 10: Out of disk space
```bash
# Error: no space left on device

# Solution:
docker system prune -a  # Clean Docker cache
rm -rf backups/*.json.gz  # Remove old backups
df -h  # Check space
```

---

## 🔧 Advanced Verification

### Verify Encryption at Rest

```bash
# Check Vault storage
[ ] docker exec vault-demo ls -la /vault/file/
    # Expected: Encrypted binary files, not readable plaintext

# Try to read raw storage (should be encrypted)
[ ] docker exec vault-demo cat /vault/file/logical/* | strings | grep -i password
    # Expected: No passwords visible (encrypted)
```

### Verify Audit Log Completeness

```bash
# Count operations
[ ] TOTAL_OPS=$(docker exec vault-demo cat /vault/logs/audit.log | wc -l)
[ ] echo "Total operations logged: $TOTAL_OPS"
    # Expected: > 100 (from init + tests)

# Verify all users logged
[ ] docker exec vault-demo cat /vault/logs/audit.log | \
      jq -r '.auth.display_name' | sort -u
    # Expected: admin, dev1, dev2, ops1, ops2, guest
```

### Verify Policy Isolation

```bash
# Test matrix
USERS=("dev1" "ops1" "guest")
SECRETS=("secret/dev/dev1-api-keys" "secret/ops/monitoring-grafana" "secret/database/mysql")

for user in "${USERS[@]}"; do
  echo "Testing $user:"
  vault login -method=userpass username=$user password=${user#*[0-9]}123
  for secret in "${SECRETS[@]}"; do
    vault kv get $secret > /dev/null 2>&1
    [ $? -eq 0 ] && echo "  ✅ $secret" || echo "  ❌ $secret (expected)"
  done
done
```

### Verify Backup Integrity

```bash
# Test backup/restore cycle
[ ] LATEST_BACKUP=$(ls -t backups/*.json.gz | head -n1)
[ ] vault kv put secret/test/backup-test value="test123"
[ ] vault kv delete secret/test/backup-test
[ ] docker exec vault-demo sh /restore-script.sh $LATEST_BACKUP
[ ] vault kv get secret/test/backup-test | grep "test123"
    # Expected: Value restored
```

---

## 📊 Performance Benchmarks

### Expected Performance Metrics

```bash
# Vault API response time
[ ] for i in {1..100}; do
      time curl -s http://localhost:8200/v1/sys/health > /dev/null
    done 2>&1 | grep real | awk '{print $2}' | \
    awk '{sum+=$1; count++} END {print "Average:", sum/count "ms"}'
    # Expected: < 50ms average

# Secret read latency
[ ] for i in {1..50}; do
      time vault kv get secret/database/mysql > /dev/null
    done 2>&1 | grep real
    # Expected: < 100ms per operation

# UI load time
[ ] time curl -s http://localhost:8080 > /dev/null
    # Expected: < 200ms
```

### Resource Usage

```bash
# Memory usage
[ ] docker stats --no-stream --format "{{.Name}}\t{{.MemUsage}}" | grep vault
    # Expected: 
    # vault-demo: < 200MB
    # vault-custom-ui: < 100MB
    # vault-backup: < 50MB

# Disk usage
[ ] du -sh backups/
    # Expected: < 100MB (for 7 days × 24 backups)

[ ] docker system df
    # Expected: Total < 2GB
```

---

## 🎯 Acceptance Criteria

Demo is **PRODUCTION READY FOR DEV** if:

✅ All 18 functional tests pass  
✅ No error logs in any container  
✅ UI accessible and all tabs working  
✅ Permissions enforced correctly  
✅ Audit log capturing all operations  
✅ Backup running every hour  
✅ Average response time < 100ms  
✅ Memory usage < 500MB total  

---

## 📞 Support Contacts

If you encounter issues not covered here:

1. **Check logs first:**
   ```bash
   docker-compose logs -f
   ```

2. **Search GitHub issues:**
   - HashiCorp Vault: https://github.com/hashicorp/vault/issues

3. **Community resources:**
   - Vault Discuss: https://discuss.hashicorp.com/c/vault
   - Vault Documentation: https://www.vaultproject.io/docs

---

## 🎓 Learning Path

After completing this demo:

### Next Steps

1. **Learn Vault CLI:**
   - https://learn.hashicorp.com/vault
   - Practice all commands in README.md

2. **Understand Policies:**
   - Read: https://www.vaultproject.io/docs/concepts/policies
   - Create custom policies for your use case

3. **Explore More Secrets Engines:**
   - Database dynamic credentials
   - AWS dynamic IAM credentials
   - SSH certificate authority
   - Transit encryption-as-a-service

4. **Production Planning:**
   - Read: https://www.vaultproject.io/docs/internals/architecture
   - Study HA deployment patterns
   - Plan disaster recovery strategy

---

## 📝 Checklist Usage

**For Demo/Training:**
1. Print this checklist
2. Go through each item
3. Check boxes as you verify
4. Note any failures for troubleshooting

**For CI/CD Integration:**
```bash
#!/bin/bash
# automated-test.sh

set -e

echo "Running Vault demo tests..."

# Test 1: Services up
docker-compose ps | grep "Up" || exit 1

# Test 2: Vault healthy
curl -f http://localhost:8200/v1/sys/health || exit 1

# Test 3: UI accessible
curl -f http://localhost:8080/health || exit 1

# Test 4: Login works
vault login -method=userpass username=admin password=admin123 || exit 1

# Test 5: Read secret
vault kv get secret/database/mysql || exit 1

echo "✅ All tests passed!"
```

---

## 🏆 Certification

Complete this certification after finishing all tests:

```
I, __________________ (name), certify that:

✅ I have reviewed all files in the demo
✅ I have started all Docker services successfully
✅ I have completed all 18 functional tests
✅ I have tested the web UI with multiple users
✅ I understand how Vault addresses each requirement
✅ I can troubleshoot common issues
✅ I have verified backup and restore functionality

This demo is ready for: [ ] Development  [ ] Training  [ ] POC

Date: ______________
Signature: ______________
```

---

## 📚 Appendix: Quick Reference

### Useful Commands

```bash
# Start demo
docker-compose up -d

# Stop demo
docker-compose down

# Restart service
docker-compose restart <service>

# View logs
docker-compose logs -f <service>

# Execute command in container
docker exec -it vault-demo <command>

# Clean everything
docker-compose down -v && rm -rf backups/

# Export root token
export VAULT_TOKEN=root-token-demo

# List all secrets
vault kv list secret/

# Backup now
docker exec vault-backup sh /backup-script.sh
```

### Port Reference

| Service | Port | URL |
|---------|------|-----|
| Vault API | 8200 | http://localhost:8200 |
| Vault UI | 8200 | http://localhost:8200/ui |
| Custom UI | 8080 | http://localhost:8080 |

### User Reference

| User | Password | Policies | TTL |
|------|----------|----------|-----|
| admin | admin123 | admin-policy | 8h |
| lead1 | lead123 | teamlead-policy | 8h |
| dev1, dev2 | dev123 | dev-policy | 4h |
| ops1, ops2 | ops123 | ops-policy | 4h |
| guest | guest123 | readonly-policy | 1h |

### Path Reference

| Mount | Purpose | Example Path |
|-------|---------|--------------|
| secret/ | Personal secrets | secret/database/mysql |
| team/ | Team shared secrets | team/development/staging-db |
| pki/ | Certificate authority | pki/issue/dev-role |

---

**Demo Version:** 1.0  
**Last Updated:** 2025-01-15  
**Vault Version:** Latest (1.15+)  
**Compatibility:** Docker 20.10+, Docker Compose 2.0+
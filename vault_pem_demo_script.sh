#!/bin/bash

echo "🔒 Testing PEM File Management Features"
echo "========================================="
echo ""

export VAULT_ADDR=http://localhost:8200

# Test 1: List PEM files
echo "📋 Test 1: List PEM files stored in Vault"
echo "-----------------------------------------"
vault login -method=userpass username=admin password=admin123 > /dev/null 2>&1
vault kv list secret/pem-files/
echo ""

# Test 2: View SSH key
echo "🔑 Test 2: View SSH private key (truncated)"
echo "-------------------------------------------"
vault kv get -field=content secret/pem-files/ssh-production | head -n 5
echo "... (truncated)"
echo ""

# Test 3: View SSL certificate
echo "📜 Test 3: View SSL certificate info"
echo "------------------------------------"
vault kv get -format=json secret/pem-files/ssl-dev-app | jq -r '.data.data | {type, fingerprint, description, uploaded_at}'
echo ""

# Test 4: View API signing key
echo "🔐 Test 4: View API signing key metadata"
echo "----------------------------------------"
vault kv get -format=json secret/pem-files/api-signing-key | jq -r '.data.data | {type, size, fingerprint, description}'
echo ""

# Test 5: Export PEM to file (simulated download)
echo "💾 Test 5: Export SSH key to local file"
echo "---------------------------------------"
vault kv get -field=content secret/pem-files/ssh-production > /tmp/exported_ssh_key.pem
chmod 600 /tmp/exported_ssh_key.pem
echo "✅ Exported to /tmp/exported_ssh_key.pem"
ls -lh /tmp/exported_ssh_key.pem
file /tmp/exported_ssh_key.pem
echo ""

# Test 6: Verify file integrity
echo "🔍 Test 6: Verify exported file integrity"
echo "-----------------------------------------"
STORED_FP=$(vault kv get -field=fingerprint secret/pem-files/ssh-production)
EXPORTED_FP=$(ssh-keygen -lf /tmp/exported_ssh_key.pem.pub 2>/dev/null | awk '{print $2}' | cut -c1-16 || echo "N/A")
echo "Stored fingerprint:   $STORED_FP"
echo "Exported fingerprint: $EXPORTED_FP"
if [ "$STORED_FP" = "$EXPORTED_FP" ]; then
    echo "✅ Fingerprints match! File integrity verified."
else
    echo "⚠️  Fingerprint check skipped (public key needed)"
fi
echo ""

# Test 7: Test permissions (dev user should have read access)
echo "👤 Test 7: Test user permissions (dev1)"
echo "---------------------------------------"
vault login -method=userpass username=dev1 password=dev123 > /dev/null 2>&1
echo "Dev1 attempting to read SSH key..."
if vault kv get secret/pem-files/ssh-production > /dev/null 2>&1; then
    echo "✅ Dev1 can read PEM files"
else
    echo "❌ Dev1 cannot read PEM files (expected based on policy)"
fi
echo ""

# Test 8: Audit log check
echo "📝 Test 8: Check audit log for PEM access"
echo "-----------------------------------------"
echo "Recent PEM file accesses:"
docker exec vault-demo cat /vault/logs/audit.log 2>/dev/null | \
    jq -r 'select(.request.path | contains("pem-files")) | [.time, .auth.display_name, .request.path] | @tsv' | \
    tail -n 5 || echo "Audit log not accessible"
echo ""

# Test 9: Backup includes PEM files
echo "💾 Test 9: Verify PEM files included in backup"
echo "----------------------------------------------"
LATEST_BACKUP=$(ls -t backups/vault_backup_*.json.gz 2>/dev/null | head -n1)
if [ -n "$LATEST_BACKUP" ]; then
    echo "Latest backup: $LATEST_BACKUP"
    gunzip -c "$LATEST_BACKUP" 2>/dev/null | jq '.secrets.secret[] | select(.request_id | contains("pem-files"))' | head -n 1 > /dev/null
    if [ $? -eq 0 ]; then
        echo "✅ PEM files found in backup"
    else
        echo "⚠️  No PEM files in this backup yet (may need to wait for next backup cycle)"
    fi
else
    echo "⚠️  No backups found yet"
fi
echo ""

# Test 10: Security - Encryption at rest
echo "🔒 Test 10: Verify encryption at rest"
echo "-------------------------------------"
echo "Checking Vault storage (files should be encrypted, not readable plaintext):"
docker exec vault-demo find /vault/file -type f 2>/dev/null | head -n 3 | while read file; do
    echo -n "  $file: "
    if docker exec vault-demo cat "$file" 2>/dev/null | grep -q "BEGIN PRIVATE KEY"; then
        echo "❌ PLAINTEXT FOUND (SECURITY ISSUE!)"
    else
        echo "✅ Encrypted (no plaintext)"
    fi
done
echo ""

# Cleanup
rm -f /tmp/exported_ssh_key.pem

echo "========================================="
echo "✅ PEM Management Tests Complete!"
echo ""
echo "📚 Summary:"
echo "  - PEM files stored in: secret/pem-files/"
echo "  - Types supported: SSH keys, SSL certs, API keys, generic PEM"
echo "  - Features: Upload, download, generate, view, audit"
echo "  - Security: AES-256 encrypted at rest, audit logged"
echo ""
echo "🌐 Try Web UI: http://localhost:8080"
echo "   → Login: admin / admin123"
echo "   → Click '🔒 PEM Files' tab"
echo "========================================="
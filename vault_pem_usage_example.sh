#!/bin/bash

# PEM File Usage Examples - Real World Scenarios
# This script demonstrates safe ways to use PEM files from Vault

export VAULT_ADDR=http://localhost:8200

echo "🔐 PEM File Usage Examples from Vault"
echo "======================================"
echo ""

# Login
vault login -method=userpass username=admin password=admin123 > /dev/null 2>&1

# ============================================
# Example 1: SSH to server using stored key
# ============================================
echo "📡 Example 1: SSH to production server"
echo "--------------------------------------"
echo "Scenario: Need to SSH to production server without storing key on local disk"
echo ""

# Fetch SSH key from Vault (in-memory only)
echo "1. Fetching SSH private key from Vault..."
vault kv get -field=content secret/pem-files/ssh-production > /tmp/ssh_key_temp
chmod 600 /tmp/ssh_key_temp

echo "2. Using key for SSH connection..."
echo "   Command: ssh -i /tmp/ssh_key_temp user@production-server.com"
echo "   (Demo only - server doesn't exist)"

echo "3. Cleanup: Delete temporary key file"
rm -f /tmp/ssh_key_temp
echo "   ✅ Key removed from disk after use"
echo ""

# ============================================
# Example 2: Configure NGINX with SSL cert
# ============================================
echo "🌐 Example 2: Configure NGINX with SSL certificate"
echo "--------------------------------------------------"
echo "Scenario: Deploy SSL certificate to NGINX without manual file management"
echo ""

# Fetch SSL certificate and key
echo "1. Fetching SSL certificate and private key..."
vault kv get -field=content secret/pem-files/ssl-dev-app > /tmp/ssl_cert.pem
vault kv get -field=private_key secret/pem-files/ssl-dev-app > /tmp/ssl_key.pem

echo "2. Deploy to NGINX configuration..."
cat > /tmp/nginx_ssl.conf <<EOF
server {
    listen 443 ssl;
    server_name app.dev.example.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    # Fetched from Vault: secret/pem-files/ssl-dev-app
    # Last updated: $(date)
}
EOF

echo "   ✅ NGINX config created: /tmp/nginx_ssl.conf"
echo "   In production: Copy cert to /etc/nginx/ssl/ and reload NGINX"

echo "3. Cleanup"
rm -f /tmp/ssl_cert.pem /tmp/ssl_key.pem /tmp/nginx_ssl.conf
echo "   ✅ Temporary files removed"
echo ""

# ============================================
# Example 3: Sign API requests with RSA key
# ============================================
echo "🔏 Example 3: Sign API requests with RSA private key"
echo "----------------------------------------------------"
echo "Scenario: Sign API requests for authentication"
echo ""

# Fetch API signing key
echo "1. Fetching RSA private key from Vault..."
vault kv get -field=private_key secret/pem-files/api-signing-key > /tmp/api_key.pem

echo "2. Generate signature for API request..."
# Example payload
PAYLOAD='{"user": "admin", "action": "deploy", "timestamp": "'$(date -u +%s)'"}'
echo "   Payload: $PAYLOAD"

# Sign with private key
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -sign /tmp/api_key.pem | base64 | tr -d '\n')
echo "   Signature: ${SIGNATURE:0:50}..."

echo "3. Send API request with signature"
echo "   curl -X POST https://api.example.com/deploy \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -H 'X-Signature: $SIGNATURE' \\"
echo "     -d '$PAYLOAD'"

echo "4. Cleanup"
rm -f /tmp/api_key.pem
echo "   ✅ Private key removed after use"
echo ""

# ============================================
# Example 4: Kubernetes Secret from Vault PEM
# ============================================
echo "☸️  Example 4: Create Kubernetes TLS Secret"
echo "--------------------------------------------"
echo "Scenario: Deploy SSL certificate to Kubernetes cluster"
echo ""

echo "1. Fetching certificate from Vault..."
CERT_CONTENT=$(vault kv get -field=content secret/pem-files/ssl-dev-app)
KEY_CONTENT=$(vault kv get -field=private_key secret/pem-files/ssl-dev-app)

echo "2. Creating Kubernetes TLS secret..."
cat > /tmp/k8s_secret.yaml <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: app-tls-secret
  namespace: production
type: kubernetes.io/tls
data:
  tls.crt: $(echo "$CERT_CONTENT" | base64 | tr -d '\n')
  tls.key: $(echo "$KEY_CONTENT" | base64 | tr -d '\n')
EOF

echo "   ✅ Kubernetes secret manifest created: /tmp/k8s_secret.yaml"
echo "   Deploy with: kubectl apply -f /tmp/k8s_secret.yaml"

echo "3. Cleanup"
rm -f /tmp/k8s_secret.yaml
echo "   ✅ Secret manifest removed"
echo ""

# ============================================
# Example 5: Automated Certificate Rotation
# ============================================
echo "🔄 Example 5: Automated Certificate Rotation Script"
echo "---------------------------------------------------"
echo "Scenario: Rotate SSL certificates automatically"
echo ""

cat > /tmp/rotate_cert.sh <<'ROTATE_SCRIPT'
#!/bin/bash
# Certificate Rotation Script

VAULT_ADDR=http://localhost:8200
CERT_PATH=secret/pem-files/ssl-dev-app

# Login to Vault
vault login -method=userpass username=admin password=admin123

# Check certificate expiry
CERT_DATA=$(vault kv get -field=content $CERT_PATH)
# In production: Parse certificate and check expiry date
# Example: openssl x509 -in cert.pem -noout -enddate

# If certificate is expiring soon (< 30 days), generate new one
echo "Checking certificate expiry..."
# vault write pki/issue/prod-role common_name=app.example.com ttl=8760h

# Update PEM file in Vault
# vault kv put $CERT_PATH content="$NEW_CERT" private_key="$NEW_KEY"

# Deploy to servers
echo "Deploying new certificate to servers..."
# ansible-playbook deploy-cert.yml

echo "Certificate rotation complete!"
ROTATE_SCRIPT

chmod +x /tmp/rotate_cert.sh
echo "1. Created rotation script: /tmp/rotate_cert.sh"
echo "2. Schedule with cron: 0 0 * * 0 /tmp/rotate_cert.sh"
echo "   (Runs weekly to check and rotate if needed)"
echo ""

# ============================================
# Example 6: Docker Registry Authentication
# ============================================
echo "🐳 Example 6: Docker Registry with TLS Certificate"
echo "--------------------------------------------------"
echo "Scenario: Configure Docker registry with custom CA"
echo ""

echo "1. Fetching CA certificate from Vault..."
vault kv get -field=content secret/pem-files/ssl-dev-app > /tmp/ca.crt

echo "2. Install CA certificate for Docker..."
echo "   sudo mkdir -p /etc/docker/certs.d/registry.example.com"
echo "   sudo cp /tmp/ca.crt /etc/docker/certs.d/registry.example.com/ca.crt"
echo "   sudo systemctl restart docker"

echo "3. Test Docker login..."
echo "   docker login registry.example.com"

echo "4. Cleanup"
rm -f /tmp/ca.crt
echo "   ✅ Temporary CA file removed"
echo ""

# ============================================
# Example 7: Application Configuration with PEM
# ============================================
echo "⚙️  Example 7: Application Configuration"
echo "----------------------------------------"
echo "Scenario: Configure application with database SSL certificate"
echo ""

# Fetch database SSL cert
vault kv get -field=content secret/pem-files/ssl-dev-app > /tmp/db_ca.pem

cat > /tmp/app_config.yml <<EOF
database:
  host: postgres.example.com
  port: 5432
  username: app_user
  password: \${DB_PASSWORD}  # From environment variable
  ssl_mode: require
  ssl_ca: /app/certs/ca.pem  # Fetched from Vault
  
# Certificate fetched from: secret/pem-files/ssl-dev-app
# Last updated: $(date)
# Managed by: Vault
EOF

echo "1. ✅ Application config created: /tmp/app_config.yml"
echo "2. Deploy certificate to application container:"
echo "   docker cp /tmp/db_ca.pem app_container:/app/certs/ca.pem"

rm -f /tmp/db_ca.pem /tmp/app_config.yml
echo "3. ✅ Cleanup complete"
echo ""

# ============================================
# Example 8: CI/CD Pipeline Integration
# ============================================
echo "🚀 Example 8: CI/CD Pipeline Integration"
echo "----------------------------------------"
echo "Scenario: Use PEM files in GitLab CI/CD pipeline"
echo ""

cat > /tmp/.gitlab-ci.yml <<'GITLAB_CI'
deploy_production:
  stage: deploy
  script:
    # Login to Vault
    - export VAULT_TOKEN=$(vault login -method=jwt -token-only role=gitlab-ci jwt=$CI_JOB_JWT)
    
    # Fetch SSH key from Vault
    - vault kv get -field=content secret/pem-files/ssh-production > /tmp/deploy_key
    - chmod 600 /tmp/deploy_key
    
    # Deploy using SSH
    - ssh -i /tmp/deploy_key deploy@production-server.com "cd /app && git pull && systemctl restart app"
    
    # Cleanup
    - rm -f /tmp/deploy_key
  only:
    - main
GITLAB_CI

echo "1. ✅ GitLab CI config created: /tmp/.gitlab-ci.yml"
echo "2. Benefits:"
echo "   - No SSH keys stored in GitLab variables"
echo "   - Centralized key management in Vault"
echo "   - Automatic key rotation support"
echo "   - Audit trail of all deployments"
echo ""

# ============================================
# Example 9: Secure Email with S/MIME
# ============================================
echo "📧 Example 9: Sign Email with S/MIME Certificate"
echo "------------------------------------------------"
echo "Scenario: Sign important emails with S/MIME certificate"
echo ""

vault kv get -field=private_key secret/pem-files/api-signing-key > /tmp/smime.key
vault kv get -field=public_key secret/pem-files/api-signing-key > /tmp/smime.crt

cat > /tmp/email.txt <<EOF
Subject: System Alert - Production Deployment
To: team@example.com
From: automation@example.com

Production deployment completed successfully.
Timestamp: $(date)
Signed by: Vault Automation System
EOF

echo "1. Email content created"
echo "2. Signing email with S/MIME..."
echo "   openssl smime -sign -in email.txt -text -out email_signed.txt \\"
echo "     -signer smime.crt -inkey smime.key"
echo "3. ✅ Email signed and ready to send"

rm -f /tmp/smime.key /tmp/smime.crt /tmp/email.txt
echo "4. ✅ Cleanup complete"
echo ""

# ============================================
# Example 10: Monitoring and Alerting
# ============================================
echo "📊 Example 10: Monitor Certificate Expiry"
echo "-----------------------------------------"
echo "Scenario: Alert when certificates are about to expire"
echo ""

cat > /tmp/monitor_certs.sh <<'MONITOR_SCRIPT'
#!/bin/bash

VAULT_ADDR=http://localhost:8200
vault login -method=userpass username=monitoring password=monitor123

# List all PEM files
PEM_FILES=$(vault kv list -format=json secret/pem-files/ | jq -r '.[]')

for pem in $PEM_FILES; do
    echo "Checking: $pem"
    
    # Get certificate content
    CONTENT=$(vault kv get -field=content secret/pem-files/$pem 2>/dev/null)
    
    if echo "$CONTENT" | grep -q "BEGIN CERTIFICATE"; then
        # Parse expiry date
        EXPIRY=$(echo "$CONTENT" | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
        DAYS_LEFT=$(( ($(date -d "$EXPIRY" +%s) - $(date +%s)) / 86400 ))
        
        echo "  Expires: $EXPIRY ($DAYS_LEFT days left)"
        
        if [ $DAYS_LEFT -lt 30 ]; then
            echo "  ⚠️  WARNING: Certificate expires in $DAYS_LEFT days!"
            # Send alert
            # curl -X POST https://hooks.slack.com/services/YOUR/WEBHOOK \
            #   -d '{"text":"Certificate '$pem' expires in '$DAYS_LEFT' days!"}'
        fi
    fi
done
MONITOR_SCRIPT

chmod +x /tmp/monitor_certs.sh
echo "1. ✅ Monitoring script created: /tmp/monitor_certs.sh"
echo "2. Schedule with cron: 0 9 * * * /tmp/monitor_certs.sh"
echo "   (Runs daily at 9 AM)"
echo ""

# ============================================
# Security Best Practices
# ============================================
echo "🔒 Security Best Practices for PEM Files"
echo "=========================================="
echo ""
echo "✅ DO:"
echo "  1. Always delete PEM files from disk after use"
echo "  2. Use in-memory processing when possible"
echo "  3. Set restrictive permissions (chmod 600) on temp files"
echo "  4. Rotate certificates regularly"
echo "  5. Monitor audit logs for PEM access"
echo "  6. Use time-limited Vault tokens"
echo "  7. Implement least-privilege access policies"
echo ""
echo "❌ DON'T:"
echo "  1. Store PEM files in version control (Git)"
echo "  2. Email or share PEM files via insecure channels"
echo "  3. Use the same certificate across environments"
echo "  4. Keep expired certificates in Vault"
echo "  5. Grant broad access to all PEM files"
echo "  6. Skip audit log review"
echo ""

# ============================================
# Vault CLI Quick Reference
# ============================================
echo "📚 Vault CLI Quick Reference for PEM Files"
echo "==========================================="
echo ""
echo "# Upload PEM file (via UI or API)"
echo "vault kv put secret/pem-files/my-cert \\"
echo "  content=@certificate.pem \\"
echo "  type=certificate \\"
echo "  description='Production SSL certificate'"
echo ""
echo "# Download PEM file"
echo "vault kv get -field=content secret/pem-files/my-cert > cert.pem"
echo ""
echo "# List all PEM files"
echo "vault kv list secret/pem-files/"
echo ""
echo "# Get PEM metadata"
echo "vault kv get -format=json secret/pem-files/my-cert | jq .data.data"
echo ""
echo "# Delete PEM file"
echo "vault kv delete secret/pem-files/my-cert"
echo ""
echo "# View audit log for PEM access"
echo "docker exec vault-demo cat /vault/logs/audit.log | \\"
echo "  jq 'select(.request.path | contains(\"pem-files\"))'"
echo ""

# Cleanup all temp files
rm -f /tmp/rotate_cert.sh /tmp/.gitlab-ci.yml /tmp/monitor_certs.sh

echo "=========================================="
echo "✅ PEM Usage Examples Complete!"
echo ""
echo "🌐 Try these features in the Web UI:"
echo "   http://localhost:8080"
echo "   → Login: admin / admin123"
echo "   → Click '🔒 PEM Files' tab"
echo "   → Upload, generate, or download PEM files"
echo ""
echo "📖 For more information:"
echo "   - README.md - Full documentation"
echo "   - test-pem-features.sh - Run automated tests"
echo "=========================================="
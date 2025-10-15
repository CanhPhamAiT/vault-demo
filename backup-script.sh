#!/bin/sh

# Vault Backup Script - Chạy định kỳ để backup secrets
# Yêu cầu: Backup & khôi phục khi máy user hỏng

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/vault_backup_${TIMESTAMP}.json"

echo "🔄 [$(date)] Bắt đầu backup Vault..."

# Kiểm tra Vault health
if ! vault status > /dev/null 2>&1; then
    echo "❌ Vault không khả dụng, bỏ qua backup"
    exit 1
fi

# Tạo thư mục backup nếu chưa có
mkdir -p ${BACKUP_DIR}

# Export tất cả secrets
echo "📦 Export secrets..."

# Hàm backup recursive
backup_secrets() {
    local mount=$1
    local path=$2
    
    echo "  → Backup ${mount}/${path}"
    
    # List keys
    keys=$(vault kv list -format=json "${mount}/${path}" 2>/dev/null | grep -v "null")
    
    if [ -n "$keys" ]; then
        echo "$keys" | jq -r '.[]' | while read key; do
            if echo "$key" | grep -q '/$'; then
                # Đây là folder, đệ quy
                backup_secrets "$mount" "${path}${key}"
            else
                # Đây là secret, export
                full_path="${mount}/data/${path}${key}"
                vault kv get -format=json "$full_path" >> "${BACKUP_FILE}.tmp" 2>/dev/null
            fi
        done
    fi
}

# Backup từng mount point
{
    echo "{"
    echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
    echo "  \"vault_version\": \"$(vault version | head -n1)\","
    echo "  \"secrets\": {"
} > "$BACKUP_FILE"

# Backup secret/ mount
echo "    \"secret\": [" >> "$BACKUP_FILE"
vault kv list -format=json secret/ 2>/dev/null | jq -r '.[]?' | while read path; do
    if [ -n "$path" ]; then
        vault kv get -format=json "secret/${path}" 2>/dev/null | jq -c '.' >> "$BACKUP_FILE"
        echo "," >> "$BACKUP_FILE"
    fi
done
# Xóa dấu phẩy cuối
sed -i '$ s/,$//' "$BACKUP_FILE"
echo "    ]," >> "$BACKUP_FILE"

# Backup team/ mount
echo "    \"team\": [" >> "$BACKUP_FILE"
vault kv list -format=json team/ 2>/dev/null | jq -r '.[]?' | while read path; do
    if [ -n "$path" ]; then
        vault kv get -format=json "team/${path}" 2>/dev/null | jq -c '.' >> "$BACKUP_FILE"
        echo "," >> "$BACKUP_FILE"
    fi
done
sed -i '$ s/,$//' "$BACKUP_FILE"
echo "    ]" >> "$BACKUP_FILE"

{
    echo "  },"
    echo "  \"policies\": $(vault policy list -format=json),"
    echo "  \"auth_methods\": $(vault auth list -format=json)"
    echo "}"
} >> "$BACKUP_FILE"

# Kiểm tra backup thành công
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    # Compress backup
    gzip "$BACKUP_FILE"
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
    
    echo "✅ Backup thành công: ${BACKUP_FILE}.gz (${BACKUP_SIZE})"
    
    # Xóa backup cũ hơn 7 ngày
    find ${BACKUP_DIR} -name "vault_backup_*.json.gz" -mtime +7 -delete
    
    # Đếm số backup hiện có
    BACKUP_COUNT=$(ls -1 ${BACKUP_DIR}/vault_backup_*.json.gz 2>/dev/null | wc -l)
    echo "📊 Tổng số backup: ${BACKUP_COUNT} files"
    
else
    echo "❌ Backup thất bại"
    rm -f "$BACKUP_FILE" "${BACKUP_FILE}.tmp"
    exit 1
fi

echo "✅ [$(date)] Backup hoàn tất"
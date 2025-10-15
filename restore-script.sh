#!/bin/sh

# Vault Restore Script - Khôi phục từ backup
# Sử dụng: ./restore-script.sh <backup_file.json.gz>

if [ -z "$1" ]; then
    echo "❌ Sử dụng: ./restore-script.sh <backup_file.json.gz>"
    echo ""
    echo "📋 Danh sách backup có sẵn:"
    ls -lh /backups/vault_backup_*.json.gz 2>/dev/null || echo "  Không có backup nào"
    exit 1
fi

BACKUP_FILE=$1

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ File backup không tồn tại: $BACKUP_FILE"
    exit 1
fi

echo "🔄 Bắt đầu khôi phục từ backup: $BACKUP_FILE"
echo "⚠️  Cảnh báo: Quá trình này sẽ ghi đè secrets hiện tại!"
echo ""
read -p "Bạn có chắc chắn muốn tiếp tục? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Đã hủy khôi phục"
    exit 0
fi

# Giải nén backup
TEMP_FILE="/tmp/vault_restore_$$.json"
gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"

if [ ! -s "$TEMP_FILE" ]; then
    echo "❌ Không thể giải nén backup"
    rm -f "$TEMP_FILE"
    exit 1
fi

echo "📦 Đang khôi phục secrets..."

# Parse và restore từng secret
jq -r '.secrets.secret[]? | @json' "$TEMP_FILE" | while read secret_json; do
    path=$(echo "$secret_json" | jq -r '.request_id' | sed 's/.*\/data\///')
    data=$(echo "$secret_json" | jq '.data.data')
    
    if [ -n "$path" ] && [ "$data" != "null" ]; then
        echo "  → Khôi phục secret/$path"
        echo "$data" | vault kv put "secret/$path" - 2>/dev/null
    fi
done

# Restore team secrets
jq -r '.secrets.team[]? | @json' "$TEMP_FILE" | while read secret_json; do
    path=$(echo "$secret_json" | jq -r '.request_id' | sed 's/.*\/data\///')
    data=$(echo "$secret_json" | jq '.data.data')
    
    if [ -n "$path" ] && [ "$data" != "null" ]; then
        echo "  → Khôi phục team/$path"
        echo "$data" | vault kv put "team/$path" - 2>/dev/null
    fi
done

# Cleanup
rm -f "$TEMP_FILE"

echo ""
echo "✅ Khôi phục hoàn tất!"
echo "📊 Kiểm tra secrets đã khôi phục:"
echo "  vault kv list secret/"
echo "  vault kv list team/"
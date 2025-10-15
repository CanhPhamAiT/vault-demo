#!/bin/bash

echo "🚀 Vault Demo Quick Start Script"
echo "=================================="
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker chưa được cài đặt!"
    echo "   Vui lòng cài Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose chưa được cài đặt!"
    echo "   Vui lòng cài Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker và Docker Compose đã sẵn sàng"
echo ""

# Check ports
echo "🔍 Kiểm tra ports..."
if lsof -Pi :8200 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ Port 8200 đang được sử dụng!"
    echo "   Vault cần port 8200 để chạy"
    exit 1
fi

if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ Port 8080 đang được sử dụng!"
    echo "   Custom UI cần port 8080 để chạy"
    exit 1
fi

echo "✅ Ports 8200 và 8080 đang trống"
echo ""

# Create backup directory
echo "📁 Tạo thư mục backup..."
mkdir -p backups
echo "✅ Thư mục backups/ đã được tạo"
echo ""

# Make scripts executable
echo "🔧 Cấp quyền cho scripts..."
chmod +x init-vault.sh backup-script.sh restore-script.sh 2>/dev/null
echo "✅ Scripts đã được cấp quyền thực thi"
echo ""

# Start services
echo "🐳 Khởi động Docker services..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo "❌ Không thể khởi động services!"
    echo "   Kiểm tra lỗi ở trên"
    exit 1
fi

echo "✅ Services đã được khởi động"
echo ""

# Wait for Vault to be ready
echo "⏳ Đợi Vault khởi tạo (khoảng 30 giây)..."
sleep 10

# Check Vault health
for i in {1..30}; do
    if curl -s http://localhost:8200/v1/sys/health > /dev/null 2>&1; then
        echo "✅ Vault đã sẵn sàng!"
        break
    fi
    echo -n "."
    sleep 1
    
    if [ $i -eq 30 ]; then
        echo ""
        echo "⚠️  Vault mất nhiều thời gian hơn dự kiến"
        echo "   Vui lòng chờ thêm và kiểm tra logs:"
        echo "   docker-compose logs -f vault-init"
    fi
done

echo ""
echo "📊 Kiểm tra status services..."
docker-compose ps
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "✅ VAULT DEMO ĐÃ KHỞI ĐỘNG THÀNH CÔNG!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🌐 TRUY CẬP:"
echo "   Custom UI:      http://localhost:8080"
echo "   Vault API:      http://localhost:8200"
echo "   Vault Official: http://localhost:8200/ui"
echo ""
echo "🔑 CREDENTIALS:"
echo "   Root Token:     root-token-demo"
echo ""
echo "👥 DEMO USERS:"
echo "   admin/admin123  - Full quyền + audit"
echo "   lead1/lead123   - Team lead"
echo "   dev1/dev123     - Developer"
echo "   ops1/ops123     - Operations"
echo "   guest/guest123  - Read-only"
echo ""
echo "📝 XEM LOGS:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 DỪNG SERVICES:"
echo "   docker-compose down"
echo ""
echo "📚 ĐỌC THÊM:"
echo "   cat README.md"
echo "═══════════════════════════════════════════════════════════"
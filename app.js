let currentUser = null;
let currentTab = 'secrets';
const backendBase = location.origin;

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    showMessage('Đang đăng nhập...', 'success');

    try {
        const response = await fetch(`${backendBase}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (!response.ok || !data.ok) {
            const reason = data?.vault?.errors ? data.vault.errors.join('; ') : 'Đăng nhập thất bại';
            showMessage('Lỗi: ' + reason, 'error');
            return;
        }

        currentUser = data;
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');
        updateUserInfo();
        showTab('secrets');
    } catch (error) {
        showMessage('Lỗi: ' + error.message, 'error');
    }
});

async function logout() {
    try {
        await fetch(`${backendBase}/api/logout`, { method: 'POST' });
    } catch { }
    currentUser = null;
    document.getElementById('dashboard-section').classList.add('hidden');
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

function updateUserInfo() {
    document.getElementById('current-user').textContent = currentUser.username;
    document.getElementById('current-policies').textContent = currentUser.policies.join(', ');
    document.getElementById('session-time').textContent = `${Math.floor(currentUser.ttl / 3600)}h`;
}

function showTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    const content = document.getElementById('content-area');
    content.innerHTML = '<div class="loading">Đang tải...</div>';

    setTimeout(() => {
        switch (tab) {
            case 'secrets': loadSecrets('secret'); break;
            case 'team': loadSecrets('team'); break;
            case 'pem': loadPEMFiles(); break;
            case 'pki': loadPKI(); break;
            case 'stats': loadStats(); break;
            case 'audit': loadAudit(); break;
        }
    }, 100);
}

async function loadSecrets(mount) {
    const content = document.getElementById('content-area');

    try {
        const response = await fetch(`${backendBase}/api/list?mount=${mount}`);
        const data = await response.json();

        let html = `
                    <div style="background: white; padding: 20px; border-radius: 15px; margin-bottom: 20px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h2 style="color: #333;">
                                ${mount === 'secret' ? '📦 Personal Secrets' : '🤝 Team Shared Secrets'}
                            </h2>
                            <button class="btn btn-success btn-small" onclick="openCreateModal()">
                                + Tạo Secret Mới
                            </button>
                        </div>
                    </div>
                    <div class="secrets-grid">
                `;

        if (!data?.data?.keys || data.data.keys.length === 0) {
            html += '<p style="color: white; text-align: center; grid-column: 1/-1;">Không có secrets hoặc không có quyền truy cập</p>';
        } else {
            for (const path of data.data.keys) {
                if (path.endsWith('/')) {
                    const subData = await fetch(`${backendBase}/api/list?mount=${mount}&prefix=${path}`);
                    const subKeys = await subData.json();
                    if (subKeys?.data?.keys) {
                        for (const subPath of subKeys.data.keys) {
                            if (!subPath.endsWith('/')) {
                                html += await renderSecretCard(mount, path + subPath);
                            }
                        }
                    }
                } else {
                    html += await renderSecretCard(mount, path);
                }
            }
        }

        html += '</div>';
        content.innerHTML = html;
    } catch (error) {
        content.innerHTML = `<div class="error">Lỗi: ${error.message}</div>`;
    }
}

async function renderSecretCard(mount, path) {
    try {
        const response = await fetch(`${backendBase}/api/secret/${mount}/${path}`);
        if (!response.ok) return '';

        const data = await response.json();
        const secret = data?.data?.data;
        if (!secret) return '';

        let html = `
                    <div class="secret-card">
                        <h3>
                            <span>🔑 ${path}</span>
                            <span class="mount-label">${mount}</span>
                        </h3>
                `;

        for (const [key, value] of Object.entries(secret)) {
            const isSecret = ['password', 'secret', 'key', 'token', 'private'].some(k =>
                key.toLowerCase().includes(k)
            );
            const inputId = `${mount}-${path}-${key}`.replace(/[\/\s]/g, '-');

            const isCert = typeof value === 'string' &&
                (value.includes('BEGIN CERTIFICATE') ||
                    value.includes('BEGIN PRIVATE KEY') ||
                    value.includes('BEGIN RSA PRIVATE KEY'));

            html += `
                        <div class="secret-item">
                            <label>${key}:</label>
                            <div class="secret-value">
                    `;

            if (isCert) {
                html += `
                            <textarea id="${inputId}" readonly style="width: 100%; height: 100px; font-family: monospace; font-size: 0.8em;">${value}</textarea>
                        `;
            } else {
                html += `
                            <input type="${isSecret ? 'password' : 'text'}" 
                                   value="${value}" 
                                   id="${inputId}"
                                   readonly>
                        `;
            }

            html += `
                                <button class="copy-btn" onclick="copySecret('${inputId}', this)">Copy</button>
                            </div>
                        </div>
                    `;
        }

        html += `
                        <div class="action-buttons">
                            <button class="btn btn-small delete-btn" onclick="deleteSecret('${mount}', '${path}')">
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                `;

        return html;
    } catch (error) {
        return '';
    }
}

async function loadPEMFiles() {
    const content = document.getElementById('content-area');

    content.innerHTML = `
                <div style="background: white; padding: 30px; border-radius: 15px; margin-bottom: 20px;">
                    <h2 style="color: #333; margin-bottom: 20px;">🔒 PEM Files Management</h2>
                    
                    <div style="display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;">
                        <button class="btn btn-success btn-small" onclick="openModal('upload-pem-modal')">
                            📤 Upload PEM File
                        </button>
                        <button class="btn btn-small" onclick="openModal('generate-keypair-modal')">
                            🔑 Generate Key Pair
                        </button>
                    </div>
                    
                    <div class="warning">
                        <strong>🔒 Secure Storage:</strong> PEM files are encrypted at rest (AES-256) and access is logged in audit trail.
                    </div>
                </div>
                
                <div id="pem-files-container">
                    <div class="loading">Loading PEM files...</div>
                </div>
            `;

    try {
        const response = await fetch(`${backendBase}/api/list?mount=secret&prefix=pem-files/`);
        const data = await response.json();

        let html = '<div class="secrets-grid">';

        if (!data?.data?.keys || data.data.keys.length === 0) {
            html = '<p style="color: white; text-align: center; padding: 40px;">No PEM files stored yet. Upload one to get started!</p>';
        } else {
            for (const path of data.data.keys) {
                if (!path.endsWith('/')) {
                    html += await renderPEMCard('secret', 'pem-files/' + path);
                }
            }
            html += '</div>';
        }

        document.getElementById('pem-files-container').innerHTML = html;
    } catch (error) {
        document.getElementById('pem-files-container').innerHTML =
            `<div class="error">Error loading PEM files: ${error.message}</div>`;
    }
}

async function renderPEMCard(mount, path) {
    try {
        const response = await fetch(`${backendBase}/api/secret/${mount}/${path}`);
        if (!response.ok) return '';

        const data = await response.json();
        const pem = data?.data?.data;
        if (!pem) return '';

        const displayName = path.replace('pem-files/', '');
        const typeIcon = pem.type === 'certificate' ? '📜' :
            pem.type && pem.type.includes('private') ? '🔐' : '🔑';

        return `
                    <div class="secret-card">
                        <h3>
                            <span>${typeIcon} ${displayName}</span>
                            <span class="mount-label">PEM</span>
                        </h3>
                        
                        <div class="secret-item">
                            <label>Type:</label>
                            <div style="padding: 8px; background: #f0f0f0; border-radius: 4px;">
                                ${pem.type || 'unknown'}
                            </div>
                        </div>
                        
                        <div class="secret-item">
                            <label>Filename:</label>
                            <div style="padding: 8px; background: #f0f0f0; border-radius: 4px;">
                                ${pem.filename || 'N/A'}
                            </div>
                        </div>
                        
                        ${pem.description ? `
                        <div class="secret-item">
                            <label>Description:</label>
                            <div style="padding: 8px; background: #f0f0f0; border-radius: 4px;">
                                ${pem.description}
                            </div>
                        </div>
                        ` : ''}
                        
                        <div class="secret-item">
                            <label>Fingerprint:</label>
                            <div style="padding: 8px; background: #f0f0f0; border-radius: 4px; font-family: monospace; font-size: 0.85em;">
                                ${pem.fingerprint || 'N/A'}
                            </div>
                        </div>
                        
                        <div class="secret-item">
                            <label>Size:</label>
                            <div style="padding: 8px; background: #f0f0f0; border-radius: 4px;">
                                ${pem.size ? (pem.size / 1024).toFixed(2) + ' KB' : 'N/A'}
                            </div>
                        </div>
                        
                        <div class="secret-item">
                            <label>Uploaded By:</label>
                            <div style="padding: 8px; background: #f0f0f0; border-radius: 4px;">
                                ${pem.uploaded_by || pem.generated_by || 'N/A'} 
                                <small>(${pem.uploaded_at || pem.generated_at ? new Date(pem.uploaded_at || pem.generated_at).toLocaleString('vi-VN') : 'N/A'})</small>
                            </div>
                        </div>
                        
                        <div class="secret-item">
                            <label>Content Preview:</label>
                            <textarea readonly style="width: 100%; height: 120px; font-family: monospace; font-size: 0.75em; padding: 8px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px;">${pem.content ? pem.content.substring(0, 300) + '...' : pem.private_key ? pem.private_key.substring(0, 300) + '...' : 'N/A'}</textarea>
                        </div>
                        
                        <div class="action-buttons">
                            <button class="btn btn-small" onclick="downloadPEM('${mount}', '${path}', '${pem.filename || displayName + '.pem'}')">
                                📥 Download
                            </button>
                            <button class="btn btn-small" onclick="viewPEMFull('${mount}', '${path}')">
                                👁️ View Full
                            </button>
                            <button class="btn btn-small delete-btn" onclick="deleteSecret('${mount}', '${path}')">
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                `;
    } catch (error) {
        return '';
    }
}

async function downloadPEM(mount, path, filename) {
    try {
        const response = await fetch(`${backendBase}/api/download-pem/${mount}/${path}`);
        if (!response.ok) {
            alert('Failed to download PEM file');
            return;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        alert('✅ PEM file downloaded!');
    } catch (error) {
        alert('Error downloading file: ' + error.message);
    }
}

async function viewPEMFull(mount, path) {
    try {
        const resp = await fetch(`${backendBase}/api/secret/${encodeURIComponent(mount)}/${encodeURIComponent(path)}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const json = await resp.json();

        // Lấy nội dung PEM từ nhiều khả năng kho lưu trữ
        const pemObj = json?.data?.data;
        if (!pemObj) {
            alert('Failed to load PEM content');
            return;
        }
        const contentRaw =
            pemObj.content ||
            pemObj.private_key ||
            pemObj.certificate ||
            pemObj.pem ||
            pemObj.key ||
            '';

        const content = typeof contentRaw === 'string'
            ? contentRaw
            : JSON.stringify(contentRaw, null, 2); // nếu lỡ là object

        // Tạo modal bằng DOM API để không cần phải escape thủ công
        const modal = document.createElement('div');
        modal.className = 'modal show';

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.maxWidth = '800px';

        const header = document.createElement('div');
        header.className = 'modal-header';

        const title = document.createElement('h2');
        title.textContent = 'PEM File Content';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn';
        closeBtn.innerHTML = '&times;';
        closeBtn.addEventListener('click', () => modal.remove());

        header.appendChild(title);
        header.appendChild(closeBtn);

        const ta = document.createElement('textarea');
        ta.readOnly = true;
        ta.style.width = '100%';
        ta.style.height = '500px';
        ta.style.fontFamily = 'monospace';
        ta.style.fontSize = '0.85em';
        ta.style.padding = '15px';
        ta.style.background = '#f8f9fa';
        ta.style.border = '1px solid #ddd';
        ta.style.borderRadius = '4px';
        ta.value = content; // gán giá trị an toàn, không nội suy HTML

        const footer = document.createElement('div');
        footer.style.marginTop = '15px';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn btn-small';
        copyBtn.textContent = '📋 Copy to Clipboard';
        copyBtn.addEventListener('click', async () => {
            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(ta.value);
                } else {
                    // Fallback
                    ta.select();
                    document.execCommand('copy');
                    ta.setSelectionRange(0, 0);
                }
                copyBtn.textContent = '✅ Copied!';
                setTimeout(() => (copyBtn.textContent = '📋 Copy to Clipboard'), 1200);
            } catch (e) {
                alert('Copy failed: ' + e.message);
            }
        });

        footer.appendChild(copyBtn);

        modalContent.appendChild(header);
        modalContent.appendChild(ta);
        modalContent.appendChild(footer);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
    } catch (error) {
        alert('Error viewing PEM: ' + error.message);
    }
}


function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('✅ Copied to clipboard!');
    }).catch(err => {
        alert('Failed to copy: ' + err.message);
    });
}

document.getElementById('upload-pem-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const fileInput = document.getElementById('pem-file');
    const path = document.getElementById('pem-path').value;
    const description = document.getElementById('pem-description').value;

    if (!fileInput.files[0]) {
        alert('Please select a file');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('secretPath', 'pem-files/' + path);
    formData.append('description', description);

    try {
        const response = await fetch(`${backendBase}/api/upload-pem`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            document.getElementById('upload-result').innerHTML = `
                        <div class="success">
                            ✅ PEM file uploaded successfully!<br>
                            <strong>Type:</strong> ${result.type}<br>
                            <strong>Fingerprint:</strong> ${result.fingerprint}<br>
                            <strong>Path:</strong> secret/${result.path}
                        </div>
                    `;
            document.getElementById('upload-result').classList.remove('hidden');

            document.getElementById('upload-pem-form').reset();

            setTimeout(() => {
                closeModal('upload-pem-modal');
                if (currentTab === 'pem') {
                    loadPEMFiles();
                }
            }, 2000);
        } else {
            alert('❌ Upload failed: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        alert('❌ Error: ' + error.message);
    }
});

document.getElementById('generate-keypair-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const keyType = document.getElementById('keypair-type').value;
    const keySize = parseInt(document.getElementById('keypair-size').value, 10);
    const rawPath = document.getElementById('keypair-path').value;
    const description = document.getElementById('keypair-description').value;

    // Chuẩn hóa path: loại bỏ "/" thừa 2 đầu
    const pathSeg = (rawPath || '').trim().replace(/^\/+|\/+$/g, '');
    const secretPath = `pem-files/${pathSeg}`;

    const resultBox = document.getElementById('keypair-result');
    resultBox.classList.remove('hidden');
    resultBox.innerHTML = ''; // clear cũ

    try {
        const resp = await fetch(`${backendBase}/api/generate-keypair`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyType, keySize, secretPath, description })
        });

        // Thử parse JSON an toàn
        let data = null;
        try {
            data = await resp.json();
        } catch {
            throw new Error(`Unexpected response (status ${resp.status})`);
        }

        if (!resp.ok) {
            throw new Error(data?.error || `HTTP ${resp.status}`);
        }

        const { publicKey, privateKey, fingerprint } = data || {};

        // ==== UI builder helpers (an toàn, không nội suy HTML) ====
        const wrap = document.createElement('div');

        const ok = document.createElement('div');
        ok.className = 'success';
        ok.textContent = '✅ Key pair generated successfully!';
        wrap.appendChild(ok);

        const makeBlock = (label, content, fileName) => {
            const block = document.createElement('div');
            block.style.marginTop = '15px';

            const h = document.createElement('h4');
            h.textContent = label;
            block.appendChild(h);

            // Dùng <textarea> để người dùng dễ chọn/copy
            const ta = document.createElement('textarea');
            ta.className = 'cert-display';
            ta.readOnly = true;
            ta.style.width = '100%';
            ta.style.minHeight = '160px';
            ta.value = content || '';
            block.appendChild(ta);

            const btnRow = document.createElement('div');
            btnRow.style.marginTop = '10px';

            const copyBtn = document.createElement('button');
            copyBtn.className = 'btn btn-small mt-20';
            copyBtn.textContent = '📋 Copy';
            copyBtn.addEventListener('click', async () => {
                try {
                    if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(ta.value);
                    } else {
                        ta.select();
                        document.execCommand('copy');
                        ta.setSelectionRange(0, 0);
                    }
                    const old = copyBtn.textContent;
                    copyBtn.textContent = '✅ Copied!';
                    setTimeout(() => (copyBtn.textContent = old), 1200);
                } catch (err) {
                    alert('Copy failed: ' + err.message);
                }
            });
            btnRow.appendChild(copyBtn);

            // Nút download
            const dlBtn = document.createElement('button');
            dlBtn.className = 'btn btn-small mt-20';
            dlBtn.style.marginLeft = '10px';
            dlBtn.textContent = '⬇️ Download';
            dlBtn.addEventListener('click', () => {
                const blob = new Blob([ta.value], { type: 'text/plain;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
            });
            btnRow.appendChild(dlBtn);

            block.appendChild(btnRow);
            return block;
        };

        // Public key block
        if (publicKey) {
            wrap.appendChild(makeBlock('Public Key:', publicKey, (pathSeg || 'key') + '.pub.pem'));
        }

        // Private key block
        if (privateKey) {
            wrap.appendChild(makeBlock('Private Key:', privateKey, (pathSeg || 'key') + '.pem'));
        }

        // Fingerprint & cảnh báo
        const meta = document.createElement('div');
        meta.style.marginTop = '15px';
        if (fingerprint) {
            const p = document.createElement('p');
            p.innerHTML = `<strong>Fingerprint:</strong> ${fingerprint}`;
            meta.appendChild(p);
        }
        const warn = document.createElement('p');
        warn.style.color = '#856404';
        warn.style.background = '#fff3cd';
        warn.style.padding = '10px';
        warn.style.borderRadius = '4px';
        warn.innerHTML = '⚠️ <strong>Important:</strong> Private key is shown only once. Download or copy it now!';
        meta.appendChild(warn);
        wrap.appendChild(meta);

        resultBox.appendChild(wrap);

        // Reset form
        document.getElementById('generate-keypair-form').reset();

    } catch (err) {
        alert('❌ Error: ' + err.message);
    }
});


async function loadPKI() {
    const content = document.getElementById('content-area');
    content.innerHTML = `
                <div style="background: white; padding: 30px; border-radius: 15px;">
                    <h2 style="color: #333; margin-bottom: 20px;">🔐 PKI Certificate Management</h2>
                    
                    <div class="warning">
                        <strong>⚠️ Certificate Authority:</strong> Issue SSL/TLS certificates on-demand
                    </div>
                    
                    <div style="margin: 30px 0;">
                        <h3 style="color: #555; margin-bottom: 15px;">Available Roles:</h3>
                        <div class="secrets-grid">
                            <div class="secret-card">
                                <h3>dev-role</h3>
                                <p style="color: #666; margin: 10px 0;">
                                    <strong>Domains:</strong> *.dev.example.com<br>
                                    <strong>Max TTL:</strong> 720 hours (30 days)
                                </p>
                                <button class="btn btn-small" onclick="openCertModal('dev-role')">
                                    Issue Certificate
                                </button>
                            </div>
                            <div class="secret-card">
                                <h3>prod-role</h3>
                                <p style="color: #666; margin: 10px 0;">
                                    <strong>Domains:</strong> *.example.com<br>
                                    <strong>Max TTL:</strong> 8760 hours (1 year)
                                </p>
                                <button class="btn btn-small" onclick="openCertModal('prod-role')">
                                    Issue Certificate
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 30px;">
                        <h3 style="color: #555; margin-bottom: 15px;">Issued Certificates:</h3>
                        <div id="issued-certs">Loading...</div>
                    </div>
                </div>
            `;

    // Load certificates from secrets
    loadIssuedCerts();
}

async function loadIssuedCerts() {
    try {
        const response = await fetch(`${backendBase}/api/list?mount=secret&prefix=certificates/`);
        const data = await response.json();
        const certsDiv = document.getElementById('issued-certs');

        if (!data?.data?.keys || data.data.keys.length === 0) {
            certsDiv.innerHTML = '<p style="color: #999;">Chưa có certificate nào được issue</p>';
            return;
        }

        let html = '<div class="secrets-grid">';
        for (const path of data.data.keys) {
            if (!path.endsWith('/')) {
                html += await renderSecretCard('secret', 'certificates/' + path);
            }
        }
        html += '</div>';
        certsDiv.innerHTML = html;
    } catch (error) {
        document.getElementById('issued-certs').innerHTML =
            `<p style="color: #999;">Không thể load certificates</p>`;
    }
}

async function loadStats() {
    const content = document.getElementById('content-area');

    try {
        const response = await fetch(`${backendBase}/api/stats`);
        const data = await response.json();

        content.innerHTML = `
                    <div style="background: white; padding: 30px; border-radius: 15px;">
                        <h2 style="color: #333; margin-bottom: 30px;">📊 System Statistics</h2>
                        
                        <div class="stats-grid">
                            <div class="stat-card">
                                <div class="stat-value">${data.secrets?.secret || 0}</div>
                                <div class="stat-label">Personal Secrets</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${data.secrets?.team || 0}</div>
                                <div class="stat-label">Team Secrets</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">${data.policies?.length || 0}</div>
                                <div class="stat-label">Active Policies</div>
                            </div>
                            <div class="stat-card">
                                <div class="stat-value">✓</div>
                                <div class="stat-label">Audit Enabled</div>
                            </div>
                        </div>
                        
                        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 10px;">
                            <h3 style="color: #555; margin-bottom: 15px;">Session Information</h3>
                            <p><strong>Username:</strong> ${data.username}</p>
                            <p><strong>Policies:</strong> ${data.policies?.join(', ')}</p>
                            <p><strong>Login Time:</strong> ${new Date(data.loginTime).toLocaleString('vi-VN')}</p>
                        </div>
                        
                        <div style="margin-top: 30px; padding: 20px; background: #e8f5e9; border-radius: 10px;">
                            <h3 style="color: #2e7d32; margin-bottom: 15px;">✅ Security Features Active</h3>
                            <ul style="list-style: none; padding: 0;">
                                <li style="padding: 8px 0;">✓ AES-256 Encryption</li>
                                <li style="padding: 8px 0;">✓ Policy-based Access Control</li>
                                <li style="padding: 8px 0;">✓ Audit Logging Enabled</li>
                                <li style="padding: 8px 0;">✓ Token TTL: ${Math.floor((data.ttl || 0) / 3600)}h</li>
                                <li style="padding: 8px 0;">✓ Auto Backup Every Hour</li>
                                <li style="padding: 8px 0;">✓ PEM Files Management</li>
                            </ul>
                        </div>
                    </div>
                `;
    } catch (error) {
        content.innerHTML = `<div class="error">Lỗi: ${error.message}</div>`;
    }
}

async function loadAudit() {
    const content = document.getElementById('content-area');

    try {
        const response = await fetch(`${backendBase}/api/audit`);
        const data = await response.json();

        if (!response.ok) {
            content.innerHTML = `
                        <div class="warning">
                            <strong>⚠️ Không có quyền xem Audit Log</strong><br>
                            Chỉ admin mới có quyền xem audit logs.
                        </div>
                    `;
            return;
        }

        const auditDevices = data?.data || data;
        const deviceList = Object.entries(auditDevices).map(([name, info]) =>
            `<li><strong>${name}</strong>: ${info.type} - ${info.path || 'N/A'}</li>`
        ).join('');

        content.innerHTML = `
                    <div style="background: white; padding: 30px; border-radius: 15px;">
                        <h2 style="color: #333; margin-bottom: 20px;">📝 Audit Log Configuration</h2>
                        
                        <div class="success">
                            <strong>✅ Audit Logging Enabled</strong><br>
                            Tất cả truy cập vào Vault đều được ghi log.
                        </div>
                        
                        <div style="margin-top: 30px;">
                            <h3 style="color: #555; margin-bottom: 15px;">Active Audit Devices:</h3>
                            <ul style="padding-left: 20px;">
                                ${deviceList}
                            </ul>
                        </div>
                        
                        <div style="margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 10px;">
                            <h3 style="color: #555; margin-bottom: 15px;">Audit Log Information:</h3>
                            <p><strong>Location:</strong> /vault/logs/audit.log (trong container)</p>
                            <p><strong>Format:</strong> JSON</p>
                            <p><strong>Logged Information:</strong></p>
                            <ul style="margin-top: 10px; padding-left: 20px;">
                                <li>User authentication (login/logout)</li>
                                <li>Secret read/write/delete operations</li>
                                <li>PEM file uploads/downloads</li>
                                <li>Policy changes</li>
                                <li>Timestamp và IP address</li>
                                <li>Request/Response details</li>
                            </ul>
                        </div>
                        
                        <div style="margin-top: 30px; padding: 15px; background: #fff3cd; border-radius: 10px;">
                            <strong>💡 Xem Audit Log:</strong><br>
                            <code style="background: #f8f9fa; padding: 5px 10px; border-radius: 4px; display: inline-block; margin-top: 10px;">
                                docker exec vault-demo cat /vault/logs/audit.log | tail -n 50
                            </code>
                        </div>
                    </div>
                `;
    } catch (error) {
        content.innerHTML = `<div class="error">Lỗi: ${error.message}</div>`;
    }
}

function openCreateModal() {
    document.getElementById('create-modal').classList.add('show');
}

function openCertModal(role) {
    document.getElementById('cert-role').value = role;
    document.getElementById('cert-result').classList.add('hidden');
    document.getElementById('cert-modal').classList.add('show');
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

document.getElementById('create-secret-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const mount = document.getElementById('new-secret-mount').value;
    const path = document.getElementById('new-secret-path').value;
    const dataText = document.getElementById('new-secret-data').value;

    try {
        const data = JSON.parse(dataText);
        const response = await fetch(`${backendBase}/api/secret/${mount}/${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('✅ Secret đã được tạo thành công!');
            closeModal('create-modal');
            document.getElementById('create-secret-form').reset();
            showTab(mount === 'team' ? 'team' : 'secrets');
        } else {
            const error = await response.json();
            alert('❌ Lỗi: ' + (error.errors ? error.errors.join(', ') : 'Không thể tạo secret'));
        }
    } catch (error) {
        alert('❌ Lỗi: ' + error.message);
    }
});

document.getElementById('issue-cert-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const role = document.getElementById('cert-role').value;
    const cn = document.getElementById('cert-cn').value;
    const ttl = document.getElementById('cert-ttl').value + 'h';

    try {
        const response = await fetch(`${backendBase}/api/pki/issue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role, common_name: cn, ttl })
        });

        const data = await response.json();

        if (response.ok) {
            const cert = data.data;
            document.getElementById('cert-result').innerHTML = `
                        <div class="success">✅ Certificate issued successfully!</div>
                        <div style="margin-top: 15px;">
                            <h4>Certificate:</h4>
                            <div class="cert-display">${cert.certificate}</div>
                        </div>
                        <div style="margin-top: 15px;">
                            <h4>Private Key:</h4>
                            <div class="cert-display">${cert.private_key}</div>
                        </div>
                        <div style="margin-top: 15px;">
                            <p><strong>Serial:</strong> ${cert.serial_number}</p>
                            <p><strong>Expires:</strong> ${new Date(Date.now() + cert.ttl * 1000).toLocaleString('vi-VN')}</p>
                        </div>
                    `;
            document.getElementById('cert-result').classList.remove('hidden');

            await fetch(`${backendBase}/api/secret/secret/certificates/${cn}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    certificate: cert.certificate,
                    private_key: cert.private_key,
                    domain: cn,
                    serial: cert.serial_number,
                    issued_at: new Date().toISOString()
                })
            });
        } else {
            alert('❌ Lỗi: ' + (data.errors ? data.errors.join(', ') : 'Không thể issue certificate'));
        }
    } catch (error) {
        alert('❌ Lỗi: ' + error.message);
    }
});

async function deleteSecret(mount, path) {
    if (!confirm(`Bạn có chắc muốn xóa secret: ${mount}/${path}?`)) return;

    try {
        const response = await fetch(`${backendBase}/api/secret/${mount}/${path}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            alert('✅ Secret đã được xóa');
            if (currentTab === 'pem' && path.startsWith('pem-files/')) {
                loadPEMFiles();
            } else {
                showTab(mount === 'team' ? 'team' : 'secrets');
            }
        } else {
            alert('❌ Không thể xóa secret');
        }
    } catch (error) {
        alert('❌ Lỗi: ' + error.message);
    }
}

// Copy Secret
function copySecret(inputId, button) {
    const input = document.getElementById(inputId);
    const originalType = input.type;

    if (input.tagName === 'TEXTAREA') {
        input.select();
    } else {
        input.type = 'text';
        input.select();
    }

    document.execCommand('copy');

    if (originalType) input.type = originalType;

    button.textContent = '✓ Copied!';
    button.classList.add('copied');
    setTimeout(() => {
        button.textContent = 'Copy';
        button.classList.remove('copied');
    }, 2000);
}

function showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    messageDiv.className = type;
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
    if (type !== 'success') {
        setTimeout(() => messageDiv.style.display = 'none', 5000);
    }
}

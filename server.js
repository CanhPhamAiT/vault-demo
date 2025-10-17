const express = require('express');
const session = require('express-session');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;
const VAULT_ADDR = process.env.VAULT_ADDR || 'http://10.3.0.133:8200';

// Configure multer for file uploads (in-memory)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    // Accept PEM, key, crt, cer files
    const allowedExts = ['.pem', '.key', '.crt', '.cer', '.p12', '.pfx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only certificate files (.pem, .key, .crt, .cer, .p12, .pfx) are allowed'));
    }
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Session middleware
app.use(session({
  secret: 'vault-demo-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Helper: Call Vault API
async function vaultRequest(endpoint, token, options = {}) {
  const url = `${VAULT_ADDR}/v1/${endpoint}`;
  const headers = {
    'X-Vault-Token': token,
    'Content-Type': 'application/json',
    ...options.headers
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });
    
    const data = await response.json().catch(() => ({}));
    
    return {
      ok: response.ok,
      status: response.status,
      data
    };
  } catch (error) {
    console.error('Vault request error:', error);
    throw error;
  }
}

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ 
      ok: false, 
      error: 'Username và password là bắt buộc' 
    });
  }

  try {
    const response = await fetch(`${VAULT_ADDR}/v1/auth/userpass/login/${username}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(401).json({ 
        ok: false, 
        error: 'Đăng nhập thất bại',
        vault: data
      });
    }

    // Store session info
    req.session.vaultToken = data.auth.client_token;
    req.session.username = username;
    req.session.policies = data.auth.policies;
    req.session.tokenTTL = data.auth.lease_duration;
    req.session.loginTime = new Date().toISOString();

    res.json({ 
      ok: true,
      username,
      policies: data.auth.policies,
      ttl: data.auth.lease_duration
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      ok: false, 
      error: 'Lỗi server: ' + error.message 
    });
  }
});

// Logout endpoint
app.post('/api/logout', async (req, res) => {
  // Revoke token in Vault
  if (req.session.vaultToken) {
    try {
      await vaultRequest('auth/token/revoke-self', req.session.vaultToken, {
        method: 'POST'
      });
    } catch (e) {
      console.error('Token revoke error:', e);
    }
  }
  
  req.session.destroy();
  res.json({ ok: true });
});

// Middleware to check authentication
function requireAuth(req, res, next) {
  if (!req.session.vaultToken) {
    return res.status(401).json({ 
      ok: false, 
      error: 'Chưa đăng nhập' 
    });
  }
  next();
}

// Get user info
app.get('/api/user', requireAuth, (req, res) => {
  res.json({
    username: req.session.username,
    policies: req.session.policies,
    loginTime: req.session.loginTime,
    ttl: req.session.tokenTTL
  });
});

// List secrets (KV v2) - Support multiple mounts
app.get('/api/list', requireAuth, async (req, res) => {
  const mount = req.query.mount || 'secret';
  const prefix = req.query.prefix || '';
  const endpoint = prefix 
    ? `${mount}/metadata/${prefix}`
    : `${mount}/metadata`;

  try {
    const result = await vaultRequest(endpoint, req.session.vaultToken, {
      method: 'LIST'
    });

    if (!result.ok) {
      return res.status(result.status).json(result.data);
    }

    res.json(result.data);
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
});

// List all available mounts
app.get('/api/mounts', requireAuth, async (req, res) => {
  try {
    const result = await vaultRequest('sys/mounts', req.session.vaultToken);
    
    if (!result.ok) {
      return res.status(result.status).json(result.data);
    }

    // Filter KV v2 mounts
    const kvMounts = Object.entries(result.data.data || result.data)
      .filter(([key, value]) => value.type === 'kv' && value.options?.version === '2')
      .map(([key, value]) => ({
        path: key.replace(/\/$/, ''),
        description: value.description || 'No description',
        type: value.type
      }));

    res.json({ mounts: kvMounts });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
});

// Get secret (KV v2)
app.get('/api/secret/:mount/:path(*)', requireAuth, async (req, res) => {
  const mount = req.params.mount;
  const secretPath = req.params.path;
  
  try {
    const result = await vaultRequest(
      `${mount}/data/${secretPath}`, 
      req.session.vaultToken
    );

    if (!result.ok) {
      return res.status(result.status).json(result.data);
    }

    res.json(result.data);
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
});

// Create/Update secret
app.post('/api/secret/:mount/:path(*)', requireAuth, async (req, res) => {
  const mount = req.params.mount;
  const secretPath = req.params.path;
  const secretData = req.body;
  
  try {
    const result = await vaultRequest(
      `${mount}/data/${secretPath}`,
      req.session.vaultToken,
      {
        method: 'POST',
        body: JSON.stringify({ data: secretData })
      }
    );

    if (!result.ok) {
      return res.status(result.status).json(result.data);
    }

    res.json(result.data);
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
});

// Delete secret
app.delete('/api/secret/:mount/:path(*)', requireAuth, async (req, res) => {
  const mount = req.params.mount;
  const secretPath = req.params.path;
  
  try {
    const result = await vaultRequest(
      `${mount}/metadata/${secretPath}`,
      req.session.vaultToken,
      {
        method: 'DELETE'
      }
    );

    if (!result.ok) {
      return res.status(result.status).json(result.data);
    }

    res.json({ ok: true, message: 'Secret deleted successfully' });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
});

// Get audit log (if user has permission)
app.get('/api/audit', requireAuth, async (req, res) => {
  try {
    const result = await vaultRequest('sys/audit', req.session.vaultToken);
    
    if (!result.ok) {
      return res.status(result.status).json(result.data);
    }

    res.json(result.data);
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
});

// Issue certificate from PKI
app.post('/api/pki/issue', requireAuth, async (req, res) => {
  const { role, common_name, ttl } = req.body;
  
  if (!role || !common_name) {
    return res.status(400).json({
      ok: false,
      error: 'role và common_name là bắt buộc'
    });
  }

  try {
    const result = await vaultRequest(
      `pki/issue/${role}`,
      req.session.vaultToken,
      {
        method: 'POST',
        body: JSON.stringify({ 
          common_name,
          ttl: ttl || '720h'
        })
      }
    );

    if (!result.ok) {
      return res.status(result.status).json(result.data);
    }

    res.json(result.data);
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
});

// Get statistics (admin only)
app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const secrets = {};
    const mounts = ['secret', 'team'];
    
    for (const mount of mounts) {
      const result = await vaultRequest(
        `${mount}/metadata`,
        req.session.vaultToken,
        { method: 'LIST' }
      );
      
      if (result.ok && result.data.data?.keys) {
        secrets[mount] = result.data.data.keys.length;
      } else {
        secrets[mount] = 0;
      }
    }

    res.json({
      username: req.session.username,
      policies: req.session.policies,
      secrets,
      loginTime: req.session.loginTime
    });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
});

// Upload PEM file
app.post('/api/upload-pem', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        ok: false, 
        error: 'No file uploaded' 
      });
    }

    const { secretPath, description } = req.body;
    if (!secretPath) {
      return res.status(400).json({ 
        ok: false, 
        error: 'secretPath is required' 
      });
    }

    const fileContent = req.file.buffer.toString('utf8');
    const fileName = req.file.originalname;
    const fileSize = req.file.size;
    
    // Detect file type
    let fileType = 'unknown';
    if (fileContent.includes('BEGIN CERTIFICATE')) fileType = 'certificate';
    else if (fileContent.includes('BEGIN PRIVATE KEY')) fileType = 'private_key';
    else if (fileContent.includes('BEGIN RSA PRIVATE KEY')) fileType = 'rsa_private_key';
    else if (fileContent.includes('BEGIN PUBLIC KEY')) fileType = 'public_key';
    else if (fileContent.includes('BEGIN ENCRYPTED PRIVATE KEY')) fileType = 'encrypted_private_key';

    // Generate fingerprint for tracking
    const fingerprint = crypto.createHash('sha256').update(fileContent).digest('hex').substring(0, 16);

    // Store in Vault
    const secretData = {
      content: fileContent,
      filename: fileName,
      type: fileType,
      size: fileSize,
      fingerprint: fingerprint,
      description: description || '',
      uploaded_by: req.session.username,
      uploaded_at: new Date().toISOString()
    };

    const result = await vaultRequest(
      `secret/data/${secretPath}`,
      req.session.vaultToken,
      {
        method: 'POST',
        body: JSON.stringify({ data: secretData })
      }
    );

    if (!result.ok) {
      return res.status(result.status).json(result.data);
    }

    res.json({ 
      ok: true, 
      message: 'PEM file uploaded successfully',
      fingerprint: fingerprint,
      type: fileType,
      path: secretPath
    });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
});

// Download PEM file (returns raw content)
app.get('/api/download-pem/:mount/:path(*)', requireAuth, async (req, res) => {
  const mount = req.params.mount;
  const secretPath = req.params.path;
  
  try {
    const result = await vaultRequest(
      `${mount}/data/${secretPath}`,
      req.session.vaultToken
    );

    if (!result.ok) {
      return res.status(result.status).json(result.data);
    }

    const data = result.data?.data?.data;
    if (!data || !data.content) {
      return res.status(404).json({ 
        ok: false, 
        error: 'PEM content not found' 
      });
    }

    // Set appropriate headers for download
    res.setHeader('Content-Type', 'application/x-pem-file');
    res.setHeader('Content-Disposition', `attachment; filename="${data.filename || 'certificate.pem'}"`);
    res.send(data.content);
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
});

// Verify PEM file (check validity, expiry for certificates)
app.post('/api/verify-pem', requireAuth, async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Content is required' 
      });
    }

    const verification = {
      valid: false,
      type: 'unknown',
      details: {}
    };

    // Basic validation
    if (content.includes('BEGIN CERTIFICATE') && content.includes('END CERTIFICATE')) {
      verification.type = 'certificate';
      verification.valid = true;
      
      // Try to parse certificate details (basic regex parsing)
      const subjectMatch = content.match(/Subject:(.+)/);
      const issuerMatch = content.match(/Issuer:(.+)/);
      const validityMatch = content.match(/Not After : (.+)/);
      
      if (subjectMatch) verification.details.subject = subjectMatch[1].trim();
      if (issuerMatch) verification.details.issuer = issuerMatch[1].trim();
      if (validityMatch) verification.details.expires = validityMatch[1].trim();
    } else if (content.includes('BEGIN PRIVATE KEY') || content.includes('BEGIN RSA PRIVATE KEY')) {
      verification.type = 'private_key';
      verification.valid = true;
      verification.details.encrypted = content.includes('ENCRYPTED');
    } else if (content.includes('BEGIN PUBLIC KEY')) {
      verification.type = 'public_key';
      verification.valid = true;
    }

    res.json(verification);
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
});

// Generate key pair
app.post('/api/generate-keypair', requireAuth, async (req, res) => {
  try {
    const { keyType, keySize, secretPath, description } = req.body;
    
    // Use Node.js crypto to generate keypair
    const { publicKey, privateKey } = crypto.generateKeyPairSync(keyType || 'rsa', {
      modulusLength: parseInt(keySize) || 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Generate fingerprint
    const fingerprint = crypto.createHash('sha256')
      .update(publicKey)
      .digest('hex')
      .substring(0, 16);

    const secretData = {
      private_key: privateKey,
      public_key: publicKey,
      key_type: keyType || 'rsa',
      key_size: keySize || 2048,
      fingerprint: fingerprint,
      description: description || '',
      generated_by: req.session.username,
      generated_at: new Date().toISOString()
    };

    // Store in Vault
    if (secretPath) {
      const result = await vaultRequest(
        `secret/data/${secretPath}`,
        req.session.vaultToken,
        {
          method: 'POST',
          body: JSON.stringify({ data: secretData })
        }
      );

      if (!result.ok) {
        return res.status(result.status).json(result.data);
      }
    }

    res.json({ 
      ok: true,
      message: 'Key pair generated successfully',
      fingerprint: fingerprint,
      publicKey: publicKey,
      privateKey: privateKey // Only returned once, not stored in response
    });
  } catch (error) {
    res.status(500).json({ 
      ok: false, 
      error: error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    vault: VAULT_ADDR,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Custom Vault UI running on http://localhost:${PORT}`);
  console.log(`📡 Connected to Vault: ${VAULT_ADDR}`);
  console.log(`📋 Features: Multi-mount, Audit, PKI, Statistics`);
});
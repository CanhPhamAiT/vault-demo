const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const VAULT_ADDR = process.env.VAULT_ADDR || 'http://vault:8200';

app.use(express.json());
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
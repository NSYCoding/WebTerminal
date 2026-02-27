import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { exec, execFile } from 'node:child_process';
import crypto from 'node:crypto';
import { platform } from 'node:os';
dotenv.config();

if (!process.env.VALID_USERNAME || !process.env.VALID_PASSWORD) {
    console.error('Missing required environment variables: VALID_USERNAME, VALID_PASSWORD');
    process.exit(1);
}

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const VALID_USERNAME = process.env.VALID_USERNAME;
const VALID_PASSWORD = process.env.VALID_PASSWORD;
const MAX_MESSAGE_SIZE = 50 * 1024;
const AUTH_TIMEOUT = 50000;
const RATE_LIMIT_WINDOW = 60000;
const MAX_COMMANDS_PER_WINDOW = 10;

const DISALLOWED_COMMANDS = new Set(process.env.DISALLOWED_COMMANDS?.split(',').map(cmd => cmd.trim()) || []);

const SHELL = platform() === 'win32' ? 'powershell.exe' : '/bin/sh';
const SHELL_ARGS = platform() === 'win32' ? ['-NoProfile', '-Command', '$ProgressPreference = "SilentlyContinue";'] : ['-c'];

wss.on('connection', (ws) => {
    console.log('Client connected');
    let isAuthenticated = false;
    let authTimer = null;
    let commandCount = 0;
    let windowStart = Date.now();
    const clientIp = ws._socket.remoteAddress;

    authTimer = setTimeout(() => {
        if (!isAuthenticated) {
            console.warn(`Authentication timeout for client ${clientIp}`);
            ws.close(1008, 'Authentication timeout');
        }
    }, AUTH_TIMEOUT);

    ws.on('message', (data) => {
        if (data.length > MAX_MESSAGE_SIZE) {
            ws.send(JSON.stringify({ type: 'error', message: 'Message too large' }));
            return;
        }

        const message = data.toString();

        if (!isAuthenticated) {
            try {
                const parsed = JSON.parse(message);
                console.log('Auth attempt:', { username: parsed.username, received: parsed.password === VALID_PASSWORD });

                if (parsed.username === VALID_USERNAME && parsed.password === VALID_PASSWORD) {
                    isAuthenticated = true;
                    clearTimeout(authTimer);
                    ws.send(JSON.stringify({ type: 'auth', status: 'authenticated' }));
                    console.log('✓ Client authenticated from', clientIp);
                    return;
                } else {
                    console.log('✗ Authentication failed for', clientIp);
                    ws.send(JSON.stringify({ type: 'auth', status: 'failed' }));
                    return;
                }
            } catch (error) {
                console.error('Auth parsing error:', error.message);
                ws.send(JSON.stringify({ type: 'auth', status: 'failed', error: 'Invalid format' }));
                return;
            }
        }

        try {
            const parsed = JSON.parse(message);

            const now = Date.now();
            if (now - windowStart > RATE_LIMIT_WINDOW) {
                commandCount = 0;
                windowStart = now;
            }

            if (parsed.type === 'command' && parsed.command) {
                if (++commandCount > MAX_COMMANDS_PER_WINDOW) {
                    ws.send(JSON.stringify({ type: 'error', message: 'Rate limit exceeded' }));
                    return;
                }

                if (DISALLOWED_COMMANDS.size > 0) {
                    const cmdName = parsed.command.split(' ')[0];
                    if (DISALLOWED_COMMANDS.has(cmdName)) {
                        ws.send(JSON.stringify({ type: 'error', message: 'Command not allowed' }));
                        console.warn(`Unauthorized command attempt: ${cmdName} from ${clientIp}`);
                        return;
                    }
                }

                execFile(SHELL, [...SHELL_ARGS, parsed.command], { maxBuffer: 10 * 1024 * 1024, timeout: 30000 }, (error, stdout, stderr) => {
                    const response = {
                        type: 'terminal',
                        command: parsed.command,
                        output: stdout || stderr || '',
                        error: error ? error.message : null,
                        exitCode: error?.code || 0,
                        timestamp: new Date().toISOString()
                    };
                    ws.send(JSON.stringify(response, null, 2));
                });
                return;
            }
        } catch (error) {
            console.error('Error occurred:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid request' }));
        }
    });

    ws.on('close', () => {
        clearTimeout(authTimer);
        console.log('Client disconnected');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });

    ws.send(JSON.stringify({ type: 'info', message: 'Please authenticate with credentials' }));
});

app.get('/', (req, res) => {
    const authHeader = req.get('authorization');
    const token = authHeader?.split(' ')[1];

    if (token && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(process.env.VALID_PASSWORD || ''))) {
        res.send('WebSocket server running');
    } else {
        res.status(401).send('Unauthorized');
    }
});

const PORT = process.env.PORT || 5643;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
});


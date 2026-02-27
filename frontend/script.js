const ws = new WebSocket('ws://192.168.1.142:5643');
const outputDiv = document.getElementById('output');
const commandInput = document.querySelector('input[type="text"]');
let isAuthenticated = false;

ws.addEventListener('open', () => {
  addOutput('Connected to server');
  promptCredentials();
});

ws.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  console.log('Message from server:', data);

  if (data.type === 'auth') {
    if (data.status === 'authenticated') {
      isAuthenticated = true;
      addOutput('✓ Authentication successful');
      commandInput.disabled = false;
      commandInput.focus();
      executeCommand('whoami');
    } else {
      addOutput('✗ Authentication failed');
      promptCredentials();
    }
  } else if (data.type === 'terminal') {
    if (data.output) {
      addOutput(data.output);
    }
    if (data.error) {
      addOutput('Error: ' + data.error, 'error');
    }
  } else if (data.type === 'info') {
    addOutput(data.message, 'info');
  } else if (data.type === 'error') {
    addOutput('Error: ' + data.message, 'error');
  }
});

ws.addEventListener('close', () => {
  addOutput('Disconnected from server');
  commandInput.disabled = true;
});

ws.addEventListener('error', (event) => {
  addOutput('WebSocket error: ' + event, 'error');
});

function promptCredentials() {
  const username = prompt('Enter username:');
  if (username === null) return;
  const password = prompt('Enter password:');
  if (password === null) return;
  
  const credentials = { username, password };
  ws.send(JSON.stringify(credentials));
}

function executeCommand(command) {
  if (ws.readyState === WebSocket.OPEN && isAuthenticated) {
    addOutput('$ ' + command, 'command');
    ws.send(JSON.stringify({
      type: 'command',
      command: command
    }));
  } else if (!isAuthenticated) {
    addOutput('Not authenticated', 'error');
  } else {
    addOutput('WebSocket is not connected', 'error');
  }
}

function addOutput(text, type = 'output') {
  const line = document.createElement('div');
  line.className = 'output-line ' + type;
  line.textContent = text;
  outputDiv.appendChild(line);
  outputDiv.scrollTop = outputDiv.scrollHeight;
}

commandInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && commandInput.value.trim()) {
    executeCommand(commandInput.value.trim());
    commandInput.value = '';
  }
});

commandInput.disabled = true;

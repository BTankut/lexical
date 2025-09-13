
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const SESSIONS_DIR = path.join(__dirname, '..', '..', 'sessions');

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

class SessionManager {
  constructor(sessionId = null) {
    this.sessionId = sessionId || uuidv4();
    this.sessionFile = path.join(SESSIONS_DIR, `${this.sessionId}.json`);
    this.context = this.loadSession();
  }

  loadSession() {
    if (fs.existsSync(this.sessionFile)) {
      const data = fs.readFileSync(this.sessionFile, 'utf8');
      return JSON.parse(data);
    }
    return {
      sessionId: this.sessionId,
      operations: [],
      createdAt: new Date().toISOString(),
    };
  }

  saveSession() {
    this.context.updatedAt = new Date().toISOString();
    fs.writeFileSync(this.sessionFile, JSON.stringify(this.context, null, 2), 'utf8');
  }

  addOperation(operation) {
    this.context.operations.push({
      timestamp: new Date().toISOString(),
      ...operation,
    });
    this.saveSession();
  }

  getContext() {
    return this.context;
  }

  endSession() {
    this.addOperation({ type: 'session_end' });
    console.log(`Session ${this.sessionId} ended.`);
  }
}

module.exports = SessionManager;

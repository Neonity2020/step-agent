// ============================================================
// My Agent - Web UI Frontend
// ============================================================

// State
const state = {
  sessions: [],
  currentSession: null,
  messages: [],
  theme: localStorage.getItem("theme") || "dark",
  isLoading: false,
  eventSource: null,
};

// DOM Elements
const elements = {
  messages: document.getElementById("messages"),
  welcome: document.getElementById("welcome"),
  messageInput: document.getElementById("message-input"),
  btnSend: document.getElementById("btn-send"),
  btnSettings: document.getElementById("btn-settings"),
  btnTheme: document.getElementById("btn-theme"),
  btnNewChat: document.getElementById("btn-new-chat"),
  btnNewSession: document.getElementById("btn-new-session"),
  btnCloseSettings: document.getElementById("btn-close-settings"),
  settingsModal: document.getElementById("settings-modal"),
  sessionList: document.getElementById("session-list"),
  msgCount: document.getElementById("msg-count"),
  modelInfo: document.getElementById("model-info"),
  currentModel: document.getElementById("current-model"),
  loading: document.getElementById("loading"),
  themeBtns: document.querySelectorAll(".theme-btn"),
  quickActions: document.querySelectorAll(".quick-action"),
};

// API Functions
const api = {
  baseUrl: "",

  async sendMessage(content) {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    return response.json();
  },

  async getSession() {
    const response = await fetch(`${this.baseUrl}/api/chat`);
    return response.json();
  },

  async getSessions() {
    const response = await fetch(`${this.baseUrl}/api/sessions`);
    return response.json();
  },

  async createSession() {
    const response = await fetch(`${this.baseUrl}/api/sessions`, {
      method: "POST",
    });
    return response.json();
  },

  async getConfig() {
    const response = await fetch(`${this.baseUrl}/api/config`);
    return response.json();
  },

  async setConfig(config) {
    await fetch(`${this.baseUrl}/api/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
  },
};

// Initialize
async function init() {
  // Load theme
  applyTheme(state.theme);

  // Load config
  try {
    const config = await api.getConfig();
    updateModelInfo(config);
  } catch (e) {
    console.log("Using default config");
  }

  // Load sessions
  await loadSessions();

  // Setup event listeners
  setupEventListeners();

  // Connect to SSE
  connectSSE();

  // Auto-resize textarea
  autoResizeTextarea(elements.messageInput);
}

// Event Listeners
function setupEventListeners() {
  // Send message
  elements.btnSend.addEventListener("click", sendMessage);
  elements.messageInput.addEventListener("keydown", handleInputKeydown);

  // Settings
  elements.btnSettings.addEventListener("click", () => toggleModal(true));
  elements.btnCloseSettings.addEventListener("click", () => toggleModal(false));
  elements.settingsModal.addEventListener("click", (e) => {
    if (e.target === elements.settingsModal) toggleModal(false);
  });

  // Theme
  elements.btnTheme.addEventListener("click", toggleTheme);
  elements.themeBtns.forEach((btn) => {
    btn.addEventListener("click", () => setTheme(btn.dataset.theme));
  });

  // New chat
  elements.btnNewChat.addEventListener("click", newChat);
  elements.btnNewSession.addEventListener("click", newChat);

  // Quick actions
  elements.quickActions.forEach((btn) => {
    btn.addEventListener("click", () => {
      elements.messageInput.value = btn.dataset.prompt;
      sendMessage();
    });
  });
}

// Message Handling
async function sendMessage() {
  const content = elements.messageInput.value.trim();
  if (!content || state.isLoading) return;

  // Clear input
  elements.messageInput.value = "";
  autoResizeTextarea(elements.messageInput);

  // Hide welcome
  elements.welcome.style.display = "none";

  // Add user message
  addMessage("user", content);

  // Show loading
  setLoading(true);

  try {
    await api.sendMessage(content);
    // Response will come via SSE
  } catch (error) {
    console.error("Error sending message:", error);
    addMessage("assistant", "Sorry, there was an error processing your request.");
    setLoading(false);
  }
}

function handleInputKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

// Message Rendering
function addMessage(role, content, extra = {}) {
  const message = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    role,
    content,
    timestamp: Date.now(),
    ...extra,
  };

  state.messages.push(message);
  renderMessage(message);
  scrollToBottom();

  return message;
}

function updateMessage(messageId, content) {
  const msgEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (msgEl) {
    const contentEl = msgEl.querySelector(".message-text");
    if (contentEl) {
      contentEl.textContent = content;
    }
  }
}

function renderMessage(message) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";

  const avatar = isUser ? "👤" : isTool ? "🔧" : "🤖";

  const messageEl = document.createElement("div");
  messageEl.className = `message ${message.role}`;
  messageEl.dataset.messageId = message.id;

  let toolInfo = "";
  if (isTool && message.toolName) {
    toolInfo = `<div class="message-tool-info">🔧 ${message.toolName}</div>`;
  }

  let toolResult = "";
  if (isTool && message.toolResult) {
    toolResult = `<div class="message-tool-result">${escapeHtml(message.toolResult)}</div>`;
  }

  messageEl.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">
      ${toolInfo}
      <div class="message-text">${formatContent(message.content)}</div>
      ${toolResult}
    </div>
  `;

  elements.messages.appendChild(messageEl);
  updateMessageCount();
}

function formatContent(content) {
  // Simple markdown-like formatting
  let formatted = escapeHtml(content);

  // Code blocks
  formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // Inline code
  formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Italic
  formatted = formatted.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Line breaks
  formatted = formatted.replace(/\n/g, "<br>");

  return formatted;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Sessions
async function loadSessions() {
  try {
    state.sessions = await api.getSessions();
    renderSessions();
  } catch (e) {
    console.error("Error loading sessions:", e);
  }
}

function renderSessions() {
  if (state.sessions.length === 0) {
    elements.sessionList.innerHTML = `
      <div class="empty-state">
        <p>No conversations yet</p>
      </div>
    `;
    return;
  }

  elements.sessionList.innerHTML = state.sessions
    .map(
      (session) => `
      <div class="session-item ${session.id === state.currentSession?.id ? "active" : ""}" 
           data-session-id="${session.id}">
        <span class="session-name">${escapeHtml(session.name)}</span>
      </div>
    `
    )
    .join("");

  // Add click handlers
  elements.sessionList.querySelectorAll(".session-item").forEach((item) => {
    item.addEventListener("click", () => selectSession(item.dataset.sessionId));
  });
}

async function selectSession(sessionId) {
  // TODO: Load session messages
  state.currentSession = state.sessions.find((s) => s.id === sessionId);
  renderSessions();
}

async function newChat() {
  try {
    const session = await api.createSession();
    state.sessions.unshift(session);
    state.currentSession = session;
    state.messages = [];
    elements.messages.innerHTML = "";
    elements.welcome.style.display = "flex";
    renderSessions();
    updateMessageCount();
  } catch (e) {
    console.error("Error creating session:", e);
  }
}

// SSE Connection
function connectSSE() {
  if (state.eventSource) {
    state.eventSource.close();
  }

  state.eventSource = new EventSource(`${api.baseUrl}/api/events`);

  state.eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleStreamEvent(data);
  };

  state.eventSource.onerror = () => {
    console.log("SSE connection lost, reconnecting...");
    setTimeout(connectSSE, 3000);
  };
}

function handleStreamEvent(data) {
  switch (data.type) {
    case "message":
      addMessage(data.message.role, data.message.content);
      break;

    case "update":
      updateMessage(data.messageId, data.content);
      break;

    case "done":
      setLoading(false);
      break;

    case "error":
      addMessage("assistant", `Error: ${data.error}`);
      setLoading(false);
      break;

    case "connected":
      console.log("SSE connected");
      break;
  }
}

// Theme
function setTheme(theme) {
  state.theme = theme;
  localStorage.setItem("theme", theme);
  applyTheme(theme);

  // Update theme buttons
  elements.themeBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === theme);
  });

  // Update theme toggle button
  const themeIcon = theme === "light" ? "🌙" : "☀️";
  elements.btnTheme.textContent = themeIcon;
}

function toggleTheme() {
  const newTheme = state.theme === "dark" ? "light" : "dark";
  setTheme(newTheme);
}

function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
}

// Modal
function toggleModal(show) {
  elements.settingsModal.classList.toggle("active", show);
}

// Loading
function setLoading(loading) {
  state.isLoading = loading;
  elements.loading.classList.toggle("active", loading);
  elements.btnSend.disabled = loading;
}

// Helpers
function scrollToBottom() {
  elements.messages.scrollTop = elements.messages.scrollHeight;
}

function autoResizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
}

function updateMessageCount() {
  const count = state.messages.length;
  elements.msgCount.textContent = `${count} message${count !== 1 ? "s" : ""}`;
}

function updateModelInfo(config) {
  if (config) {
    elements.modelInfo.textContent = `${config.title} v1.0.0`;
    elements.currentModel.textContent = `${config.provider || "Not configured"}`;
  }
}

// Initialize on load
document.addEventListener("DOMContentLoaded", init);

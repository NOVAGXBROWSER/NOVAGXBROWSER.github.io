const joinBtn = document.getElementById("joinBtn");
const usernameInput = document.getElementById("username");
const roomInput = document.getElementById("room");
const loginDiv = document.getElementById("login");
const chatDiv = document.getElementById("chat");
const youLabel = document.getElementById("you");
const roomLabel = document.getElementById("roomName");
const messagesDiv = document.getElementById("messages");
const msgForm = document.getElementById("msgForm");
const msgInput = document.getElementById("msgInput");
const leaveBtn = document.getElementById("leaveBtn");

let ws = null;
let username = null;
let room = null;

// Point to your Render backend
let BACKEND_WS_BASE = "wss://relink-backend1.onrender.com/ws";

const userColors = {};
function getColor(username) {
  if (!userColors[username]) {
    const hue = Math.floor(Math.random() * 360);
    userColors[username] = `hsl(${hue}, 70%, 50%)`;
  }
  return userColors[username];
}

function escapeHtml(s) {
  if (!s) return "";
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"}[c]));
}

function addMessage(item) {
  const el = document.createElement("div");
  el.className = "msg " + (item.type === "system" ? "system" : "user");
  if (item.type === "system") {
    el.textContent = `[${new Date(item.ts).toLocaleTimeString()}] ${item.text}`;
  } else {
    el.innerHTML = `<b style="color:${getColor(item.actor)}">${escapeHtml(item.actor)}</b>: ${escapeHtml(item.text)} <span class="ts">${new Date(item.ts).toLocaleTimeString()}</span>`;
  }
  messagesDiv.appendChild(el);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

joinBtn.addEventListener("click", () => {
  username = usernameInput.value.trim();
  room = roomInput.value.trim();
  if (!username || !room) {
    alert("Enter a username and room name");
    return;
  }
  youLabel.textContent = `You: ${username}`;
  roomLabel.textContent = `Room: ${room}`;
  loginDiv.style.display = "none";
  chatDiv.style.display = "flex";
  connectWS();
});

leaveBtn.addEventListener("click", () => {
  if (ws) ws.close();
  chatDiv.style.display = "none";
  loginDiv.style.display = "flex";
  messagesDiv.innerHTML = "";
});

msgForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({type: "message", text}));
  msgInput.value = "";
});

function connectWS() {
  const wsUrl = `${BACKEND_WS_BASE}/${encodeURIComponent(room)}/${encodeURIComponent(username)}`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    addMessage({type:"system", text:"Connected to RELINK", ts:new Date().toISOString()});
  };
  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      addMessage(data);
    } catch (e) {
      addMessage({type:"system", text: ev.data, ts:new Date().toISOString()});
    }
  };
  ws.onclose = () => {
    addMessage({type:"system", text:"Disconnected from server", ts:new Date().toISOString()});
  };
  ws.onerror = (err) => {
    console.error("WS error", err);
    addMessage({type:"system", text:"Connection error", ts:new Date().toISOString()});
  };
}

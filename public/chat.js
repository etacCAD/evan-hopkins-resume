/* ============================================================
   EVAN AI — Chat Widget Controller
   Handles: UI, Claude API (via proxy), proactive engagement,
            session persistence, typing indicators
   ============================================================ */

// ── Config ───────────────────────────────────────────────────
const API_URL = window.EVAN_AI_API_URL || '/api/chat';

// ── State ────────────────────────────────────────────────────
const STATE = {
    isOpen: false,
    isTyping: false,
    messages: [],
    sessionId: null,
    hasGreeted: false,
    proactiveShown: false,
};

// ── DOM References (set on init) ─────────────────────────────
let els = {};

// ── Public Init ──────────────────────────────────────────────
export function initEvanAI() {
    buildWidget();
    loadSession();
    bindEvents();
    initProactiveEngagement();
}

// ── Build Widget DOM ─────────────────────────────────────────
function buildWidget() {
    const widget = document.createElement('div');
    widget.id = 'evanai-widget';
    widget.innerHTML = `
        <button class="evanai-fab" id="evanai-fab" aria-label="Chat with EvanAI">
            <svg class="evanai-fab-icon evanai-fab-icon--chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
            </svg>
            <svg class="evanai-fab-icon evanai-fab-icon--close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            <span class="evanai-fab-badge" id="evanai-badge"></span>
        </button>
        <div class="evanai-panel" id="evanai-panel">
            <div class="evanai-header">
                <div class="evanai-header-info">
                    <div class="evanai-avatar">EH</div>
                    <div>
                        <div class="evanai-header-name">EvanAI</div>
                        <div class="evanai-header-status" id="evanai-status">Online</div>
                    </div>
                </div>
                <button class="evanai-header-close" id="evanai-close" aria-label="Close chat">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="evanai-messages" id="evanai-messages"></div>
            <div class="evanai-input-area">
                <textarea class="evanai-input" id="evanai-input" placeholder="Ask me about Evan's experience..." rows="1"></textarea>
                <button class="evanai-send" id="evanai-send" aria-label="Send message" disabled>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="evanai-proactive" id="evanai-proactive"></div>
    `;
    document.body.appendChild(widget);

    // Cache references
    els = {
        widget,
        fab: document.getElementById('evanai-fab'),
        badge: document.getElementById('evanai-badge'),
        panel: document.getElementById('evanai-panel'),
        close: document.getElementById('evanai-close'),
        messages: document.getElementById('evanai-messages'),
        input: document.getElementById('evanai-input'),
        send: document.getElementById('evanai-send'),
        status: document.getElementById('evanai-status'),
        proactive: document.getElementById('evanai-proactive'),
    };
}

// ── Event Bindings ───────────────────────────────────────────
function bindEvents() {
    els.fab.addEventListener('click', toggleWidget);
    els.close.addEventListener('click', () => setOpen(false));

    els.input.addEventListener('input', () => {
        els.send.disabled = !els.input.value.trim();
        autoResizeInput();
    });

    els.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    els.send.addEventListener('click', sendMessage);

    // Close on escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && STATE.isOpen) setOpen(false);
    });
}

// ── Toggle / Open / Close ────────────────────────────────────
function toggleWidget() {
    setOpen(!STATE.isOpen);
}

function setOpen(open) {
    STATE.isOpen = open;
    els.panel.classList.toggle('evanai-panel--open', open);
    els.fab.classList.toggle('evanai-fab--open', open);

    if (open) {
        els.proactive.classList.remove('evanai-proactive--visible');
        els.badge.classList.remove('evanai-badge--visible');

        if (!STATE.hasGreeted && STATE.messages.length === 0) {
            STATE.hasGreeted = true;
            setTimeout(() => {
                addBotMessage(getGreeting());
            }, 500);
        }

        setTimeout(() => els.input.focus(), 300);
    }
}

// ── Greeting Generator ───────────────────────────────────────
function getGreeting() {
    const hour = new Date().getHours();
    let timeGreeting;
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 17) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';

    const greetings = [
        `${timeGreeting}! I'm EvanAI — Evan's digital wingman. What brings you to his page today?`,
        `Hey there! I'm EvanAI. ${timeGreeting} — are you looking for a revenue leader, or just exploring?`,
        `${timeGreeting}! I'm EvanAI, here to tell you about Evan's experience and see if there's a fit. What are you working on?`,
    ];

    return greetings[Math.floor(Math.random() * greetings.length)];
}

// ── Proactive Engagement ─────────────────────────────────────
function initProactiveEngagement() {
    if (STATE.messages.length > 0) return;

    setTimeout(() => {
        if (!STATE.isOpen && !STATE.proactiveShown) {
            showProactive("Hey — curious what brought you here today? 👋");
        }
    }, 8000);

    const capabilitiesSection = document.getElementById('capabilities');
    const contactSection = document.getElementById('contact');

    if (capabilitiesSection) {
        const capObs = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !STATE.isOpen && !STATE.proactiveShown) {
                showProactive("See something that matches what you're looking for?");
                capObs.disconnect();
            }
        }, { threshold: 0.3 });
        capObs.observe(capabilitiesSection);
    }

    if (contactSection) {
        const contactObs = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && !STATE.isOpen && !STATE.proactiveShown) {
                showProactive("Want to skip the form? Tell me about your company instead.");
                contactObs.disconnect();
            }
        }, { threshold: 0.3 });
        contactObs.observe(contactSection);
    }
}

function showProactive(text) {
    STATE.proactiveShown = true;
    els.proactive.textContent = text;
    els.proactive.classList.add('evanai-proactive--visible');
    els.badge.classList.add('evanai-badge--visible');

    els.proactive.addEventListener('click', () => {
        els.proactive.classList.remove('evanai-proactive--visible');
        setOpen(true);
    }, { once: true });

    setTimeout(() => {
        els.proactive.classList.remove('evanai-proactive--visible');
    }, 12000);
}

// ── Message Handling ─────────────────────────────────────────
function addUserMessage(text) {
    const msg = { role: 'user', content: text, timestamp: Date.now() };
    STATE.messages.push(msg);
    renderMessage(msg);
    saveSession();
}

function addBotMessage(text) {
    const msg = { role: 'assistant', content: text, timestamp: Date.now() };
    STATE.messages.push(msg);
    renderMessage(msg);
    saveSession();
}

function renderMessage(msg) {
    const div = document.createElement('div');
    div.className = `evanai-msg evanai-msg--${msg.role === 'user' ? 'user' : 'bot'}`;

    if (msg.role !== 'user') {
        const avatar = document.createElement('div');
        avatar.className = 'evanai-msg-avatar';
        avatar.textContent = 'EH';
        div.appendChild(avatar);
    }

    const bubble = document.createElement('div');
    bubble.className = 'evanai-msg-bubble';
    bubble.textContent = msg.content;
    div.appendChild(bubble);

    els.messages.appendChild(div);
    scrollToBottom();
}

function renderAllMessages() {
    els.messages.innerHTML = '';
    STATE.messages.forEach(msg => renderMessage(msg));
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        els.messages.scrollTop = els.messages.scrollHeight;
    });
}

// ── Typing Indicator ─────────────────────────────────────────
function showTyping() {
    STATE.isTyping = true;
    els.status.textContent = 'Typing...';

    const indicator = document.createElement('div');
    indicator.className = 'evanai-msg evanai-msg--bot evanai-typing';
    indicator.id = 'evanai-typing-indicator';

    const avatar = document.createElement('div');
    avatar.className = 'evanai-msg-avatar';
    avatar.textContent = 'EH';
    indicator.appendChild(avatar);

    const bubble = document.createElement('div');
    bubble.className = 'evanai-msg-bubble evanai-msg-bubble--typing';
    bubble.innerHTML = '<span class="evanai-dot"></span><span class="evanai-dot"></span><span class="evanai-dot"></span>';
    indicator.appendChild(bubble);

    els.messages.appendChild(indicator);
    scrollToBottom();
}

function hideTyping() {
    STATE.isTyping = false;
    els.status.textContent = 'Online';
    const indicator = document.getElementById('evanai-typing-indicator');
    if (indicator) indicator.remove();
}

// ── Send Message & API Call ──────────────────────────────────
async function sendMessage() {
    const text = els.input.value.trim();
    if (!text || STATE.isTyping) return;

    els.input.value = '';
    els.send.disabled = true;
    autoResizeInput();

    addUserMessage(text);
    showTyping();

    try {
        const response = await callClaude();
        hideTyping();
        addBotMessage(response);
    } catch (err) {
        hideTyping();
        console.error('EvanAI error:', err);
        addBotMessage("Looks like I hit a snag. Want to reach Evan directly? Email him at evan@tacanni.com or call 512-466-3938.");
    }
}

// ── Claude API (via proxy server) ────────────────────────────
async function callClaude() {
    const messages = STATE.messages.map(m => ({
        role: m.role,
        content: m.content,
    }));

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API error: ${response.status} — ${errorData?.error || 'Unknown'}`);
    }

    const data = await response.json();
    return data.response;
}

// ── Session Persistence ──────────────────────────────────────
function saveSession() {
    try {
        const data = {
            messages: STATE.messages,
            hasGreeted: STATE.hasGreeted,
            sessionId: STATE.sessionId,
            timestamp: Date.now(),
        };
        localStorage.setItem('evanai_session', JSON.stringify(data));
    } catch (e) { /* localStorage full or blocked */ }
}

function loadSession() {
    try {
        const raw = localStorage.getItem('evanai_session');
        if (!raw) {
            STATE.sessionId = generateSessionId();
            return;
        }

        const data = JSON.parse(raw);

        if (Date.now() - data.timestamp > 2 * 60 * 60 * 1000) {
            localStorage.removeItem('evanai_session');
            STATE.sessionId = generateSessionId();
            return;
        }

        STATE.messages = data.messages || [];
        STATE.hasGreeted = data.hasGreeted || false;
        STATE.sessionId = data.sessionId || generateSessionId();
        STATE.proactiveShown = STATE.messages.length > 0;

        if (STATE.messages.length > 0) {
            renderAllMessages();
        }
    } catch (e) {
        STATE.sessionId = generateSessionId();
    }
}

function generateSessionId() {
    return 'evanai_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ── Input Auto-Resize ────────────────────────────────────────
function autoResizeInput() {
    els.input.style.height = 'auto';
    els.input.style.height = Math.min(els.input.scrollHeight, 120) + 'px';
}

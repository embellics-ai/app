/**
 * Embellics Chat Widget (Powered by Retell AI)
 * Embeddable text chat widget for external websites
 */

(function () {
  'use strict';

  const currentScript =
    document.currentScript ||
    (function () {
      const scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();

  const API_KEY = currentScript ? currentScript.getAttribute('data-api-key') : null;

  if (!API_KEY) {
    console.error('[Embellics Widget] Error: data-api-key attribute is required');
    return;
  }

  const WIDGET_API_BASE = currentScript
    ? new URL(currentScript.src).origin
    : window.location.origin;

  let widgetConfig = null;
  let isOpen = false;
  let isInitialized = false;
  let chatId = null;
  let messages = [];
  let handoffId = null;
  let handoffStatus = 'none'; // none, pending, active, resolved
  let statusCheckInterval = null;

  // LocalStorage keys for persistence (only store IDs, not messages)
  const STORAGE_KEYS = {
    CHAT_ID: 'embellics_chat_id',
    HANDOFF_ID: 'embellics_handoff_id',
    HANDOFF_STATUS: 'embellics_handoff_status',
  };

  function createWidgetHTML() {
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'embellics-widget-container';
    widgetContainer.innerHTML = `
      <style>
        /* Using application's design system - matching Tailwind config and index.css */
        #embellics-widget-container { position: fixed; bottom: 20px; right: 20px; z-index: 999999; font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        #embellics-widget-button { width: 60px; height: 60px; border-radius: 50%; background: hsl(262, 75%, 65%); border: none; cursor: pointer; box-shadow: 0 8px 24px hsla(262, 75%, 65%, 0.4); display: flex; align-items: center; justify-content: center; transition: transform 0.2s, box-shadow 0.3s; }
        #embellics-widget-button:hover { transform: scale(1.08); box-shadow: 0 12px 32px hsla(262, 75%, 65%, 0.5); }
        #embellics-widget-button svg { width: 28px; height: 28px; fill: white; }
        #embellics-widget-panel { position: fixed; bottom: 90px; right: 20px; width: 380px; height: 600px; max-height: calc(100vh - 120px); border-radius: 0.75rem; box-shadow: 0 12px 48px hsla(262, 75%, 65%, 0.2), 0 0 0 1px hsla(262, 75%, 65%, 0.1); background: hsl(0, 0%, 100%); display: none; flex-direction: column; overflow: hidden; transition: opacity 0.3s, transform 0.3s; opacity: 0; transform: translateY(10px); }
        #embellics-widget-panel.open { display: flex; opacity: 1; transform: translateY(0); }
        #embellics-widget-header { background: hsl(262, 75%, 65%); color: hsl(262, 75%, 98%); padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; }
        #embellics-widget-title { font-weight: 600; font-size: 16px; margin: 0; }
        #embellics-widget-close { background: none; border: none; color: hsl(262 75% 98%); cursor: pointer; font-size: 24px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background 0.2s; }
        #embellics-widget-close:hover { background: rgba(255, 255, 255, 0.1); }
        #embellics-widget-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; background: hsl(0 0% 98%); }
        .embellics-message { max-width: 80%; padding: 12px 16px; border-radius: 0.75rem; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
        .embellics-message.user { align-self: flex-end; background: hsl(262, 75%, 65%); color: hsl(262, 75%, 98%); border-bottom-right-radius: 4px; box-shadow: 0 4px 12px hsla(262, 75%, 65%, 0.3); }
        .embellics-message.assistant { align-self: flex-start; background: hsl(0, 0%, 100%); color: hsl(0, 0%, 9%); border: 1px solid hsl(0, 0%, 94%); border-bottom-left-radius: 4px; box-shadow: 0 2px 8px hsla(262, 75%, 65%, 0.08); }
        .embellics-message.system { align-self: center; background: hsl(262, 100%, 97%); color: hsl(262, 75%, 30%); font-size: 12px; padding: 8px 12px; border: 1px solid hsl(0, 0%, 94%); border-radius: 0.75rem; }
        .embellics-typing { display: none; align-self: flex-start; background: hsl(0, 0%, 100%); color: hsl(262, 10%, 40%); border: 1px solid hsl(0, 0%, 90%); padding: 12px 16px; border-radius: 0.75rem; font-size: 14px; }
        .embellics-typing.show { display: block; }
        #embellics-widget-input-container { padding: 16px; border-top: 1px solid hsl(0, 0%, 90%); display: flex; gap: 8px; background: hsl(0, 0%, 100%); align-items: center; position: relative; }
        #embellics-widget-input { flex: 1; padding: 12px 16px; border: 1px solid hsl(262, 15%, 85%); border-radius: 24px; font-size: 14px; outline: none; font-family: inherit; background: hsl(0, 0%, 100%); transition: border-color 0.2s, background 0.2s; }
        #embellics-widget-input:focus { border-color: hsl(262, 75%, 65%); background: hsl(0, 0%, 100%); box-shadow: 0 0 0 3px hsla(262, 75%, 65%, 0.1); }
        #embellics-widget-send { width: 40px; height: 40px; border-radius: 50%; background: hsl(262, 75%, 65%); border: none; color: hsl(262, 75%, 98%); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 12px hsla(262, 75%, 65%, 0.3); flex-shrink: 0; }
        #embellics-widget-send:hover { transform: scale(1.05); box-shadow: 0 6px 16px hsla(262, 75%, 65%, 0.4); }
        #embellics-widget-send:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
        
        /* Actions Menu Button */
        #embellics-widget-actions-btn { width: 40px; height: 40px; border-radius: 50%; background: hsl(262, 15%, 92%); border: none; color: hsl(262, 10%, 40%); cursor: pointer; display: none; align-items: center; justify-content: center; transition: background 0.2s; flex-shrink: 0; }
        #embellics-widget-actions-btn.show { display: flex; }
        #embellics-widget-actions-btn:hover { background: hsl(262, 10%, 94%); }
        #embellics-widget-actions-btn.active { background: hsl(262, 10%, 94%); }
        
        /* Dropdown Menu */
        #embellics-widget-actions-menu { position: absolute; bottom: 70px; right: 16px; background: hsl(0, 0%, 94%); border-radius: 0.75rem; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05); min-width: 200px; overflow: hidden; z-index: 1000; display: none; animation: slideUpFadeIn 0.2s ease-out; border: 1px solid hsl(0, 0%, 90%); }
        #embellics-widget-actions-menu.show { display: block; }
        
        /* Menu Items */
        .embellics-menu-item { padding: 14px 16px; display: flex; align-items: center; gap: 12px; border: none; background: none; width: 100%; text-align: left; cursor: pointer; font-size: 14px; color: hsl(0, 0%, 9%); transition: background 0.15s; font-weight: 500; border-bottom: 1px solid hsl(0, 0%, 90%); }
        .embellics-menu-item:last-child { border-bottom: none; }
        .embellics-menu-item:hover:not(:disabled) { background: hsl(0, 0%, 98%); }
        .embellics-menu-item:disabled { opacity: 0.4; cursor: not-allowed; }
        .embellics-menu-item svg { flex-shrink: 0; }
        .embellics-menu-item.danger { color: hsl(0, 72%, 42%); }
        .embellics-menu-item.danger:hover:not(:disabled) { background: hsl(0, 72%, 98%); }
        .embellics-menu-item.hidden { display: none; }
        
        @keyframes slideUpFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .embellics-handoff-notice { background: hsl(199, 89%, 92%); color: hsl(199, 89%, 32%); padding: 12px; border-radius: 0.75rem; font-size: 13px; margin: 8px 0; text-align: center; border: 1px solid hsl(199, 89%, 85%); }
        #embellics-widget-error { color: hsl(0, 72%, 42%); font-size: 12px; padding: 12px 16px; background: hsl(0, 72%, 98%); border-top: 1px solid hsl(0, 72%, 90%); text-align: center; display: none; }
        #embellics-widget-error.show { display: block; }
        .embellics-email-form { background: hsl(0, 0%, 98%); padding: 16px; border-radius: 0.75rem; margin: 8px 0; border: 1px solid hsl(0, 0%, 94%); }
        .embellics-email-form input { width: 100%; padding: 10px; border: 1px solid hsl(262, 15%, 85%); border-radius: 0.375rem; font-size: 14px; margin: 8px 0; box-sizing: border-box; background: hsl(0, 0%, 100%); color: hsl(0, 0%, 9%); }
        .embellics-email-form textarea { width: 100%; padding: 10px; border: 1px solid hsl(262, 15%, 85%); border-radius: 0.375rem; font-size: 14px; margin: 8px 0; resize: vertical; min-height: 60px; box-sizing: border-box; font-family: inherit; background: hsl(0, 0%, 100%); color: hsl(0, 0%, 9%); }
        .embellics-email-form button { width: 100%; padding: 12px; background: hsl(262, 75%, 65%); color: hsl(262, 75%, 98%); border: none; border-radius: 0.5625rem; font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: 0 4px 12px hsla(262, 75%, 65%, 0.3); transition: transform 0.2s, box-shadow 0.2s; }
        .embellics-email-form button:hover { transform: translateY(-1px); box-shadow: 0 6px 16px hsla(262, 75%, 65%, 0.4); }
        
        /* End Chat Confirmation Modal */
        #embellics-end-chat-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.5); display: none; align-items: center; justify-content: center; z-index: 9999999; animation: fadeIn 0.2s ease-out; }
        #embellics-end-chat-modal.show { display: flex; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .embellics-modal-content { background: hsl(0, 0%, 100%); border-radius: 0.75rem; padding: 24px; max-width: 400px; width: calc(100% - 40px); box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3); animation: slideUp 0.3s ease-out; border: 1px solid hsl(0, 0%, 90%); }
        .embellics-modal-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .embellics-modal-icon { width: 48px; height: 48px; border-radius: 50%; background: hsl(0, 72%, 98%); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .embellics-modal-icon svg { width: 24px; height: 24px; color: hsl(0, 72%, 42%); }
        .embellics-modal-title { font-size: 18px; font-weight: 600; color: hsl(0, 0%, 9%); margin: 0; }
        .embellics-modal-message { color: hsl(262, 10%, 40%); font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; }
        .embellics-modal-actions { display: flex; gap: 12px; justify-content: flex-end; }
        .embellics-modal-btn { padding: 10px 20px; border-radius: 0.5625rem; font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: all 0.2s; }
        .embellics-modal-btn-cancel { background: hsl(262, 15%, 92%); color: hsl(262, 15%, 20%); }
        .embellics-modal-btn-cancel:hover { background: hsl(262, 10%, 94%); }
        .embellics-modal-btn-confirm { background: hsl(0, 72%, 42%); color: hsl(0, 72%, 98%); }
        .embellics-modal-btn-confirm:hover { background: hsl(0, 72%, 35%); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }
        
        @media (max-width: 480px) {
          #embellics-widget-panel { width: calc(100vw - 40px); right: 20px; }
          .embellics-modal-content { padding: 20px; }
          .embellics-modal-actions { flex-direction: column-reverse; }
          .embellics-modal-btn { width: 100%; }
        }
      </style>
      <button id="embellics-widget-button" aria-label="Open chat">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
      </button>
      <div id="embellics-widget-panel">
        <div id="embellics-widget-header">
          <h3 id="embellics-widget-title">Chat Assistant</h3>
          <button id="embellics-widget-close" aria-label="Close">×</button>
        </div>
        <div id="embellics-widget-messages"></div>
        <div class="embellics-typing" id="embellics-widget-typing">Agent is typing...</div>
        <div id="embellics-widget-error"></div>
        <div id="embellics-widget-input-container">
          <input type="text" id="embellics-widget-input" placeholder="Type your message..." />
          <button id="embellics-widget-send" aria-label="Send message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
          <button id="embellics-widget-actions-btn" aria-label="Actions menu" title="More actions">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="12" cy="19" r="2"/>
            </svg>
          </button>
          
          <!-- Actions Dropdown Menu -->
          <div id="embellics-widget-actions-menu">
            <button class="embellics-menu-item" id="embellics-menu-handoff" disabled>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87m-4-12a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span>Talk to a Human</span>
            </button>
            <button class="embellics-menu-item danger hidden" id="embellics-menu-end-chat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"></path>
              </svg>
              <span>End Chat</span>
            </button>
          </div>
        </div>
      </div>
      
      <!-- End Chat Confirmation Modal -->
      <div id="embellics-end-chat-modal">
        <div class="embellics-modal-content">
          <div class="embellics-modal-header">
            <div class="embellics-modal-icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 class="embellics-modal-title">End Chat?</h3>
          </div>
          <p class="embellics-modal-message">
            Are you sure you want to end this conversation? This will close the chat and clear your session.
          </p>
          <div class="embellics-modal-actions">
            <button class="embellics-modal-btn embellics-modal-btn-cancel" id="embellics-modal-cancel">
              Cancel
            </button>
            <button class="embellics-modal-btn embellics-modal-btn-confirm" id="embellics-modal-confirm">
              End Chat
            </button>
          </div>
        </div>
      </div>
    `;
    return widgetContainer;
  }

  // Save session state to localStorage (only IDs)
  function saveSessionState() {
    try {
      if (chatId) {
        localStorage.setItem(STORAGE_KEYS.CHAT_ID, chatId);
      }
      if (handoffId) {
        localStorage.setItem(STORAGE_KEYS.HANDOFF_ID, handoffId);
      }
      if (handoffStatus) {
        localStorage.setItem(STORAGE_KEYS.HANDOFF_STATUS, handoffStatus);
      }
    } catch (error) {
      console.error('[Embellics Widget] Failed to save session state:', error);
    }
  }

  // Restore session state from localStorage (only IDs)
  function restoreSessionState() {
    try {
      const savedChatId = localStorage.getItem(STORAGE_KEYS.CHAT_ID);
      const savedHandoffId = localStorage.getItem(STORAGE_KEYS.HANDOFF_ID);
      const savedHandoffStatus = localStorage.getItem(STORAGE_KEYS.HANDOFF_STATUS);

      if (savedChatId) {
        chatId = savedChatId;
        console.log('[Embellics Widget] Restored chat session:', chatId);

        // Show actions menu and enable items
        const actionsBtn = document.getElementById('embellics-widget-actions-btn');
        const menuHandoff = document.getElementById('embellics-menu-handoff');
        const menuEndChat = document.getElementById('embellics-menu-end-chat');

        if (actionsBtn) actionsBtn.classList.add('show');
        if (menuHandoff) menuHandoff.disabled = false;
        if (menuEndChat) menuEndChat.classList.remove('hidden');
      }

      if (savedHandoffId && savedHandoffStatus) {
        handoffId = savedHandoffId;
        handoffStatus = savedHandoffStatus;
        console.log('[Embellics Widget] Restored handoff session:', handoffId, handoffStatus);

        // If handoff is active, restart message polling AND status checking
        if (handoffStatus === 'active') {
          const menuHandoff = document.getElementById('embellics-menu-handoff');
          if (menuHandoff) menuHandoff.disabled = true;
          startMessagePolling();
          startStatusChecking(); // Also check status to detect when agent resolves
        } else if (handoffStatus === 'pending') {
          const menuHandoff = document.getElementById('embellics-menu-handoff');
          if (menuHandoff) menuHandoff.disabled = true;
          startStatusChecking();
        }
      }

      return !!(savedChatId || savedHandoffId);
    } catch (error) {
      console.error('[Embellics Widget] Failed to restore session state:', error);
      return false;
    }
  } // Clear session state (when handoff is resolved)
  function clearSessionState() {
    try {
      localStorage.removeItem(STORAGE_KEYS.CHAT_ID);
      localStorage.removeItem(STORAGE_KEYS.HANDOFF_ID);
      localStorage.removeItem(STORAGE_KEYS.HANDOFF_STATUS);
      chatId = null;
      handoffId = null;
      handoffStatus = 'none';
      messages = [];
      displayedMessageIds.clear();
      console.log('[Embellics Widget] Session state cleared');
    } catch (error) {
      console.error('[Embellics Widget] Failed to clear session state:', error);
    }
  }

  // Load chat history from API for restored session
  async function loadChatHistory() {
    if (!chatId) return;

    try {
      console.log('[Embellics Widget] Fetching history from API...');

      const url = new URL(`${WIDGET_API_BASE}/api/widget/session/${chatId}/history`);
      url.searchParams.append('apiKey', API_KEY);
      if (handoffId) {
        url.searchParams.append('handoffId', handoffId);
      }

      const response = await fetch(url);
      if (!response.ok) {
        console.error('[Embellics Widget] Failed to load history:', response.status);
        return;
      }

      const data = await response.json();

      // Clear message container
      const messagesContainer = document.getElementById('embellics-widget-messages');
      messagesContainer.innerHTML = '';

      // Clear displayed messages tracker
      displayedMessageIds.clear();

      // Display all messages from history
      if (data.messages && data.messages.length > 0) {
        console.log('[Embellics Widget] Loaded', data.messages.length, 'messages from API');

        data.messages.forEach((msg) => {
          // Track message ID to prevent duplicates
          if (msg.id) {
            displayedMessageIds.add(msg.id);
          }

          // Display message based on role
          if (msg.role === 'user') {
            addMessageToUI('user', msg.content);
          } else if (msg.role === 'assistant' || msg.role === 'agent') {
            addMessageToUI('assistant', msg.content);
          }
        });

        // Add status message if handoff is active/pending
        if (handoffStatus === 'active') {
          addMessageToUI('system', 'Connected to agent - conversation restored');
        } else if (handoffStatus === 'pending') {
          addMessageToUI('system', 'Waiting for an agent to join...');
        }
      } else {
        // No history found, show greeting
        if (widgetConfig && widgetConfig.greeting) {
          addMessageToUI('system', widgetConfig.greeting);
        }
      }
    } catch (error) {
      console.error('[Embellics Widget] Failed to load chat history:', error);
      showError('Failed to load conversation history');
    }
  }
  async function initializeWidget() {
    try {
      const response = await fetch(`${WIDGET_API_BASE}/api/widget/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: API_KEY, referrer: window.location.hostname }),
      });
      if (!response.ok) throw new Error(`Failed to initialize: ${response.status}`);
      widgetConfig = await response.json();
      isInitialized = true;

      // Widget styling is now fixed in CSS - no dynamic color customization
      // Colors follow the application's design system

      // Restore existing session if available
      const hasRestoredSession = restoreSessionState();

      if (hasRestoredSession && chatId) {
        // Load conversation history from API for restored session
        await loadChatHistory();
      } else {
        // New session - show greeting
        if (widgetConfig.greeting) {
          const title = document.getElementById('embellics-widget-title');
          if (title) title.textContent = widgetConfig.greeting;
          addMessage('system', widgetConfig.greeting);
        }
      }
    } catch (error) {
      console.error('[Embellics Widget] Init failed:', error);
      showError('Failed to initialize chat widget');
    }
  }

  // Add message to UI only (for displaying history)
  function addMessageToUI(role, content) {
    const messagesContainer = document.getElementById('embellics-widget-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `embellics-message ${role}`;
    messageDiv.textContent = content;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Add message to UI and track in messages array (for new messages)
  function addMessage(role, content) {
    addMessageToUI(role, content);

    // Track user and assistant messages
    if (role === 'user' || role === 'assistant') {
      messages.push({ role, content });
    }
  }
  function showTyping(show) {
    const typing = document.getElementById('embellics-widget-typing');
    if (show) {
      typing.classList.add('show');
    } else {
      typing.classList.remove('show');
    }
    const messagesContainer = document.getElementById('embellics-widget-messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function showError(message) {
    const errorDiv = document.getElementById('embellics-widget-error');
    errorDiv.textContent = message;
    errorDiv.classList.add('show');
    setTimeout(() => errorDiv.classList.remove('show'), 5000);
  }

  async function sendMessage() {
    const input = document.getElementById('embellics-widget-input');
    const sendBtn = document.getElementById('embellics-widget-send');
    const message = input.value.trim();

    if (!message) return;

    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;

    addMessage('user', message);

    try {
      // If in handoff mode with active agent, send to handoff endpoint
      if (handoffStatus === 'active' && handoffId) {
        const response = await fetch(`${WIDGET_API_BASE}/api/widget/handoff/${handoffId}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: API_KEY,
            message: message,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send message to agent');
        }

        // Message sent successfully - agent will see it
        // Response will come via polling
      } else {
        // Normal AI chat flow
        showTyping(true);

        const requestBody = {
          apiKey: API_KEY,
          message: message,
        };

        // Only include chatId if it exists
        if (chatId) {
          requestBody.chatId = chatId;
        }

        const response = await fetch(`${WIDGET_API_BASE}/api/widget/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to send message');
        }

        const data = await response.json();
        chatId = data.chatId;

        // Save session state
        saveSessionState();

        // Show actions menu and enable items once chat starts
        const actionsBtn = document.getElementById('embellics-widget-actions-btn');
        const menuHandoff = document.getElementById('embellics-menu-handoff');
        const menuEndChat = document.getElementById('embellics-menu-end-chat');

        if (actionsBtn && chatId) actionsBtn.classList.add('show');
        if (menuHandoff && chatId) menuHandoff.disabled = false;
        if (menuEndChat && chatId) menuEndChat.classList.remove('hidden');

        showTyping(false);

        if (data.response) {
          addMessage('assistant', data.response);
        }
      }
    } catch (error) {
      console.error('[Embellics Widget] Send message failed:', error);
      showTyping(false);
      showError(error.message || 'Failed to send message. Please try again.');
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  async function requestHandoff() {
    const menuHandoff = document.getElementById('embellics-menu-handoff');

    // Safety check: can't request handoff without a chat session
    if (!chatId) {
      showError('Please start a conversation first');
      return;
    }

    if (menuHandoff) menuHandoff.disabled = true;

    try {
      addMessage('system', 'Requesting connection to a human agent...');

      const response = await fetch(`${WIDGET_API_BASE}/api/widget/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: API_KEY,
          chatId: chatId,
          conversationHistory: messages.slice(-10), // Last 10 messages for context
          lastUserMessage: messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to request handoff');
      }

      const data = await response.json();
      handoffId = data.handoffId;
      handoffStatus = data.status;

      // Save session state
      saveSessionState();

      if (data.status === 'pending') {
        // Agents are available
        addMessage('system', 'An agent will be with you shortly...');
        const menuHandoff = document.getElementById('embellics-menu-handoff');
        if (menuHandoff) menuHandoff.disabled = true;
        startStatusChecking();
      } else if (data.status === 'after-hours') {
        // No agents available - show email form
        showEmailCollectionForm();
      }
    } catch (error) {
      console.error('[Embellics Widget] Handoff request failed:', error);
      showError(error.message || 'Failed to connect to agent. Please try again.');
      const menuHandoff = document.getElementById('embellics-menu-handoff');
      if (menuHandoff) menuHandoff.disabled = false;
    }
  }

  function showEmailCollectionForm() {
    const messagesContainer = document.getElementById('embellics-widget-messages');
    const formDiv = document.createElement('div');
    formDiv.className = 'embellics-email-form';
    formDiv.innerHTML = `
      <p style="margin: 0 0 12px 0; font-weight: 500; color: #374151;">No agents are currently available</p>
      <p style="margin: 0 0 12px 0; font-size: 13px; color: #6b7280;">Please leave your email and a message, and we'll get back to you soon.</p>
      <input type="email" id="embellics-handoff-email" placeholder="Your email address" required />
      <textarea id="embellics-handoff-message" placeholder="How can we help you? (optional)"></textarea>
      <button onclick="window.EmbellicsWidget.submitAfterHoursHandoff()">Submit Request</button>
    `;
    messagesContainer.appendChild(formDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async function submitAfterHoursHandoff() {
    const emailInput = document.getElementById('embellics-handoff-email');
    const messageInput = document.getElementById('embellics-handoff-message');
    const email = emailInput?.value.trim();
    const message = messageInput?.value.trim();

    if (!email) {
      showError('Please enter your email address');
      return;
    }

    try {
      const response = await fetch(`${WIDGET_API_BASE}/api/widget/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: API_KEY,
          chatId: chatId,
          conversationHistory: messages.slice(-10),
          lastUserMessage: messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '',
          userEmail: email,
          userMessage: message,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit request');
      }

      const data = await response.json();
      handoffId = data.handoffId;

      // Remove the form
      const form = document.querySelector('.embellics-email-form');
      if (form) form.remove();

      addMessage('system', "Thank you! We've received your request and will get back to you soon.");

      // Disable handoff menu item
      const menuHandoff = document.getElementById('embellics-menu-handoff');
      if (menuHandoff) menuHandoff.disabled = true;
    } catch (error) {
      console.error('[Embellics Widget] After-hours submission failed:', error);
      showError('Failed to submit request. Please try again.');
    }
  }

  // Actions Menu Functions
  function showActionsMenu() {
    const menu = document.getElementById('embellics-widget-actions-menu');
    const btn = document.getElementById('embellics-widget-actions-btn');
    if (menu && btn) {
      menu.classList.add('show');
      btn.classList.add('active');
    }
  }

  function hideActionsMenu() {
    const menu = document.getElementById('embellics-widget-actions-menu');
    const btn = document.getElementById('embellics-widget-actions-btn');
    if (menu && btn) {
      menu.classList.remove('show');
      btn.classList.remove('active');
    }
  }

  function toggleActionsMenu() {
    const menu = document.getElementById('embellics-widget-actions-menu');
    if (menu && menu.classList.contains('show')) {
      hideActionsMenu();
    } else {
      showActionsMenu();
    }
  }

  function showEndChatModal() {
    const modal = document.getElementById('embellics-end-chat-modal');
    if (modal) {
      modal.classList.add('show');
    }
  }

  function hideEndChatModal() {
    const modal = document.getElementById('embellics-end-chat-modal');
    if (modal) {
      modal.classList.remove('show');
    }
  }

  function endChat() {
    if (!chatId) {
      return; // Nothing to end
    }

    // Show confirmation modal instead of native confirm
    showEndChatModal();
  }

  async function confirmEndChat() {
    const menuEndChat = document.getElementById('embellics-menu-end-chat');

    // Hide modal
    hideEndChatModal();

    if (menuEndChat) menuEndChat.disabled = true;

    try {
      const response = await fetch(`${WIDGET_API_BASE}/api/widget/end-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: API_KEY,
          chatId: chatId,
          handoffId: handoffId || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to end chat');
      }

      // Stop polling
      stopMessagePolling();
      stopStatusChecking();

      // Clear session state
      clearSessionState();

      // Reset UI
      const messagesContainer = document.getElementById('embellics-widget-messages');
      messagesContainer.innerHTML = '';

      // Show confirmation message
      addMessageToUI('system', 'Chat ended. Feel free to start a new conversation anytime!');

      // Hide actions menu and reset menu items
      const actionsBtn = document.getElementById('embellics-widget-actions-btn');
      const menuHandoff = document.getElementById('embellics-menu-handoff');

      if (actionsBtn) actionsBtn.classList.remove('show');
      if (menuEndChat) {
        menuEndChat.classList.add('hidden');
        menuEndChat.disabled = false;
      }
      if (menuHandoff) menuHandoff.disabled = true;

      // Show greeting if configured
      if (widgetConfig && widgetConfig.greeting) {
        addMessageToUI('system', widgetConfig.greeting);
      }

      console.log('[Embellics Widget] Chat ended successfully');
    } catch (error) {
      console.error('[Embellics Widget] End chat failed:', error);
      showError(error.message || 'Failed to end chat. Please try again.');
      if (menuEndChat) menuEndChat.disabled = false;
    }
  }

  function startStatusChecking() {
    if (statusCheckInterval) clearInterval(statusCheckInterval);

    statusCheckInterval = setInterval(async () => {
      if (!handoffId) return;

      try {
        const response = await fetch(
          `${WIDGET_API_BASE}/api/widget/handoff/${handoffId}/status?apiKey=${API_KEY}`,
        );

        if (!response.ok) return;

        const data = await response.json();
        const newStatus = data.status;

        if (newStatus === 'active' && handoffStatus !== 'active') {
          // Agent picked up
          handoffStatus = 'active';
          saveSessionState(); // Save active status
          addMessage('system', `${data.agentName || 'An agent'} has joined the chat`);
          // Don't clear interval - continue checking for resolved status
          startMessagePolling();
        } else if (newStatus === 'resolved' && handoffStatus !== 'resolved') {
          // Chat resolved - clear session for fresh start next time
          handoffStatus = 'resolved';
          addMessage('system', 'The agent has ended this conversation. Thank you!');
          clearInterval(statusCheckInterval);
          stopMessagePolling();
          clearSessionState(); // Clear everything so next visit starts fresh

          // Hide actions menu and reset items
          const actionsBtn = document.getElementById('embellics-widget-actions-btn');
          const menuEndChat = document.getElementById('embellics-menu-end-chat');
          const menuHandoff = document.getElementById('embellics-menu-handoff');

          if (actionsBtn) actionsBtn.classList.remove('show');
          if (menuEndChat) menuEndChat.classList.add('hidden');
          if (menuHandoff) menuHandoff.disabled = true;
        }
      } catch (error) {
        console.error('[Embellics Widget] Status check failed:', error);
      }
    }, 2000); // Check every 2 seconds
  }

  let messagePollingInterval = null;
  let lastMessageTimestamp = null;
  let displayedMessageIds = new Set(); // Track which messages we've already shown

  function startMessagePolling() {
    if (messagePollingInterval) clearInterval(messagePollingInterval);

    messagePollingInterval = setInterval(async () => {
      if (!handoffId || handoffStatus !== 'active') return;

      try {
        const url = new URL(`${WIDGET_API_BASE}/api/widget/handoff/${handoffId}/messages`);
        url.searchParams.append('apiKey', API_KEY);
        if (lastMessageTimestamp) {
          url.searchParams.append('since', lastMessageTimestamp);
        }

        const response = await fetch(url);
        if (!response.ok) return;

        const data = await response.json();
        if (data.messages && data.messages.length > 0) {
          data.messages.forEach((msg) => {
            // Update timestamp for all agent messages (even if already displayed)
            if (msg.senderType === 'agent') {
              lastMessageTimestamp = msg.timestamp;

              // Only add messages we haven't displayed yet
              if (!displayedMessageIds.has(msg.id)) {
                addMessage('assistant', msg.content);
                displayedMessageIds.add(msg.id);
              }
            }
          });
        }
      } catch (error) {
        console.error('[Embellics Widget] Message polling failed:', error);
      }
    }, 1000); // Poll every second
  }

  function stopMessagePolling() {
    if (messagePollingInterval) {
      clearInterval(messagePollingInterval);
      messagePollingInterval = null;
    }
  }

  function stopStatusChecking() {
    if (statusCheckInterval) {
      clearInterval(statusCheckInterval);
      statusCheckInterval = null;
    }
  }

  function toggleWidget() {
    isOpen = !isOpen;
    const panel = document.getElementById('embellics-widget-panel');
    if (isOpen) {
      panel.classList.add('open');
      document.getElementById('embellics-widget-input').focus();
    } else {
      panel.classList.remove('open');
    }
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
      return;
    }

    const widget = createWidgetHTML();
    document.body.appendChild(widget);

    const button = document.getElementById('embellics-widget-button');
    const closeButton = document.getElementById('embellics-widget-close');
    const input = document.getElementById('embellics-widget-input');
    const sendButton = document.getElementById('embellics-widget-send');
    const actionsButton = document.getElementById('embellics-widget-actions-btn');
    const actionsMenu = document.getElementById('embellics-widget-actions-menu');
    const menuHandoffButton = document.getElementById('embellics-menu-handoff');
    const menuEndChatButton = document.getElementById('embellics-menu-end-chat');
    const modalCancelButton = document.getElementById('embellics-modal-cancel');
    const modalConfirmButton = document.getElementById('embellics-modal-confirm');
    const modal = document.getElementById('embellics-end-chat-modal');

    if (button) button.addEventListener('click', toggleWidget);
    if (closeButton) closeButton.addEventListener('click', toggleWidget);
    if (sendButton) sendButton.addEventListener('click', sendMessage);
    if (actionsButton) actionsButton.addEventListener('click', toggleActionsMenu);

    if (menuHandoffButton) {
      menuHandoffButton.addEventListener('click', () => {
        hideActionsMenu();
        requestHandoff();
      });
    }

    if (menuEndChatButton) {
      menuEndChatButton.addEventListener('click', () => {
        hideActionsMenu();
        endChat();
      });
    }

    if (modalCancelButton) modalCancelButton.addEventListener('click', hideEndChatModal);
    if (modalConfirmButton) modalConfirmButton.addEventListener('click', confirmEndChat);

    // Close modal when clicking outside
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          hideEndChatModal();
        }
      });
    }

    // Close actions menu when clicking outside
    document.addEventListener('click', (e) => {
      if (actionsMenu && actionsMenu.classList.contains('show')) {
        if (!actionsMenu.contains(e.target) && !actionsButton.contains(e.target)) {
          hideActionsMenu();
        }
      }
    });
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }

    initializeWidget();
  }

  init();

  window.EmbellicsWidget = {
    open: () => {
      if (!isOpen) toggleWidget();
    },
    close: () => {
      if (isOpen) toggleWidget();
    },
    toggle: toggleWidget,
    isOpen: () => isOpen,
    requestHandoff: requestHandoff,
    submitAfterHoursHandoff: submitAfterHoursHandoff,
    endChat: endChat,
  };
})();

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

  function createWidgetHTML() {
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'embellics-widget-container';
    widgetContainer.innerHTML = `
      <style>
        #embellics-widget-container { position: fixed; bottom: 20px; right: 20px; z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
        #embellics-widget-button { width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); display: flex; align-items: center; justify-content: center; transition: transform 0.2s, box-shadow 0.2s; }
        #embellics-widget-button:hover { transform: scale(1.05); box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2); }
        #embellics-widget-button svg { width: 28px; height: 28px; fill: white; }
        #embellics-widget-panel { position: fixed; bottom: 90px; right: 20px; width: 380px; height: 600px; max-height: calc(100vh - 120px); border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12); background: white; display: none; flex-direction: column; overflow: hidden; transition: opacity 0.2s, transform 0.2s; opacity: 0; transform: translateY(10px); }
        #embellics-widget-panel.open { display: flex; opacity: 1; transform: translateY(0); }
        #embellics-widget-header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px; display: flex; justify-content: space-between; align-items: center; }
        #embellics-widget-title { font-weight: 600; font-size: 16px; margin: 0; }
        #embellics-widget-close { background: none; border: none; color: white; cursor: pointer; font-size: 24px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background 0.2s; }
        #embellics-widget-close:hover { background: rgba(255, 255, 255, 0.1); }
        #embellics-widget-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px; background: #f9fafb; }
        .embellics-message { max-width: 80%; padding: 12px 16px; border-radius: 12px; font-size: 14px; line-height: 1.5; word-wrap: break-word; }
        .embellics-message.user { align-self: flex-end; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-bottom-right-radius: 4px; }
        .embellics-message.assistant { align-self: flex-start; background: white; color: #374151; border: 1px solid #e5e7eb; border-bottom-left-radius: 4px; }
        .embellics-message.system { align-self: center; background: #f3f4f6; color: #6b7280; font-size: 12px; padding: 8px 12px; }
        .embellics-typing { display: none; align-self: flex-start; background: white; color: #6b7280; border: 1px solid #e5e7eb; padding: 12px 16px; border-radius: 12px; font-size: 14px; }
        .embellics-typing.show { display: block; }
        #embellics-widget-input-container { padding: 16px; border-top: 1px solid #e5e7eb; display: flex; gap: 8px; background: white; }
        #embellics-widget-input { flex: 1; padding: 12px 16px; border: 1px solid #d1d5db; border-radius: 24px; font-size: 14px; outline: none; font-family: inherit; }
        #embellics-widget-input:focus { border-color: #667eea; }
        #embellics-widget-send { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.2s; }
        #embellics-widget-send:hover { transform: scale(1.05); }
        #embellics-widget-send:disabled { opacity: 0.5; cursor: not-allowed; }
        #embellics-widget-error { color: #ef4444; font-size: 12px; padding: 12px 16px; background: #fee2e2; border-top: 1px solid #fecaca; text-align: center; display: none; }
        #embellics-widget-error.show { display: block; }
        @media (max-width: 480px) {
          #embellics-widget-panel { width: calc(100vw - 40px); right: 20px; }
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
        </div>
      </div>
    `;
    return widgetContainer;
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

      if (widgetConfig.primaryColor) {
        const button = document.getElementById('embellics-widget-button');
        const header = document.getElementById('embellics-widget-header');
        if (button) button.style.background = widgetConfig.primaryColor;
        if (header) header.style.background = widgetConfig.primaryColor;
      }

      if (widgetConfig.greeting) {
        const title = document.getElementById('embellics-widget-title');
        if (title) title.textContent = widgetConfig.greeting;
        addMessage('system', widgetConfig.greeting);
      }
    } catch (error) {
      console.error('[Embellics Widget] Init failed:', error);
      showError('Failed to initialize chat widget');
    }
  }

  function addMessage(role, content) {
    const messagesContainer = document.getElementById('embellics-widget-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `embellics-message ${role}`;
    messageDiv.textContent = content;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    messages.push({ role, content });
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
    showTyping(true);

    try {
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

      showTyping(false);

      if (data.response) {
        addMessage('assistant', data.response);
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

    if (button) button.addEventListener('click', toggleWidget);
    if (closeButton) closeButton.addEventListener('click', toggleWidget);
    if (sendButton) sendButton.addEventListener('click', sendMessage);
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
  };
})();

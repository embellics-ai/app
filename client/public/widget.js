/**
 * Embellics Chat Widget (Powered by Retell AI)
 * Embeddable text chat widget for external websites
 * Version: 2.0.0-channel-selection
 */

(function () {
  'use strict';

  console.log('[Embellics Widget] Version 2.0.0-channel-selection loaded');

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
  let inactivityTimer = null;
  const INACTIVITY_TIMEOUT = 300000;

  // LocalStorage keys for persistence (only store IDs, not messages)
  const STORAGE_KEYS = {
    CHAT_ID: 'embellics_chat_id',
    HANDOFF_ID: 'embellics_handoff_id',
    HANDOFF_STATUS: 'embellics_handoff_status',
  };

  function createWidgetHTML() {
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'embellics-widget-container';
    // Hide widget until fully loaded with styles and positioning
    widgetContainer.style.opacity = '0';
    widgetContainer.style.visibility = 'hidden';
    widgetContainer.innerHTML = `
      <style>
        /* Using application's design system - matching Tailwind config and index.css */
        #embellics-widget-container { position: fixed; z-index: 999999; font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; transition: opacity 0.3s ease, visibility 0.3s ease; }
        #embellics-widget-button { width: 60px; height: 60px; border-radius: 50%; background: hsl(262, 75%, 65%); border: none; cursor: pointer; box-shadow: 0 8px 24px hsla(262, 75%, 65%, 0.4); display: flex; align-items: center; justify-content: center; transition: transform 0.2s, box-shadow 0.3s; }
        #embellics-widget-button:hover { transform: scale(1.08); box-shadow: 0 12px 32px hsla(262, 75%, 65%, 0.5); }
        #embellics-widget-button svg { width: 28px; height: 28px; fill: white; }
        #embellics-widget-panel { position: fixed; width: 380px; height: 600px; max-width: calc(100vw - 20px); max-height: calc(100vh - 100px); border-radius: 0.75rem; box-shadow: 0 12px 48px hsla(262, 75%, 65%, 0.2), 0 0 0 1px hsla(262, 75%, 65%, 0.1); background: hsl(0, 0%, 100%); display: none; flex-direction: column; overflow: hidden; transition: opacity 0.3s, transform 0.3s; opacity: 0; transform: translateY(10px); }
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
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        
        .embellics-handoff-notice { background: hsl(199, 89%, 92%); color: hsl(199, 89%, 32%); padding: 12px; border-radius: 0.75rem; font-size: 13px; margin: 8px 0; text-align: center; border: 1px solid hsl(199, 89%, 85%); }
        #embellics-widget-error { color: hsl(0, 72%, 42%); font-size: 12px; padding: 12px 16px; background: hsl(0, 72%, 98%); border-top: 1px solid hsl(0, 72%, 90%); text-align: center; display: none; }
        #embellics-widget-error.show { display: block; }
        .embellics-email-form { background: hsl(0, 0%, 98%); padding: 16px; border-radius: 0.75rem; margin: 8px 0; border: 1px solid hsl(0, 0%, 94%); }
        .embellics-email-form input { width: 100%; padding: 10px; border: 1px solid hsl(262, 15%, 85%); border-radius: 0.375rem; font-size: 14px; margin: 8px 0; box-sizing: border-box; background: hsl(0, 0%, 100%); color: hsl(0, 0%, 9%); }
        .embellics-email-form textarea { width: 100%; padding: 10px; border: 1px solid hsl(262, 15%, 85%); border-radius: 0.375rem; font-size: 14px; margin: 8px 0; resize: vertical; min-height: 60px; box-sizing: border-box; font-family: inherit; background: hsl(0, 0%, 100%); color: hsl(0, 0%, 9%); }
        .embellics-email-form button { width: 100%; padding: 12px; background: hsl(262, 75%, 65%); color: hsl(262, 75%, 98%); border: none; border-radius: 0.5625rem; font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: 0 4px 12px hsla(262, 75%, 65%, 0.3); transition: transform 0.2s, box-shadow 0.2s; }
        .embellics-email-form button:hover { transform: translateY(-1px); box-shadow: 0 6px 16px hsla(262, 75%, 65%, 0.4); }
        
        /* Contact Details Form */
        .embellics-contact-form { background: hsl(0, 0%, 98%); padding: 16px; border-radius: 0.75rem; margin: 8px 0; border: 1px solid hsl(0, 0%, 94%); align-self: flex-start; max-width: 85%; }
        .embellics-contact-form-title { font-size: 14px; font-weight: 600; color: hsl(262, 75%, 40%); margin: 0 0 12px 0; }
        .embellics-contact-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
        .embellics-contact-form input { width: 100%; padding: 10px 12px; border: 1px solid hsl(262, 15%, 85%); border-radius: 0.5rem; font-size: 14px; box-sizing: border-box; background: hsl(0, 0%, 100%); color: hsl(0, 0%, 9%); font-family: inherit; transition: border-color 0.2s, box-shadow 0.2s; }
        .embellics-contact-form input:focus { outline: none; border-color: hsl(262, 75%, 65%); box-shadow: 0 0 0 3px hsla(262, 75%, 65%, 0.1); }
        .embellics-contact-form input.error { border-color: hsl(0, 72%, 50%); }
        .embellics-contact-form input::placeholder { color: hsl(262, 10%, 60%); }
        .embellics-contact-form-full { grid-column: 1 / -1; }
        .embellics-contact-form-error { font-size: 12px; color: hsl(0, 72%, 42%); margin-top: 4px; display: none; }
        .embellics-contact-form-error.show { display: block; }
        .embellics-contact-form button { width: 100%; padding: 12px; background: hsl(262, 75%, 65%); color: hsl(262, 75%, 98%); border: none; border-radius: 0.5625rem; font-size: 14px; font-weight: 500; cursor: pointer; box-shadow: 0 4px 12px hsla(262, 75%, 65%, 0.3); transition: transform 0.2s, box-shadow 0.2s; margin-top: 8px; }
        .embellics-contact-form button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 16px hsla(262, 75%, 65%, 0.4); }
        .embellics-contact-form button:disabled { opacity: 0.5; cursor: not-allowed; }
        @media (max-width: 480px) { .embellics-contact-form-row { grid-template-columns: 1fr; } .embellics-contact-form { max-width: 95%; } }
        
        /* Animations */
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes optionFadeIn { 
          from { 
            opacity: 0; 
            transform: translateX(-10px); 
          } 
          to { 
            opacity: 1; 
            transform: translateX(0); 
          } 
        }
        
        /* Interactive Option Buttons with Animation */
        .embellics-options-container { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; max-width: 80%; align-self: flex-start; }
        .embellics-option-button { 
          padding: 10px 16px; 
          background: hsl(0, 0%, 100%); 
          color: hsl(262, 75%, 65%); 
          border: 2px solid hsl(262, 75%, 65%); 
          border-radius: 0.75rem; 
          font-size: 14px; 
          font-weight: 500; 
          cursor: pointer; 
          transition: all 0.2s; 
          text-align: left; 
          box-shadow: 0 2px 8px hsla(262, 75%, 65%, 0.15); 
          opacity: 0;
          animation: optionFadeIn 0.4s ease-out forwards;
        }
        .embellics-option-button:hover:not(:disabled) { background: hsl(262, 75%, 65%); color: hsl(262, 75%, 98%); transform: translateX(4px); box-shadow: 0 4px 12px hsla(262, 75%, 65%, 0.3); }
        .embellics-option-button:disabled { cursor: not-allowed; }
        .embellics-option-button:active { transform: scale(0.98); }
        
        /* Channel Selection Modal */
        .embellics-channel-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); z-index: 9999999; align-items: center; justify-content: center; backdrop-filter: blur(4px); }
        .embellics-channel-modal.show { display: flex; animation: fadeIn 0.3s ease-out; }
        .embellics-channel-content { background: hsl(0, 0%, 100%); border-radius: 1.5rem; padding: 32px 24px; max-width: 360px; width: calc(100% - 40px); box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2); text-align: center; animation: slideUp 0.4s ease-out; }
        .embellics-channel-title { font-size: 20px; font-weight: 600; color: hsl(262, 75%, 40%); margin: 0 0 8px 0; }
        .embellics-channel-subtitle { font-size: 14px; color: hsl(0, 0%, 40%); margin: 0 0 24px 0; line-height: 1.5; }
        .embellics-channel-buttons { display: flex; flex-direction: column; gap: 12px; }
        .embellics-channel-btn { padding: 16px 24px; border-radius: 0.75rem; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; border: none; display: flex; align-items: center; justify-content: center; gap: 10px; }
        .embellics-channel-btn-whatsapp { background: #25D366; color: white; box-shadow: 0 4px 12px rgba(37, 211, 102, 0.3); }
        .embellics-channel-btn-whatsapp:hover { background: #20BA5A; box-shadow: 0 6px 16px rgba(37, 211, 102, 0.4); transform: translateY(-2px); }
        .embellics-channel-btn-web { background: hsl(262, 75%, 65%); color: white; box-shadow: 0 4px 12px hsla(262, 75%, 65%, 0.3); }
        .embellics-channel-btn-web:hover { background: hsl(262, 75%, 55%); box-shadow: 0 6px 16px hsla(262, 75%, 65%, 0.4); transform: translateY(-2px); }
        .embellics-channel-icon { width: 24px; height: 24px; }
        
        /* Mobile Responsiveness */
        @media (max-width: 768px) {
          #embellics-widget-panel { 
            width: calc(100vw - 20px) !important; 
            height: calc(100vh - 80px) !important;
            max-height: calc(100vh - 80px) !important;
            border-radius: 0.75rem; 
          }
          #embellics-widget-button { 
            width: 56px; 
            height: 56px; 
          }
          #embellics-widget-button svg { 
            width: 26px; 
            height: 26px; 
          }
          .embellics-message { 
            max-width: 85%; 
            font-size: 13px; 
          }
          .embellics-options-container { 
            max-width: 90%; 
          }
          .embellics-contact-form { 
            max-width: 95%; 
          }
        }
        
        @media (max-width: 480px) {
          #embellics-widget-panel { 
            width: calc(100vw - 16px) !important; 
            height: calc(100vh - 70px) !important;
            max-height: calc(100vh - 70px) !important;
          }
          #embellics-widget-messages { 
            padding: 16px; 
          }
          #embellics-widget-header { 
            padding: 16px; 
          }
          #embellics-widget-input-container { 
            padding: 12px; 
          }
          #embellics-widget-input { 
            font-size: 16px; /* Prevents zoom on iOS */
          }
          .embellics-contact-form-row { 
            grid-template-columns: 1fr; 
          }
          .embellics-contact-form { 
            max-width: 100%; 
            padding: 12px; 
          }
          .embellics-modal-content { 
            padding: 20px; 
          }
          .embellics-modal-actions { 
            flex-direction: column-reverse; 
          }
          .embellics-modal-btn { 
            width: 100%; 
          }
        }
      </style>
      <button id="embellics-widget-button" aria-label="Open chat">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
      </button>
      <div id="embellics-widget-panel">
        <div id="embellics-widget-header">
          <h3 id="embellics-widget-title">Let's Chat</h3>
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
      
      <!-- Channel Selection Modal -->
      <div id="embellics-channel-modal" class="embellics-channel-modal">
        <div class="embellics-channel-content">
          <h3 class="embellics-channel-title">Choose Your Chat Channel</h3>
          <p class="embellics-channel-subtitle">Continue this conversation on your preferred platform</p>
          <div class="embellics-channel-buttons">
            <button class="embellics-channel-btn embellics-channel-btn-whatsapp" id="embellics-channel-whatsapp">
              <svg class="embellics-channel-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Continue on WhatsApp
            </button>
            <button class="embellics-channel-btn embellics-channel-btn-web" id="embellics-channel-web">
              <svg class="embellics-channel-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
              </svg>
              Continue Here
            </button>
          </div>
        </div>
      </div>
    `;
    return widgetContainer;
  }

  // Apply dynamic theme colors from widget configuration
  function applyWidgetTheme() {
    if (!widgetConfig) return;

    const primaryColor = widgetConfig.primaryColor || '#9b7ddd';
    const textColor = widgetConfig.textColor || '#ffffff';
    const borderRadius = widgetConfig.borderRadius || '12px';

    // Create a style element with CSS custom properties
    const styleEl = document.createElement('style');
    styleEl.id = 'embellics-widget-theme';

    // Convert hex to HSL for consistent theming with transparency
    const hexToHSL = (hex) => {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h,
        s,
        l = (max + min) / 2;

      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r:
            h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
            break;
          case g:
            h = ((b - r) / d + 2) / 6;
            break;
          case b:
            h = ((r - g) / d + 4) / 6;
            break;
        }
      }

      return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
      };
    };

    const hsl = hexToHSL(primaryColor);

    styleEl.textContent = `
      #embellics-widget-button {
        background: ${primaryColor} !important;
        box-shadow: 0 8px 24px ${primaryColor}66 !important;
      }
      #embellics-widget-button:hover {
        box-shadow: 0 12px 32px ${primaryColor}80 !important;
      }
      #embellics-widget-button svg {
        fill: ${textColor} !important;
      }
      #embellics-widget-panel {
        border-radius: ${borderRadius} !important;
        box-shadow: 0 12px 48px ${primaryColor}33, 0 0 0 1px ${primaryColor}1a !important;
      }
      #embellics-widget-header {
        background: ${primaryColor} !important;
        color: ${textColor} !important;
      }
      #embellics-widget-close {
        color: ${textColor} !important;
      }
      .embellics-message.user {
        background: ${primaryColor} !important;
        color: ${textColor} !important;
        box-shadow: 0 4px 12px ${primaryColor}4d !important;
        border-radius: ${borderRadius} !important;
      }
      .embellics-message.assistant {
        border-radius: ${borderRadius} !important;
      }
      .embellics-message.system {
        background: hsl(${hsl.h}, ${hsl.s}%, 97%) !important;
        color: ${primaryColor} !important;
        border-color: hsl(${hsl.h}, ${hsl.s}%, 90%) !important;
        border-radius: ${borderRadius} !important;
      }
      #embellics-widget-input:focus {
        border-color: ${primaryColor} !important;
        box-shadow: 0 0 0 3px ${primaryColor}1a !important;
      }
      #embellics-widget-send {
        background: ${primaryColor} !important;
        color: ${textColor} !important;
        box-shadow: 0 4px 12px ${primaryColor}4d !important;
      }
      #embellics-widget-send:hover {
        box-shadow: 0 6px 16px ${primaryColor}66 !important;
      }
      .embellics-option-button {
        border-color: ${primaryColor} !important;
        color: ${primaryColor} !important;
        box-shadow: 0 2px 8px ${primaryColor}26 !important;
        border-radius: ${borderRadius} !important;
      }
      .embellics-option-button:hover:not(:disabled) {
        background: ${primaryColor} !important;
        color: ${textColor} !important;
        box-shadow: 0 4px 12px ${primaryColor}4d !important;
      }
      .embellics-email-form button,
      .embellics-contact-form button {
        background: ${primaryColor} !important;
        color: ${textColor} !important;
        box-shadow: 0 4px 12px ${primaryColor}4d !important;
        border-radius: calc(${borderRadius} - 3px) !important;
      }
      .embellics-email-form button:hover,
      .embellics-contact-form button:hover:not(:disabled) {
        box-shadow: 0 6px 16px ${primaryColor}66 !important;
      }
      .embellics-contact-form input:focus {
        border-color: ${primaryColor} !important;
        box-shadow: 0 0 0 3px ${primaryColor}1a !important;
      }
      .embellics-contact-form-title {
        color: ${primaryColor} !important;
      }
      #embellics-widget-input {
        border-radius: calc(${borderRadius} * 2) !important;
      }
      #embellics-widget-send,
      #embellics-widget-actions-btn {
        border-radius: 50% !important;
      }
      .embellics-email-form,
      .embellics-contact-form {
        border-radius: ${borderRadius} !important;
      }
      .embellics-modal-content {
        border-radius: ${borderRadius} !important;
      }
      .embellics-modal-btn-confirm {
        background: hsl(0, 72%, 42%) !important;
        color: hsl(0, 72%, 98%) !important;
        border-radius: calc(${borderRadius} - 3px) !important;
      }
      .embellics-modal-btn-cancel {
        border-radius: calc(${borderRadius} - 3px) !important;
      }
    `;

    document.head.appendChild(styleEl);
  }

  // Apply dynamic widget positioning
  function applyWidgetPosition() {
    if (!widgetConfig) return;

    const position = widgetConfig.position || 'bottom-right';
    const container = document.getElementById('embellics-widget-container');
    const panel = document.getElementById('embellics-widget-panel');

    if (!container || !panel) return;

    // Check if mobile device
    const isMobile = window.innerWidth <= 768;
    const margin = isMobile ? '10px' : '20px';

    // Remove all positioning styles first
    container.style.top = '';
    container.style.right = '';
    container.style.bottom = '';
    container.style.left = '';
    container.style.transform = '';

    panel.style.top = '';
    panel.style.right = '';
    panel.style.bottom = '';
    panel.style.left = '';
    panel.style.transform = '';

    // Apply positioning based on config
    const positions = {
      'top-left': {
        container: { top: margin, left: margin },
        panel: { top: margin, left: margin },
      },
      'top-center': {
        container: { top: margin, left: '50%', transform: 'translateX(-50%)' },
        panel: { top: margin, left: '50%', transform: 'translateX(-50%)' },
      },
      'top-right': {
        container: { top: margin, right: margin },
        panel: { top: margin, right: margin },
      },
      'middle-left': {
        container: { top: '50%', left: margin, transform: 'translateY(-50%)' },
        panel: { top: '50%', left: margin, transform: 'translateY(-50%)' },
      },
      'middle-right': {
        container: { top: '50%', right: margin, transform: 'translateY(-50%)' },
        panel: { top: '50%', right: margin, transform: 'translateY(-50%)' },
      },
      'bottom-left': {
        container: { bottom: margin, left: margin },
        panel: { bottom: margin, left: margin },
      },
      'bottom-center': {
        container: { bottom: margin, left: '50%', transform: 'translateX(-50%)' },
        panel: { bottom: margin, left: '50%', transform: 'translateX(-50%)' },
      },
      'bottom-right': {
        container: { bottom: margin, right: margin },
        panel: { bottom: margin, right: margin },
      },
    };

    const config = positions[position] || positions['bottom-right'];

    // Apply container positioning
    Object.assign(container.style, config.container);

    // Apply panel positioning
    Object.assign(panel.style, config.panel);

    // Show widget now that positioning is applied
    // Use requestAnimationFrame to ensure styles are applied before showing
    requestAnimationFrame(() => {
      container.style.opacity = '1';
      container.style.visibility = 'visible';
    });
  }

  // Apply widget title from greeting
  function applyWidgetTitle() {
    if (!widgetConfig) return;

    const titleElement = document.getElementById('embellics-widget-title');
    if (!titleElement) return;

    // Use greeting as title if available, otherwise use default
    const title =
      widgetConfig.greeting && widgetConfig.greeting.trim() ? widgetConfig.greeting : "Let's Chat";

    titleElement.textContent = title;
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
      // Stop inactivity timer when clearing session
      stopInactivityTimer();

      localStorage.removeItem(STORAGE_KEYS.CHAT_ID);
      localStorage.removeItem(STORAGE_KEYS.HANDOFF_ID);
      localStorage.removeItem(STORAGE_KEYS.HANDOFF_STATUS);
      chatId = null;
      handoffId = null;
      handoffStatus = 'none';
      messages = [];
      displayedMessageIds.clear();
    } catch (error) {
      console.error('[Embellics Widget] Failed to clear session state:', error);
    }
  }

  // Check if user is on mobile device
  function isMobileDevice() {
    // Check for test override via URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('forceMobile') === 'true') {
      return true;
    }

    const width =
      window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    const isMobileWidth = width <= 768;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

    // Return true if mobile width OR (touch device AND mobile user agent)
    return isMobileWidth || (isTouchDevice && isMobileUserAgent);
  }

  // Redirect to WhatsApp
  function redirectToWhatsApp() {
    if (!widgetConfig || !widgetConfig.whatsappAvailable || !widgetConfig.whatsappPhoneNumber) {
      console.error('[Embellics Widget] WhatsApp not available');
      return;
    }

    const phoneNumber = widgetConfig.whatsappPhoneNumber.replace(/\s+/g, '');
    const greeting = encodeURIComponent(widgetConfig.greeting || 'Hello! I would like to chat.');
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${greeting}`;

    window.open(whatsappUrl, '_blank');

    // Close the widget after redirect
    hideChannelSelectionModal();
    toggleWidget();
  }

  // Show channel selection modal
  function showChannelSelectionModal() {
    const modal = document.getElementById('embellics-channel-modal');
    if (!modal) return;

    modal.classList.add('show');
  }

  // Hide channel selection modal
  function hideChannelSelectionModal() {
    const modal = document.getElementById('embellics-channel-modal');
    if (!modal) return;

    modal.classList.remove('show');
  }

  // Inactivity timer functions
  function startInactivityTimer() {
    // Clear any existing timer first
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
    }

    // Only start timer if we have an active chat AND widget is open
    if (!chatId || !isOpen) {
      return;
    }

    inactivityTimer = setTimeout(() => {
      confirmEndChat();
    }, INACTIVITY_TIMEOUT);
  }

  function resetInactivityTimer() {
    // Only reset if a timer is already running
    if (!inactivityTimer) {
      return;
    }

    // Clear the current timer and start a new one
    clearTimeout(inactivityTimer);
    startInactivityTimer();
  }

  function stopInactivityTimer() {
    if (inactivityTimer) {
      clearTimeout(inactivityTimer);
      inactivityTimer = null;
    }
  }

  // Auto-start conversation when widget opens
  async function autoStartConversation() {
    try {
      // Send an initial message to start the conversation (waving hand for better UX)
      const response = await fetch(`${WIDGET_API_BASE}/api/widget/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: API_KEY,
          message: '👋',
          referrer: window.location.host,
        }),
      });

      if (!response.ok) {
        console.error('[Embellics Widget] Failed to auto-start:', response.status);
        return;
      }

      const data = await response.json();

      // Save chatId from response
      if (data.chatId) {
        chatId = data.chatId;
        saveSessionState();
        // Timer will be started by toggleWidget when widget opens
      }

      // Display assistant messages
      if (data.messages && data.messages.length > 0) {
        await displayMessagesSequentially(data.messages);
      }
    } catch (error) {
      console.error('[Embellics Widget] Error auto-starting conversation:', error);
    }
  }

  // Load chat history from API for restored session
  async function loadChatHistory() {
    if (!chatId) return;

    try {
      const url = new URL(`${WIDGET_API_BASE}/api/widget/session/${chatId}/history`);
      url.searchParams.append('apiKey', API_KEY);
      url.searchParams.append('referrer', window.location.host);
      if (handoffId) {
        url.searchParams.append('handoffId', handoffId);
      }

      const response = await fetch(url);
      if (!response.ok) {
        console.error('[Embellics Widget] Failed to load history:', response.status);

        // If chat ended (400) or not found (404), clear and start fresh
        if (response.status === 400 || response.status === 404 || response.status === 500) {
          clearSessionState();
          const messagesContainer = document.getElementById('embellics-widget-messages');
          messagesContainer.innerHTML = '';

          // Check if we should show channel selection or auto-start
          const shouldShowChannelSelection =
            isMobileDevice() &&
            widgetConfig?.whatsappAvailable &&
            widgetConfig?.whatsappPhoneNumber;

          if (!shouldShowChannelSelection) {
            // Desktop or no WhatsApp - auto-start conversation
            await autoStartConversation();
          }
          // If shouldShowChannelSelection is true, wait for user to choose in toggleWidget
          return;
        }
      }

      const data = await response.json();

      // Check if the response indicates chat has ended
      if (data.chatEnded || data.error) {
        clearSessionState();
        const messagesContainer = document.getElementById('embellics-widget-messages');
        messagesContainer.innerHTML = '';

        // Check if we should show channel selection or auto-start
        const shouldShowChannelSelection =
          isMobileDevice() && widgetConfig?.whatsappAvailable && widgetConfig?.whatsappPhoneNumber;

        if (!shouldShowChannelSelection) {
          // Desktop or no WhatsApp - auto-start conversation
          await autoStartConversation();
        }
        // If shouldShowChannelSelection is true, wait for user to choose in toggleWidget
        return;
      }

      // Chat history loaded successfully - display the history

      // Clear message container
      const messagesContainer = document.getElementById('embellics-widget-messages');
      messagesContainer.innerHTML = '';

      // Clear displayed messages tracker
      displayedMessageIds.clear();

      // Display all messages from history
      if (data.messages && data.messages.length > 0) {
        data.messages.forEach((msg, index) => {
          // Track message ID to prevent duplicates
          if (msg.id) {
            displayedMessageIds.add(msg.id);
          }

          // Check if this is the last message
          const isLastMessage = index === data.messages.length - 1;

          // Display message based on role
          if (msg.role === 'user') {
            addMessageToUI('user', msg.content, null, true); // true = isHistorical
          } else if (msg.role === 'assistant' || msg.role === 'agent') {
            // Skip special trigger messages like SHOW_CONTACT_FORM (they should trigger forms, not display)
            if (msg.content.trim() === 'SHOW_CONTACT_FORM') {
              // When loading from history, don't show the form again (already completed)
              // Just display a message indicating the form was shown
              addMessageToUI('system', 'Contact form was requested', null, true);
              return; // Don't display the trigger text or show form
            }

            // Try to parse JSON format for assistant messages from history
            let responseText = msg.content;
            let responseOptions = null;

            try {
              const parsed = JSON.parse(msg.content);
              if (parsed.message && parsed.options) {
                responseText = parsed.message;
                responseOptions = parsed.options;
              }
            } catch (e) {
              // Not JSON, use as plain text
            }

            // Only mark as historical if it's NOT the last message
            // The last message should remain interactive so user can click options after refresh
            addMessageToUI('assistant', responseText, responseOptions, !isLastMessage);
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
        body: JSON.stringify({ apiKey: API_KEY, referrer: window.location.host }),
      });
      if (!response.ok) throw new Error(`Failed to initialize: ${response.status}`);
      widgetConfig = await response.json();
      isInitialized = true;

      // Apply dynamic theming based on widget configuration
      applyWidgetTheme();

      // Apply dynamic positioning based on widget configuration
      applyWidgetPosition();

      // Apply widget title from greeting
      applyWidgetTitle();

      // Restore existing session if available
      const hasRestoredSession = restoreSessionState();

      if (hasRestoredSession && chatId) {
        // Try to load conversation history
        // If chat ended, loadChatHistory will clear and auto-start new conversation
        await loadChatHistory();
      } else {
        // New session - check if we should show channel selection or auto-start
        // Don't auto-start if mobile + WhatsApp available (wait for user to choose channel)
        const shouldShowChannelSelection =
          isMobileDevice() && widgetConfig?.whatsappAvailable && widgetConfig?.whatsappPhoneNumber;

        if (!shouldShowChannelSelection) {
          // Desktop or no WhatsApp - auto-start (Retell will send the greeting)
          await autoStartConversation();
        }
        // If shouldShowChannelSelection is true, we wait for toggleWidget to show the modal
      }
    } catch (error) {
      console.error('[Embellics Widget] Init failed:', error);
      showError('Failed to initialize chat widget');
    }
  } // Add message to UI only (for displaying history)
  function addMessageToUI(role, content, options = null, isHistorical = false) {
    // Don't display empty messages (but allow them if options are provided)
    if (!content && (!options || options.length === 0)) {
      return;
    }

    const messagesContainer = document.getElementById('embellics-widget-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `embellics-message ${role}`;
    messageDiv.textContent = content;

    // Hide message div if content is empty but options exist
    if (!content && options && options.length > 0) {
      messageDiv.style.display = 'none';
    }

    messagesContainer.appendChild(messageDiv);

    // If options are provided, render interactive buttons
    if (options && Array.isArray(options) && options.length > 0) {
      const optionsContainer = document.createElement('div');
      optionsContainer.className = 'embellics-options-container';

      options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'embellics-option-button';
        button.textContent = option.label || option.text || option;
        button.dataset.value = option.value || option.id || option.label || option;

        // Add staggered animation delay for each button
        button.style.animationDelay = `${index * 0.1}s`;

        // Disable historical options (already selected in past sessions)
        if (isHistorical) {
          button.disabled = true;
          button.style.opacity = '0.6';
          button.style.cursor = 'not-allowed';
        } else {
          button.onclick = function () {
            // Get theme colors from widget config
            const primaryColor = widgetConfig?.primaryColor || '#9b7ddd';
            const textColor = widgetConfig?.textColor || '#ffffff';

            // Disable all option buttons after one is clicked
            optionsContainer.querySelectorAll('.embellics-option-button').forEach((btn) => {
              btn.disabled = true;
              btn.style.opacity = '0.5';
              // Reset non-selected buttons to default style
              btn.style.background = '';
              btn.style.color = '';
            });

            // Highlight the selected button with theme colors
            button.style.opacity = '1';
            button.style.background = `${primaryColor} !important`;
            button.style.color = `${textColor} !important`;
            button.style.borderColor = `${primaryColor} !important`;

            // Send the selected option as user message
            const selectedValue = button.dataset.value;
            handleOptionClick(selectedValue);
          };
        }

        optionsContainer.appendChild(button);
      });

      messagesContainer.appendChild(optionsContainer);
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Add message to UI and track in messages array (for new messages)
  function addMessage(role, content, options = null) {
    addMessageToUI(role, content, options);

    // Track user and assistant messages
    if (role === 'user' || role === 'assistant') {
      messages.push({ role, content, options });
    }
  }

  // Handle option button click
  async function handleOptionClick(selectedValue) {
    // Start or reset inactivity timer on option selection (first interaction starts it)
    if (!inactivityTimer) {
      startInactivityTimer();
    } else {
      resetInactivityTimer();
    }

    // Show the selection as a user message
    addMessage('user', selectedValue);

    // Disable input while processing
    const input = document.getElementById('embellics-widget-input');
    const sendBtn = document.getElementById('embellics-widget-send');
    input.disabled = true;
    sendBtn.disabled = true;

    try {
      // If in handoff mode with active agent, send to handoff endpoint
      if (handoffStatus === 'active' && handoffId) {
        const response = await fetch(`${WIDGET_API_BASE}/api/widget/handoff/${handoffId}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: API_KEY,
            message: selectedValue,
            referrer: window.location.host,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to send selection to agent');
        }
      } else {
        // Normal AI chat flow
        showTyping(true);

        const response = await fetch(`${WIDGET_API_BASE}/api/widget/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: API_KEY,
            chatId: chatId,
            message: selectedValue,
            referrer: window.location.host,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.message || errorData.error || 'Failed to send selection';

          // Check if error indicates chat has ended
          if (
            response.status === 400 ||
            response.status === 404 ||
            (response.status === 500 && errorMsg.includes('chat'))
          ) {
            throw new Error(`CHAT_ENDED: ${errorMsg}`);
          }

          throw new Error(errorMsg);
        }

        const data = await response.json();

        showTyping(false);

        // Check if first message is a trigger for contact form
        if (data.messages && data.messages.length > 0) {
          const firstMessage = data.messages[0];

          if (firstMessage.trim() === 'SHOW_CONTACT_FORM') {
            // Show contact form and handle submission
            showContactForm(async (contactData) => {
              // Send contact data back to agent as JSON
              const contactDetails = {
                first_name: contactData.firstName,
                last_name: contactData.lastName,
                email: contactData.email,
                phone: contactData.phone,
              };
              const contactMessage = JSON.stringify(contactDetails);

              try {
                const followupResponse = await fetch(`${WIDGET_API_BASE}/api/widget/chat`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    apiKey: API_KEY,
                    chatId: chatId,
                    message: contactMessage,
                    referrer: window.location.host,
                  }),
                });

                if (followupResponse.ok) {
                  const followupData = await followupResponse.json();
                  if (followupData.messages && followupData.messages.length > 0) {
                    // Display messages sequentially with delays
                    await displayMessagesSequentially(followupData.messages);
                  }
                }
              } catch (error) {
                console.error('[Embellics Widget] Failed to send contact data:', error);
                showError('Failed to submit contact details. Please try again.');
              }
            });

            if (data.chatId) {
              chatId = data.chatId;
              saveSessionState();
            }

            return; // Don't show the trigger text
          }

          // Display all messages sequentially with delays
          await displayMessagesSequentially(data.messages);
        }

        if (data.chatId) {
          chatId = data.chatId;
          saveSessionState();

          // Enable actions menu after first message
          const actionsBtn = document.getElementById('embellics-widget-actions-btn');
          const menuHandoff = document.getElementById('embellics-menu-handoff');
          const menuEndChat = document.getElementById('embellics-menu-end-chat');

          if (actionsBtn) actionsBtn.classList.add('show');
          if (menuHandoff) menuHandoff.disabled = false;
          if (menuEndChat) menuEndChat.classList.remove('hidden');
        }
      }
    } catch (error) {
      showTyping(false);
      console.error('[Embellics Widget] Error sending selection:', error);

      // Check if error indicates chat has ended
      const errorMsg = error.message || '';
      if (
        errorMsg.startsWith('CHAT_ENDED:') ||
        errorMsg.includes('already ended') ||
        (errorMsg.includes('chat') &&
          (errorMsg.includes('ended') ||
            errorMsg.includes('session') ||
            errorMsg.includes('error')))
      ) {
        // Chat has ended - inform user and reload widget for fresh start
        console.log('[Embellics Widget] Chat already ended, informing user and reloading...');

        // Clear any error messages
        const errorDiv = document.getElementById('embellics-widget-error');
        if (errorDiv) {
          errorDiv.classList.remove('show');
          errorDiv.textContent = '';
        }

        // Clear messages UI
        const messagesContainer = document.getElementById('embellics-widget-messages');
        messagesContainer.innerHTML = '';

        // Show informative message
        addMessageToUI(
          'system',
          'Your previous chat session has ended. Starting a new conversation...',
        );

        // Clear session state
        clearSessionState();

        // Wait a moment for user to see the message, then reinitialize
        setTimeout(async () => {
          messagesContainer.innerHTML = '';
          await initializeWidget();
        }, 2000);

        return;
      }

      // For other errors, show error message
      showError('Failed to send your selection. Please try again.');
    } finally {
      input.disabled = false;
      sendBtn.disabled = false;
      input.focus();
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

  // Show contact details form
  function showContactForm(callback, isHistorical = false) {
    const messagesContainer = document.getElementById('embellics-widget-messages');

    const formContainer = document.createElement('div');
    formContainer.className = 'embellics-contact-form';

    formContainer.innerHTML = `
      <div class="embellics-contact-form-title">Please provide your contact details:</div>
      <div class="embellics-contact-form-row">
        <input type="text" id="embellics-form-firstname" placeholder="First Name *" required autocomplete="given-name" maxlength="50" ${isHistorical ? 'disabled' : ''}>
        <input type="text" id="embellics-form-lastname" placeholder="Last Name *" required autocomplete="family-name" maxlength="50" ${isHistorical ? 'disabled' : ''}>
      </div>
      <div class="embellics-contact-form-row">
        <input type="email" id="embellics-form-email" class="embellics-contact-form-full" placeholder="Email *" required autocomplete="email" maxlength="100" ${isHistorical ? 'disabled' : ''}>
      </div>
      <div class="embellics-contact-form-row">
        <input type="tel" id="embellics-form-phone" class="embellics-contact-form-full" placeholder="Phone Number (10 digits) *" required autocomplete="tel" maxlength="15" ${isHistorical ? 'disabled' : ''}>
      </div>
      <div class="embellics-contact-form-error" id="embellics-form-error"></div>
      <button type="button" id="embellics-form-submit" ${isHistorical ? 'disabled style="opacity: 0.6; cursor: not-allowed;"' : ''}>Submit Details</button>
    `;

    messagesContainer.appendChild(formContainer);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Don't focus or handle submission if historical
    if (isHistorical) {
      return;
    }

    // Focus first input
    const firstNameInput = document.getElementById('embellics-form-firstname');
    setTimeout(() => firstNameInput.focus(), 100);

    // Handle form submission
    const submitBtn = document.getElementById('embellics-form-submit');
    const errorDiv = document.getElementById('embellics-form-error');

    const handleSubmit = () => {
      const firstName = document.getElementById('embellics-form-firstname').value.trim();
      const lastName = document.getElementById('embellics-form-lastname').value.trim();
      const email = document.getElementById('embellics-form-email').value.trim();
      const phone = document.getElementById('embellics-form-phone').value.trim();

      // Validation
      errorDiv.classList.remove('show');
      let isValid = true;

      if (!firstName) {
        document.getElementById('embellics-form-firstname').classList.add('error');
        isValid = false;
      } else {
        document.getElementById('embellics-form-firstname').classList.remove('error');
      }

      if (!lastName) {
        document.getElementById('embellics-form-lastname').classList.add('error');
        isValid = false;
      } else {
        document.getElementById('embellics-form-lastname').classList.remove('error');
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        document.getElementById('embellics-form-email').classList.add('error');
        isValid = false;
      } else {
        document.getElementById('embellics-form-email').classList.remove('error');
      }

      // Phone validation (exactly 10 digits)
      const phoneDigits = phone.replace(/\D/g, '');
      if (!phone || phoneDigits.length !== 10) {
        document.getElementById('embellics-form-phone').classList.add('error');
        isValid = false;
        if (phoneDigits.length > 0 && phoneDigits.length < 10) {
          errorDiv.textContent = 'Phone number must be exactly 10 digits';
        } else if (phoneDigits.length > 10) {
          errorDiv.textContent = 'Phone number must be exactly 10 digits';
        }
      } else {
        document.getElementById('embellics-form-phone').classList.remove('error');
      }

      if (!isValid) {
        if (!errorDiv.textContent) {
          errorDiv.textContent = 'Please fill in all fields correctly';
        }
        errorDiv.classList.add('show');
        return;
      }

      // Clear any previous errors
      errorDiv.textContent = '';
      errorDiv.classList.remove('show');

      // Disable form
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      // Return formatted data
      const contactData = {
        firstName,
        lastName,
        email,
        phone,
      };

      // Remove form and show confirmation
      formContainer.remove();

      // Add confirmation message
      const confirmText = `✓ Contact details saved:\nName: ${firstName} ${lastName}\nEmail: ${email}\nPhone: ${phone}`;
      addMessageToUI('system', confirmText);

      // Call callback with data
      if (callback) {
        callback(contactData);
      }
    };

    // Submit on button click
    submitBtn.addEventListener('click', handleSubmit);

    // Submit on Enter key in any input
    formContainer.querySelectorAll('input').forEach((input) => {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSubmit();
        }
      });
    });
  }

  // Display multiple messages sequentially with delays
  async function displayMessagesSequentially(messages) {
    for (let i = 0; i < messages.length; i++) {
      // Parse for structured options
      let responseText = messages[i];
      let responseOptions = null;

      try {
        const parsed = JSON.parse(messages[i]);
        if (parsed.message && parsed.options) {
          responseText = parsed.message;
          responseOptions = parsed.options;
        }
      } catch (e) {
        // Not JSON, use as plain text
      }

      addMessage('assistant', responseText, responseOptions);

      // Wait 1 second before showing next message (except for the last one)
      if (i < messages.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    showTyping(false);
  }

  async function sendMessage() {
    const input = document.getElementById('embellics-widget-input');
    const sendBtn = document.getElementById('embellics-widget-send');
    const message = input.value.trim();

    if (!message) return;

    // Start or reset inactivity timer on message send (first interaction starts it)
    if (!inactivityTimer) {
      startInactivityTimer();
    } else {
      resetInactivityTimer();
    }

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
            referrer: window.location.host,
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
          body: JSON.stringify({
            ...requestBody,
            referrer: window.location.host,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData.message || errorData.error || 'Failed to send message';

          // Check if error indicates chat has ended (400, 404, or 500 with chat_id error)
          if (
            response.status === 400 ||
            response.status === 404 ||
            (response.status === 500 && errorMsg.includes('chat'))
          ) {
            // Chat likely ended - throw error with clear indicator
            throw new Error(`CHAT_ENDED: ${errorMsg}`);
          }

          throw new Error(errorMsg);
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

        if (data.messages && data.messages.length > 0) {
          const firstMessage = data.messages[0];

          // Check if first message is a trigger for contact form
          if (firstMessage.trim() === 'SHOW_CONTACT_FORM') {
            // Show contact form and handle submission
            showContactForm(async (contactData) => {
              // Send contact data back to agent as JSON
              const contactDetails = {
                first_name: contactData.firstName,
                last_name: contactData.lastName,
                email: contactData.email,
                phone: contactData.phone,
              };
              const contactMessage = JSON.stringify(contactDetails);

              try {
                const followupResponse = await fetch(`${WIDGET_API_BASE}/api/widget/chat`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    apiKey: API_KEY,
                    chatId: chatId,
                    message: contactMessage,
                    referrer: window.location.host,
                  }),
                });

                if (followupResponse.ok) {
                  const followupData = await followupResponse.json();
                  if (followupData.messages && followupData.messages.length > 0) {
                    // Display messages sequentially with delays
                    await displayMessagesSequentially(followupData.messages);
                  }
                }
              } catch (error) {
                console.error('[Embellics Widget] Failed to send contact data:', error);
                showError('Failed to submit contact details. Please try again.');
              }
            });
            return; // Don't show the trigger text
          }

          // Display all messages sequentially with delays
          await displayMessagesSequentially(data.messages);
        }
      }
    } catch (error) {
      console.error('[Embellics Widget] Send message failed:', error);
      showTyping(false);

      // Check if error indicates chat has ended
      const errorMsg = error.message || '';
      if (
        errorMsg.startsWith('CHAT_ENDED:') ||
        errorMsg.includes('already ended') ||
        (errorMsg.includes('chat') &&
          (errorMsg.includes('ended') ||
            errorMsg.includes('session') ||
            errorMsg.includes('error')))
      ) {
        // Chat has ended - inform user and reload widget for fresh start
        console.log('[Embellics Widget] Chat already ended, informing user and reloading...');

        // Clear any error messages
        const errorDiv = document.getElementById('embellics-widget-error');
        if (errorDiv) {
          errorDiv.classList.remove('show');
          errorDiv.textContent = '';
        }

        // Clear messages UI
        const messagesContainer = document.getElementById('embellics-widget-messages');
        messagesContainer.innerHTML = '';

        // Show informative message
        addMessageToUI(
          'system',
          'Your previous chat session has ended. Starting a new conversation...',
        );

        // Clear session state
        clearSessionState();

        // Wait a moment for user to see the message, then reinitialize
        setTimeout(async () => {
          messagesContainer.innerHTML = '';
          await initializeWidget();
        }, 2000);

        return;
      }

      // For other errors, show error message
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
          referrer: window.location.host,
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
          referrer: window.location.host,
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

  async function endChat() {
    if (!chatId) {
      return; // Nothing to end
    }

    const menuEndChat = document.getElementById('embellics-menu-end-chat');
    if (menuEndChat) menuEndChat.disabled = true;

    try {
      const response = await fetch(`${WIDGET_API_BASE}/api/widget/end-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: API_KEY,
          chatId: chatId,
          handoffId: handoffId || undefined,
          referrer: window.location.host,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to end chat');
      }

      // Stop polling
      stopMessagePolling();
      stopStatusChecking();

      // Stop inactivity timer
      stopInactivityTimer();

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

      console.log('[Embellics Widget] Chat ended successfully');

      // Auto-start a new conversation
      await autoStartConversation();
    } catch (error) {
      console.error('[Embellics Widget] End chat failed:', error);
      showError(error.message || 'Failed to end chat. Please try again.');
      if (menuEndChat) menuEndChat.disabled = false;
    }
  }

  async function confirmEndChat() {
    // This function is no longer needed but keeping for backward compatibility
    // Just call endChat directly
    await endChat();
  }

  // Use sendBeacon for more reliable delivery when page is unloading
  window.addEventListener('beforeunload', () => {
    if (handoffStatus !== 'resolved' && (chatId || handoffId)) {
      const data = JSON.stringify({
        apiKey: API_KEY,
        chatId: chatId,
        handoffId: handoffId,
        referrer: window.location.host,
      });

      // Try sendBeacon first (more reliable), fallback to fetch
      if (navigator.sendBeacon) {
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon(`${WIDGET_API_BASE}/api/widget/end-chat`, blob);
      } else {
        // Fallback for browsers that don't support sendBeacon
        fetch(`${WIDGET_API_BASE}/api/widget/end-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: data,
          keepalive: true, // Keeps request alive even after page unload
        }).catch((error) => console.error('[Embellics Widget] Failed to end chat:', error));
      }
    }
  });

  // Note: visibilitychange removed - too aggressive, users often switch tabs temporarily
  // If you need this, consider adding a delay before ending the chat

  function startStatusChecking() {
    if (statusCheckInterval) clearInterval(statusCheckInterval);

    statusCheckInterval = setInterval(async () => {
      if (!handoffId) return;

      try {
        const response = await fetch(
          `${WIDGET_API_BASE}/api/widget/handoff/${handoffId}/status?apiKey=${API_KEY}&referrer=${encodeURIComponent(window.location.host)}`,
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
        url.searchParams.append('referrer', window.location.host);
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

      // Check if mobile and WhatsApp is available, and no existing session
      if (isMobileDevice() && widgetConfig && widgetConfig.whatsappAvailable && !chatId) {
        // Show channel selection modal instead of auto-starting conversation
        showChannelSelectionModal();
      } else {
        // Desktop or no WhatsApp - proceed normally
        document.getElementById('embellics-widget-input').focus();
        // Don't start timer on open - wait for first user interaction
      }
    } else {
      panel.classList.remove('open');
      // Stop inactivity timer when widget closes
      stopInactivityTimer();
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
    const channelWhatsAppButton = document.getElementById('embellics-channel-whatsapp');
    const channelWebButton = document.getElementById('embellics-channel-web');

    if (button) button.addEventListener('click', toggleWidget);
    if (closeButton) closeButton.addEventListener('click', toggleWidget);
    if (sendButton) sendButton.addEventListener('click', sendMessage);
    if (actionsButton) actionsButton.addEventListener('click', toggleActionsMenu);

    // Channel selection event listeners
    if (channelWhatsAppButton) {
      channelWhatsAppButton.addEventListener('click', redirectToWhatsApp);
    }

    if (channelWebButton) {
      channelWebButton.addEventListener('click', async () => {
        hideChannelSelectionModal();
        document.getElementById('embellics-widget-input').focus();
        // Start the conversation if not already started
        if (!chatId) {
          await autoStartConversation();
        }
      });
    }

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

    // Close actions menu when clicking outside
    document.addEventListener('click', (e) => {
      if (actionsMenu && actionsMenu.classList.contains('show')) {
        if (!actionsMenu.contains(e.target) && !actionsButton.contains(e.target)) {
          hideActionsMenu();
        }
      }
    });

    // Reapply positioning on window resize for responsive layout
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (isInitialized) {
          applyWidgetPosition();
        }
      }, 150);
    });

    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });

      // Reset inactivity timer on typing (only if timer already started)
      input.addEventListener('input', () => {
        if (inactivityTimer) {
          resetInactivityTimer();
        }
      });

      // Reset inactivity timer on focus (only if timer already started)
      input.addEventListener('focus', () => {
        if (inactivityTimer) {
          resetInactivityTimer();
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

(function () {
  if (window.__WEBRAG_WIDGET_LOADED__) return;
  window.__WEBRAG_WIDGET_LOADED__ = true;

  // Find our script element to extract configuration attributes
  const currentScript =
    document.currentScript ||
    document.querySelector("script[data-bot-id]") ||
    (function () {
      const scripts = document.getElementsByTagName("script");
      for (let i = scripts.length - 1; i >= 0; i--) {
        if (scripts[i].getAttribute("data-bot-id")) return scripts[i];
      }
      return null;
    })();

  if (!currentScript) {
    console.warn("[WebRAG Widget] Could not find script element with data-bot-id.");
    return;
  }

  const botId = currentScript.getAttribute("data-bot-id") || "";
  const accentColor = currentScript.getAttribute("data-color") || "#3d9cf0";
  const title = currentScript.getAttribute("data-title") || "";
  const greeting = currentScript.getAttribute("data-greeting") || "";
  const position = currentScript.getAttribute("data-position") || "bottom-right";

  if (!botId) {
    console.warn("[WebRAG Widget] Missing required data-bot-id attribute.");
    return;
  }

  // Derive origin from script src so it works locally and on production automatically
  let origin = "https://web-rag-two.vercel.app";
  try {
    if (currentScript.src) {
      origin = new URL(currentScript.src).origin;
    }
  } catch (e) {}

  // Construct iframe embed URL
  const queryParams = new URLSearchParams();
  if (accentColor) queryParams.set("color", accentColor);
  if (title) queryParams.set("title", title);
  if (greeting) queryParams.set("greeting", greeting);

  const embedUrl = `${origin}/embed/${encodeURIComponent(botId)}?${queryParams.toString()}`;

  // Inject Styles
  const style = document.createElement("style");
  style.id = "webrag-widget-styles";
  const isLeft = position === "bottom-left";
  style.textContent = `
    #webrag-launcher-btn {
      position: fixed;
      ${isLeft ? "left: 24px;" : "right: 24px;"}
      bottom: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: ${accentColor};
      box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.15);
      cursor: pointer;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      outline: none;
      padding: 0;
      transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease;
      -webkit-tap-highlight-color: transparent;
    }
    #webrag-launcher-btn:hover {
      transform: scale(1.08);
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
    }
    #webrag-launcher-btn:active {
      transform: scale(0.95);
    }
    #webrag-launcher-icon-chat,
    #webrag-launcher-icon-close {
      position: absolute;
      width: 28px;
      height: 28px;
      fill: #ffffff;
      transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #webrag-launcher-icon-close {
      opacity: 0;
      transform: rotate(-90deg) scale(0.8);
    }
    #webrag-launcher-btn.is-open #webrag-launcher-icon-chat {
      opacity: 0;
      transform: rotate(90deg) scale(0.8);
    }
    #webrag-launcher-btn.is-open #webrag-launcher-icon-close {
      opacity: 1;
      transform: rotate(0deg) scale(1);
    }
    #webrag-iframe-container {
      position: fixed;
      ${isLeft ? "left: 24px;" : "right: 24px;"}
      bottom: 96px;
      width: 410px;
      height: 640px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 120px);
      border-radius: 18px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.1);
      z-index: 2147483646;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      transform: translateY(18px) scale(0.96);
      transform-origin: ${isLeft ? "bottom left" : "bottom right"};
      transition: opacity 0.24s ease, transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
      background: #0f1219;
    }
    #webrag-iframe-container.is-open {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0) scale(1);
    }
    #webrag-chat-iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
    @media (max-width: 480px) {
      #webrag-iframe-container {
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        max-width: 100vw !important;
        max-height: 100vh !important;
        border-radius: 0 !important;
        transform: translateY(100%) !important;
      }
      #webrag-iframe-container.is-open {
        transform: translateY(0) !important;
      }
    }
  `;
  document.head.appendChild(style);

  // Create Launcher Button
  const btn = document.createElement("button");
  btn.id = "webrag-launcher-btn";
  btn.setAttribute("aria-label", "Open Chatbot");
  btn.innerHTML = `
    <svg id="webrag-launcher-icon-chat" viewBox="0 0 24 24">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
    </svg>
    <svg id="webrag-launcher-icon-close" viewBox="0 0 24 24">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  `;

  // Create Iframe Container (lazy-load iframe on first click or hover)
  const container = document.createElement("div");
  container.id = "webrag-iframe-container";

  let iframeLoaded = false;
  function ensureIframe() {
    if (iframeLoaded) return;
    iframeLoaded = true;
    const iframe = document.createElement("iframe");
    iframe.id = "webrag-chat-iframe";
    iframe.src = embedUrl;
    iframe.title = title || "AI Chatbot";
    iframe.allow = "clipboard-write";
    container.appendChild(iframe);
  }

  let isOpen = false;
  function toggleWidget() {
    isOpen = !isOpen;
    if (isOpen) {
      ensureIframe();
      btn.classList.add("is-open");
      container.classList.add("is-open");
      btn.setAttribute("aria-label", "Close Chatbot");
    } else {
      btn.classList.remove("is-open");
      container.classList.remove("is-open");
      btn.setAttribute("aria-label", "Open Chatbot");
    }
  }

  btn.addEventListener("click", toggleWidget);

  // Preload iframe on hover for near-instant opening
  btn.addEventListener("mouseenter", ensureIframe, { once: true });

  // Listen for close message from iframe
  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "webrag_close") {
      if (isOpen) toggleWidget();
    }
  });

  // Append elements to DOM
  document.body.appendChild(container);
  document.body.appendChild(btn);
})();

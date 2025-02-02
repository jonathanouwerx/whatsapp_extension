/**
 * This script is the background script for a Chrome extension that interacts with WhatsApp Web.
 * It manages the extension's state, listens for messages from other parts of the extension,
 * and communicates with the WhatsApp Web tab to update its state.
 *
 * Functions:
 * - debugLog: Logs debug messages to the console.
 * - sendMessageWithRetry: Sends messages to a tab with retry logic.
 * - getChromeState: Retrieves the extension's state from Chrome's local storage.
 * - pushState: Sends the current state to the popup and WhatsApp Web tab.
 * - setChromeState: Updates the extension's state in Chrome's local storage.
 * - initState: Initializes the extension's state and pushes it.
 * - initMessageListeners: Sets up listeners for messages from other parts of the extension.
 * - initWhatsappListeners: Sets up listeners for WhatsApp Web tab activation and updates.
 * - initExtension: Initializes the extension by calling the necessary setup functions.
 *
 * Messages Sent:
 * - state-update: Sent to popup.js and WhatsApp Web tab to update the state.
 * - whatsapp-unloaded: Sent to WhatsApp Web tab when it is unloaded.
 * - whatsapp-loaded: Sent to WhatsApp Web tab when it is loaded.
 *
 * Messages Received:
 * - toggle-extension: Received to toggle the extension's enabled state.
 * - update-names: Received to update the user name list.
 */

let currentTabId = null;
let extensionEnabled = false;
let userNameList = [];
const defaultNameList = [];

// Debug logging helper
const debugLog = (message) => {
  console.log(`[Background] ${message}`);
};

// Helper function to send messages with retry
const sendMessageWithRetry = (tabId, message, maxAttempts = 3) => {
  let attempts = 0;

  const trySendMessage = () => {
    attempts++;
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        debugLog(
          `Attempt ${attempts}: Error sending to tab ${tabId}: ${chrome.runtime.lastError.message}`
        );
        if (attempts < maxAttempts) {
          // Wait 1 second before retrying
          setTimeout(trySendMessage, 1000);
        }
      } else {
        debugLog(
          `Message sent successfully to tab ${tabId} on attempt ${attempts}`
        );
      }
    });
  };

  trySendMessage();
};

const getChromeState = () => {
  return new Promise((resolve) => {
    chrome.storage.local.get(["extensionEnabled", "userNameList"], (result) => {
      extensionEnabled = result.extensionEnabled ?? false;
      userNameList = result.userNameList ?? defaultNameList;
      resolve({ extensionEnabled, userNameList });
    });
  });
};

const pushState = async () => {
  const state = await getChromeState();

  // Send state to popup
  try {
    await chrome.runtime.sendMessage({
      type: "state-update",
      state: {
        extensionEnabled: state.extensionEnabled,
        newNamesList: state.userNameList,
      },
    });
    debugLog("State sent to popup");
  } catch (error) {
    debugLog(`Error sending to popup: ${error.message}`);
  }

  // Send state to content script
  try {
    const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
    for (const tab of tabs) {
      sendMessageWithRetry(tab.id, {
        type: "state-update",
        enabled: state.extensionEnabled,
        userNameList: state.userNameList,
      });
    }
  } catch (error) {
    debugLog(`Error sending to tabs: ${error.message}`);
  }
};

const setChromeState = async (newState) => {
  let storageUpdate = newState;
  if (newState.extensionEnabled === undefined) {
    storageUpdate.extensionEnabled = extensionEnabled;
  } else {
    debugLog(`Extension state updated to: ${storageUpdate.extensionEnabled}`);
  }
  if (newState.userNameList === undefined) {
    storageUpdate.userNameList = userNameList;
  } else {
    debugLog(`User name list updated to: ${newState.userNameList}`);
  }
  await new Promise((resolve) => {
    chrome.storage.local.set(storageUpdate, resolve);
  });
};

const initState = () => {
  getChromeState();
  if (!userNameList) {
    userNameList = defaultNameList;
  }
  debugLog(`Initial extension state: ${extensionEnabled}`);
  debugLog(`Initial user name list: ${userNameList}`);
  pushState();
};

const initMessageListeners = () => {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    debugLog(`Received message: ${JSON.stringify(request)}`);
    let newState = {};
    if (request.type === "toggle-extension") {
      if (typeof request.enabled === 'undefined') return;
      extensionEnabled = request.enabled;
      newState = { extensionEnabled };
      debugLog(`Extension enabled state toggled to: ${extensionEnabled}`);
    } else if (request.type === "update-names") {
      if (!request.userNamesList) return;
      userNameList = request.userNamesList;
      newState = { userNameList };
      debugLog(`User name list updated to: ${userNameList}`);
    } else if (request.type === "state-request") {
      debugLog(`State request received`);
    } else {
      debugLog(`Unknown message type: ${request.type}`);
      return;
    }

    setChromeState(newState);
    pushState();

    sendResponse({ success: true });
    return true; // Keep channel open for async response
  });
};

const initWhatsappListeners = () => {
  chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (tab?.url?.includes("web.whatsapp.com")) {
        currentTabId = tab.id;
        debugLog(`WhatsApp tab activated: ${tab.id}`);
        sendMessageWithRetry(currentTabId, { type: "whatsapp-loaded" });
        pushState();
      }
    });
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
      if (tab.url.includes("web.whatsapp.com")) {
        currentTabId = tab.id;
        pushState();
      } else {
        if (currentTabId) {
          sendMessageWithRetry(currentTabId, { type: "whatsapp-unloaded" });
          currentTabId = null;
        }
      }
    }
  });
};

const initExtension = () => {
  initState();
  initMessageListeners();
  initWhatsappListeners();
};

initExtension();

/**
 * Initializes the popup by requesting the initial state, setting up message listeners, and event listeners.
function initPopup() {}
 */

/**
 * Sends a message asynchronously to the background script.
 * @param {Object} message - The message to send.
 * @returns {Promise<Object>} - A promise that resolves with the response from the background script.
function sendMessageAsync(message) {}
 */

/**
 * Requests the initial state of the extension from the background script.
 * @returns {Promise<void>}
async function requestState() {}
 */

/**
 * Initializes message listeners for the popup.
 * Listens for "state-update" messages from the background script to update the UI.
function initMessageListeners() {}
 */

/**
 * Initializes event listeners for the popup.
 * Sets up event listeners for the toggle switch, add name button, and name list.
function initEventListeners() {}
 */

/**
 * Updates the UI with the list of stored names.
 * @param {Array<string>} names - The list of names to display.
function updateNameListUI(names) {}
 */

/**
 * Messages that popup.js can send:
 * - { type: "state-request" }: Requests the initial state of the extension.
 * - { type: "toggle-extension", enabled: boolean }: Toggles the extension on or off.
 * - { type: "update-names", userNamesList: Array<string> }: Updates the list of names.
 *
 * Messages that popup.js can receive:
 * - { type: "state-update", state: { extensionEnabled: boolean, newNamesList: Array<string> } }: Updates the UI with the new state.
 */

document.addEventListener("DOMContentLoaded", function () {
    const toggleSwitch = document.getElementById("toggle-extension");
    const nameInput = document.getElementById("name-input");
    const addNameButton = document.getElementById("add-name");
    const addManyButton = document.getElementById("add-many");
    const namesListElement = document.getElementById("name-list");
    let userNamesList = [];
  
    function sendMessageAsync(message) {
      return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    }
  
    async function requestState() {
      // Load stored extension state
      try {
        await sendMessageAsync({ type: "state-request" });
      } catch (error) {
        console.error("Error fetching initial state:", error);
      }
    }
  
    initMessageListeners = () => {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === "state-update") {
          const { extensionEnabled, newNamesList } = request.state;
          if (!toggleSwitch) {
            console.log("Toggle switch not ready");
            return;
          }
          toggleSwitch.checked = extensionEnabled;
          if (Array.isArray(newNamesList)) {
            userNamesList = newNamesList;
            updateNameListUI(userNamesList);
          }
        }
      });
    };
  
    const updateNames = (userNamesList) => {
      chrome.runtime.sendMessage({ type: "update-names", userNamesList });
      updateNameListUI(userNamesList);
          nameInput.value = ""; 
    }
  
    initEventListeners = () => {
      // Toggle switch event listener
      toggleSwitch.addEventListener("change", () => {
        const enabled = toggleSwitch.checked;
        chrome.runtime.sendMessage({
          type: "toggle-extension",
          enabled,
        });
      });
  
      // Add name to list
      addNameButton.addEventListener("click", () => {
        const newName = nameInput.value.trim();
        if (!newName) return;
  
        if (!Array.isArray(userNamesList)) {
          userNamesList = [];
        }
  
        if (!userNamesList.includes(newName)) {
          userNamesList.push(newName);
          updateNames(userNamesList);
        }
      });
  
      // Add multiple names to list
      addManyButton.addEventListener("click", () => {
        const newNames = nameInput.value
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name);
        if (!newNames.length) return;
  
        if (!Array.isArray(userNamesList)) {
          userNamesList = [];
        }
  
        userNamesList = [...new Set([...userNamesList, ...newNames])];
        updateNames(userNamesList);
      });
  
      // Remove name from list
      namesListElement.addEventListener("click", (event) => {
        if (event.target.classList.contains("remove-btn")) {
          const nameToRemove = event.target.dataset.name;
          if (!nameToRemove) return;
  
          userNamesList = userNamesList.filter((name) => name !== nameToRemove);
          chrome.runtime.sendMessage({ type: "update-names", userNamesList });
          updateNameListUI(userNamesList);
        }
      });
    };
  
    // Update UI with stored names
    const updateNameListUI = (names) => {
      if (!names) return;
      namesListElement.innerHTML = "";
      names.forEach((name) => {
        const li = document.createElement("li");
        li.textContent = name;
        const removeButton = document.createElement("button");
        removeButton.textContent = "X";
        removeButton.classList.add("remove-btn");
        removeButton.dataset.name = name;
        li.appendChild(removeButton);
        namesListElement.appendChild(li);
      });
    };
  
    function initPopup() {
      requestState();
      initMessageListeners();
      initEventListeners();
    }
  
    initPopup();
  });
  
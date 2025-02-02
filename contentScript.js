(() => {
    let fullNamesList = [];
    let extensionEnabled = false;
  
    const debugLog = (message) => {
      console.log(`[ContentScript] ${message}`);
    };
  
    const initClickListeners = () => {
      if (!extensionEnabled) return;
  
      const reactionIcons = Array.from(
        document.querySelectorAll("[aria-label^='Reactions ']")
      );
      let count = 0;
      for (let icon of reactionIcons) {
        count++;
        icon.removeEventListener("click", handleReactionClick);
        icon.addEventListener("click", handleReactionClick);
      }
    };
  
    const removeClickListeners = () => {
      const reactionIcons = document.querySelectorAll(
        "[aria-label^='Reactions ']"
      );
  
      reactionIcons.forEach((icon) => {
        icon.removeEventListener("click", handleReactionClick);
      });
    };
  
    const handleReactionClick = () => {
      let seenNames = new Set();
      let lastSeenCount = 0;
      let iterations = 0;
      const SCROLL_AMOUNT = 795; // 15 items * ~45px per item
      const MAX_ITERATIONS = 10; // Prevent infinite loops
  
      const intervalId = setInterval(() => {
        let popupElement = document.querySelector(
          "div[role='list'] > div[tabindex='-1']"
        );
        if (!popupElement) {
          debugLog(
            "⚠️ Reaction popup not found. Ensure the selector is correct."
          );
          clearInterval(intervalId);
          return;
        }
  
        let scrollableParent = popupElement.parentElement.parentElement;
        if (!scrollableParent) {
          debugLog("⚠️ No scrollable parent found.");
          clearInterval(intervalId);
        }
  
        let reactionMembers = popupElement.querySelectorAll("button span._ao3e");
        if (!reactionMembers || reactionMembers.length === 0) {
          debugLog("⚠️ No reaction members found.");
          return;
        }
  
        reactionMembers.forEach((member) => {
          seenNames.add(member.innerText.trim());
        });
  
        if (seenNames.size === lastSeenCount || iterations >= MAX_ITERATIONS) {
          debugLog(`Found ${seenNames.size} total reactions`);
          scrollableParent.scrollTop = 0;
          clearInterval(intervalId);
          return;
        }
  
        lastSeenCount = seenNames.size;
        scrollableParent.scrollTop += SCROLL_AMOUNT;
        iterations++;
  
        // Levenshtein Distance Algorithm to measure similarity between strings
        const levenshteinDistance = (a, b) => {
          const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
          for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
          }
  
          for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
              const cost = b[i - 1] === a[j - 1] ? 0 : 1;
              matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1, // Deletion
                matrix[i][j - 1] + 1, // Insertion
                matrix[i - 1][j - 1] + cost // Substitution
              );
            }
          }
  
          return matrix[b.length][a.length];
        };
  
        // Improved Name Matching Algorithm
        const missingNames = fullNamesList.filter((name) => {
          const normalizedName = name.toLowerCase().trim();
          const [firstName, ...lastNameParts] = normalizedName.split(" ");
          const lastName = lastNameParts.join(" ");
  
          let nameFound = false;
  
          for (let memberName of seenNames) {
            const normalizedMemberName = memberName.toLowerCase().trim();
  
            // 1. Exact Full Name Match
            if (normalizedMemberName === normalizedName) {
              nameFound = true;
              break;
            }
  
            // 2. Exact First Name + Last Name Match (handles middle names)
            if (
              normalizedMemberName.includes(firstName) &&
              (lastName ? normalizedMemberName.includes(lastName) : true)
            ) {
              nameFound = true;
              break;
            }
  
            // 3. Fuzzy Match using Levenshtein Distance (allowing minor typos)
            if (
              levenshteinDistance(normalizedMemberName, normalizedName) <= 2 || // Full name typo tolerance
              levenshteinDistance(
                normalizedMemberName.split(" ")[0],
                firstName
              ) <= 1 || // First name typo tolerance
              (lastName &&
                levenshteinDistance(
                  normalizedMemberName.split(" ").slice(-1)[0],
                  lastName
                ) <= 1) // Last name typo tolerance
            ) {
              nameFound = true;
              break;
            }
          }
          return !nameFound;
        });
  
        debugLog("Message Reaction Names: " + Array.from(seenNames));
        debugLog("Checklist Names: " + fullNamesList);
        debugLog("Missing Names: " + missingNames);
  
        displayMissingNames(missingNames);
  
        const observer = new MutationObserver((mutationsList, observer) => {
          for (let mutation of mutationsList) {
            if (
              mutation.type === "childList" &&
              !document.body.contains(popupElement)
            ) {
              debugLog("Popup closed, removing missing names display");
              removeMissingNamesDisplay();
              observer.disconnect();
              clearInterval(intervalId);
              break;
            }
          }
        });
  
        iterations++;
        observer.observe(document.body, { childList: true, subtree: true });
      }, 500);
    };
  
    const displayMissingNames = (missingNames) => {
      removeMissingNamesDisplay();
  
      let container = document.createElement("div");
      container.id = "missing-names-container";
      container.style.position = "fixed";
      container.style.bottom = "10px";
      container.style.right = "10px";
      container.style.padding = "10px";
  
      container.style.color = "white";
      container.style.borderRadius = "5px";
      container.style.fontFamily = "Arial, sans-serif";
      container.style.boxShadow = "0px 0px 10px rgba(0,0,0,0.2)";
      container.style.zIndex = "10000";
  
      if (missingNames.length === 0) {
        container.style.backgroundColor = "#4CAF50";
        container.innerHTML = "<strong>All names found!</strong>";
      } else {
        container.style.backgroundColor = "#ff4d4d";
        container.innerHTML =
          "<strong>Missing Names:</strong><ul>" +
          missingNames.map((name) => `<li>${name}</li>`).join("") +
          "</ul>";
      }
  
      document.body.appendChild(container);
    };
  
    const removeMissingNamesDisplay = () => {
      let existingContainer = document.getElementById("missing-names-container");
      if (existingContainer) {
        existingContainer.remove();
      }
    };
  
    // Message handler
    const initMessageListeners = () => {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        debugLog(`Received message: ${JSON.stringify(request)}`);
  
        if (request.type === "whatsapp-loaded") {
          debugLog("WhatsApp loaded");
          // ? I dont know if any of this is needed
          if (extensionEnabled) {
            initClickListeners();
          }
        } else if (request.type === "whatsapp-unloaded") {
          debugLog("WhatsApp unloaded");
          // ? I dont know if any of this is needed
          removeMissingNamesDisplay();
          removeClickListeners();
        } else if (request.type === "state-update") {
          if (typeof request.enabled === "undefined") {
            throw new Error(
              "Extension state not received in message from background"
            );
          }
          if (!extensionEnabled) {
            initClickListeners();
          } else {
            removeClickListeners();
            removeMissingNamesDisplay();
          }
          extensionEnabled = request.enabled;
          debugLog(`Extension state updated to: ${extensionEnabled}`);
  
          if (!request.userNameList) {
            throw new Error(
              "userNameList not received in message from background"
            );
          }
          fullNamesList = request.userNameList;
          debugLog(`User name list updated to: ${fullNamesList}`);
        }
        sendResponse({ received: true });
  
        return true; // Keep message channel open for async response
      });
    };
  
    const init = () => {
      debugLog("Initializing content script");
      initMessageListeners();
      initClickListeners();
      const observer = new MutationObserver(initClickListeners);
      observer.observe(document.body, { childList: true, subtree: true });
    };
  
    init();
  })();
  
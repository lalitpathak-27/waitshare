
(() => {
  // Prevent the extension from creating duplicate panels.
  if (window.waitShareAdInstalled) return;
  window.waitShareAdInstalled = true;

  const AD_ID = "waitshare-sponsored-ad";

  // Find the latest AI response without reading its content.
  function findLatestAIResponse() {
    const host = window.location.hostname;

    let selectors = [];

    if (host.includes("chatgpt.com") || host.includes("chat.openai.com")) {
      selectors = [
        'main [data-message-author-role="assistant"]'
      ];
    } else if (host.includes("gemini.google.com")) {
      selectors = [
        "main model-response",
        "main .model-response"
      ];
    } else if (host.includes("claude.ai")) {
      selectors = [
        "main .font-claude-message"
      ];
    }

    for (const selector of selectors) {
      const responses = document.querySelectorAll(selector);

      if (responses.length > 0) {
        return responses[responses.length - 1];
      }
    }

    return null;
  }

  // Create the sponsored advertisement.
  function createSponsoredAd() {
    const ad = document.createElement("div");
    ad.id = AD_ID;
    ad.className = "waitshare-ad";

    const logo = document.createElement("div");
    logo.className = "waitshare-ad-logo";
    logo.textContent = "W";

    const content = document.createElement("div");
    content.className = "waitshare-ad-content";

    const heading = document.createElement("div");
    heading.className = "waitshare-ad-heading";
    heading.textContent = "Sponsored · Demo";

    const message = document.createElement("div");
    message.className = "waitshare-ad-message";
    message.textContent =
      "Discover something useful while you wait.";

    const link = document.createElement("a");
    link.className = "waitshare-ad-link";
    link.href = "https://example.com";
    link.target = "_blank";
    link.rel = "noopener noreferrer sponsored";
    link.textContent = "Visit sponsor ↗";

    content.append(heading, message, link);
    ad.append(logo, content);

    return ad;
  }

  function placeAdvertisement() {
    const response = findLatestAIResponse();

    if (!response || !response.parentElement) return;

    let ad = document.getElementById(AD_ID);

    if (!ad) {
      ad = createSponsoredAd();
    }

    // Position the ad directly before the latest AI response.
    if (ad.nextElementSibling !== response) {
      response.parentElement.insertBefore(ad, response);
    }
  }

  // Watch for new AI response elements.
  const observer = new MutationObserver(() => {
    placeAdvertisement();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Initial attempt.
  placeAdvertisement();
})();

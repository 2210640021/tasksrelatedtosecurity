"use client";

import React, { useState } from "react";
import "./GlobalBotButton.css";

export default function BotButton() {
  const [loading, setLoading] = useState(false);

  // Handles the bot call process.
  const handleCallBot = async () => {
    setLoading(true);

    try {
      // Get the last uploaded file URL.
      const uploadsRes = await fetch("/api/uploads", { cache: "no-store" });
      if (!uploadsRes.ok) throw new Error("Konnte Upload-Liste nicht abrufen.");
      const uploads = await uploadsRes.json();
      const lastUpload = uploads[0];

      if (!lastUpload || !lastUpload.fileUrl) {
        alert("Fehler: Keine hochgeladene Datei gefunden. Bitte lade zuerst eine Datei hoch.");
        setLoading(false);
        return;
      }

      // Call the bot to visit the URL.
      const botRes = await fetch("/api/call-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: `${window.location.origin}${lastUpload.fileUrl}`,
        }),
      });
      if (!botRes.ok) throw new Error("Der Bot-Aufruf ist fehlgeschlagen.");
      
      // Start polling for the result.
      pollForResult();

    } catch (error) {
      const message = error instanceof Error ? error.message : "Ein unbekannter Fehler ist aufgetreten.";
      alert(`Fehler: ${message}`);
      setLoading(false);
    }
  };

  // Polls the server for the result of the bot's visit.
  const pollForResult = () => {
    let attempts = 0;
    const maxAttempts = 10; // 10 attempts over 10 seconds

    const intervalId = setInterval(async () => {
      if (attempts >= maxAttempts) {
        clearInterval(intervalId);
        alert("Nope, versuch einen anderen Weg.");
        setLoading(false);
        return;
      }

      try {
        const flagRes = await fetch("/api/get-flag");
        if (flagRes.ok) {
          const data = await flagRes.json();
          if (data.flag) {
            clearInterval(intervalId);
            alert(`Hurra! Hier ist der Cookie: ${data.flag}`);
            setLoading(false);
          }
        }
      } catch (error) {
        // Ignore fetch errors during polling, as 404 is expected.
      }
      
      attempts++;
    }, 1000); // Poll every 1 second
  };

  return (
    <div className="global-bot-button-container">
      <button
        onClick={handleCallBot}
        className="global-bot-button"
        disabled={loading}
        title="Bot rufen, um letzte hochgeladene Datei zu besuchen"
      >
        {loading ? "..." : "🤖"}
      </button>
    </div>
  );
}
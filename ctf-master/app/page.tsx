"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  // State for the flag verification form
  const [submittedFlag, setSubmittedFlag] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Handles the form submission for flag verification.
  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/verify-flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submittedFlag }),
      });

      const data = await res.json();

      if (data.success) {
        setIsVerified(true);
      } else {
        setError(data.error || "Falsche Flagge. Versuch es noch einmal.");
      }
    } catch {
      setError("Ein Fehler ist aufgetreten. Bitte versuche es später erneut.");
    } finally {
      setLoading(false);
    }
  };

  // If the flag is verified, show the success message.
  if (isVerified) {
    return (
      <main style={{ textAlign: 'center', padding: '80px 20px', color: '#d7dadc', background: '#1a1a1b', minHeight: '100vh' }}>
        <h1 style={{ fontSize: 48, color: '#10b981' }}>🏆</h1>
        <h1 style={{ margin: '0 0 10px 0', fontSize: 32 }}>Herzlichen Glückwunsch!</h1>
        <p style={{ fontSize: 18, color: '#818384' }}>
          Du hast die Challenge erfolgreich abgeschlossen und die Flagge gefunden.
        </p>
      </main>
    );
  }

  return (
    <main
      style={{
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial",
        padding: "40px 20px",
        maxWidth: 900,
        margin: "0 auto",
        color: "#d7dadc",
        background: "#1a1a1b",
        minHeight: "100vh",
      }}
    >
      <section
        style={{
          background: "#272729",
          padding: 24,
          borderRadius: 12,
          boxShadow: "0 6px 18px rgba(0,0,0,0.6)",
          border: "1px solid #3f4141",
        }}
      >
        <header>
          <h1 style={{ margin: 0, fontSize: 28, color: "#d7dadc", fontWeight: 700 }}>C00KIE-M0NSTER — CTF Challenge</h1>
          <p style={{ color: "#818384", marginTop: 8, fontSize: 15, lineHeight: 1.6 }}>
            Willkommen zur Web-Challenge <strong style={{ color: "#ff4500" }}>C00KIE-M0NSTER</strong>!
          </p>
        </header>

        <section style={{ marginTop: 18 }}>
          <ul style={{ color: "#d7dadc", lineHeight: 1.6, fontSize: 15 }}>
            Die Plattform <strong>c00kie_m0nster</strong> führt derzeit ein neues Feature für Reaktionen ein. Um
            Testmissbrauch zu vermeiden, läuft im Hintergrund ein kleiner Admin-Bot, der
            automatisch alles überprüft, was in einem speziellen Thread gepostet wird. Eigentlich
            sollte er unauffällig im Hintergrund bleiben, aber es gibt Gerüchte, dass er sich
            manchmal merkwürdig verhält. Einige Tester berichten von einer minimalen Reaktion im
            Browser, andere haben beobachtet, dass der Bot etwas in seinem internen Status ändert,
            sobald bestimmte Inhalte auftauchen. Bisher konnte das Entwicklerteam den Fehler
            jedoch nicht gezielt reproduzieren.
          <h3 style={{ marginBottom: 8, fontSize: 18, color: "#d7dadc", fontWeight: 700 }}>Deine Aufgabe:</h3>
          Untersuche den Thread, experimentiere mit den verfügbaren Reaktionsmöglichkeiten
          und finde heraus, was den Bot aus der Reserve lockt. Wenn du es schaffst, enthüllt er
          möglicherweise etwas, das er eigentlich nicht preisgeben sollte
          </ul>
        </section>

        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => router.push("/ctf")}
            style={{
              background: "#ff4500", color: "#fff", fontWeight: 700, border: "none",
              padding: "12px 18px", borderRadius: 8, cursor: "pointer",
              boxShadow: "0 4px 10px rgba(255,69,0,0.3)",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#ff5a1a"}
            onMouseLeave={(e) => e.currentTarget.style.background = "#ff4500"}
          >
            Zur Challenge-Seite
          </button>
        </div>
        
        {/* --- Flag Verification Form --- */}
        <form onSubmit={handleVerification} style={{ marginTop: 32, borderTop: '1px solid #3f4141', paddingTop: 24 }}>
            <h3 style={{ marginTop: 0, color: "#d7dadc", fontSize: 18, fontWeight: 700 }}>Flagge einreichen</h3>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input 
                    type="text"
                    value={submittedFlag}
                    onChange={(e) => setSubmittedFlag(e.target.value)}
                    placeholder="CTF{...}"
                    style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px solid #3f4141',
                        fontSize: 16,
                        background: '#1a1a1b',
                        color: '#d7dadc',
                    }}
                    disabled={loading}
                />
                <button 
                    type="submit"
                    style={{
                        background: '#10b981', color: '#fff', fontWeight: 700, border: 'none',
                        padding: '10px 18px', borderRadius: 8, cursor: 'pointer',
                        opacity: loading ? 0.7 : 1,
                        transition: 'background 0.2s ease',
                    }}
                    onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#059669')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#10b981')}
                    disabled={loading}
                >
                    {loading ? 'Prüfe...' : 'Überprüfen'}
                </button>
            </div>
            {error && <p style={{ color: '#ff6b6b', marginTop: 8, fontSize: 14 }}>{error}</p>}
        </form>

      </section>
    </main>
  );
}
"use client";

import React, { useEffect, useRef, useState } from "react";

type Comment = {
  id: string;
  author: string;
  text?: string;
  imgUrl?: string | null;
  avatarUrl?: string | null;
  time?: string;
  removable?: boolean;
};

export default function Home() {
  // --- STATE MANAGEMENT ---
  const [votes, setVotes] = useState<number>(4500);
  const [cookieStored, setCookieStored] = useState<boolean>(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [maliciousPreviewActive, setMaliciousPreviewActive] = useState<boolean>(false);
  const svgObjectContainerRef = useRef<HTMLDivElement | null>(null);

  // Reaction form state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [reactionPreview, setReactionPreview] = useState<string | null>(null);
  const [reactionFileName, setReactionFileName] = useState<string | null>(null);
  const [reactionText, setReactionText] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Hint state
  const [hintOpen, setHintOpen] = useState<boolean>(false);
  const [hintExpanded, setHintExpanded] = useState<boolean>(false);

  // --- DATA FETCHING ---
  useEffect(() => {
    async function loadComments() {
      try {
        const defaultRes = await fetch("/comments.json");
        let defaultComments: Comment[] = [];
        if (defaultRes.ok) {
          defaultComments = await defaultRes.json();
        }

        const res = await fetch("/api/comments");
        if (res.ok) {
          const apiComments = await res.json();
          if (Array.isArray(apiComments) && apiComments.length > 0) {
            setComments([...defaultComments, ...apiComments]);
          } else {
            setComments(defaultComments);
          }
        } else {
          setComments(defaultComments);
        }
      } catch (err) {
        console.error("Fehler beim Laden der Kommentare:", err);
        setComments([]);
      } finally {
        setLoading(false);
      }
    }
    loadComments();
  }, []);

  // --- HELPER FUNCTIONS ---

  // Sets a demo cookie for simulation purposes.
  function setDemoCookie(name: string, value: string, days = 1) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
      value
    )}; expires=${expires}; path=/; SameSite=Lax`;
    console.log("[simulation] Demo-Cookie gesetzt:", name, "=", value);
  }

  // Deletes a demo cookie.
  function deleteDemoCookie(name: string) {
    document.cookie = `${encodeURIComponent(
      name
    )}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    console.log("[simulation] Demo-Cookie gelöscht:", name);
  }

  // Checks if an SVG string contains potentially malicious code.
  async function isSvgMaliciousText(svgText: string): Promise<boolean> {
    if (!svgText) return false;
    const reScriptTag = /<script[\s>]/i;
    const reOnAttr = /\son\w+\s*=\s*['"]/i;
    const reJavascriptUri = /javascript\s*:/i;
    const reForeignObject = /<foreignObject[\s>]/i;
    const reXlinkJs = /xlink:href\s*=\s*['"]javascript:/i;
    return (
      reScriptTag.test(svgText) ||
      reOnAttr.test(svgText) ||
      reJavascriptUri.test(svgText) ||
      reForeignObject.test(svgText) ||
      reXlinkJs.test(svgText)
    );
  }
  
  // Renders an SVG object in a hidden container to check for malicious behavior.
  function renderSvgObject(url: string) {
    try {
      const container = svgObjectContainerRef.current ?? document.body;
      Array.from(container.querySelectorAll('[data-svg-object="true"]')).forEach(n => n.remove());

      const obj = document.createElement("object");
      obj.setAttribute("data-svg-object", "true");
      obj.type = "image/svg+xml";
      obj.data = url;
      obj.style.width = "1px";
      obj.style.height = "1px";
      obj.style.position = "absolute";
      obj.style.left = "-9999px";

      container.appendChild(obj);
    } catch (e) {
      console.error("renderSvgObject error", e);
    }
  }

  // Handles the file input change event.
  async function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    
    if (reactionPreview && reactionPreview.startsWith("blob:")) {
      URL.revokeObjectURL(reactionPreview);
    }

    setReactionFileName(f.name);
    setSelectedFile(f);

    const localPreviewUrl = URL.createObjectURL(f);
    setReactionPreview(localPreviewUrl);

    const isSvg = (f.type && f.type.includes("svg")) || f.name.toLowerCase().endsWith(".svg");
    if (isSvg) {
        try {
          renderSvgObject(localPreviewUrl);
        } catch (err) {
          console.warn("Could not render local SVG object", err);
        }
    }
  }
  
  function handlePickFile() {
    fileInputRef.current?.click();
  }
  
  // Cancels the selected reaction file.
  function cancelReactionFile() {
    if (reactionPreview && reactionPreview.startsWith("blob:")) {
      URL.revokeObjectURL(reactionPreview);
    }
    setReactionPreview(null);
    setReactionFileName(null);
    setSelectedFile(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  }

  // Posts a new reaction.
  async function postReaction() {
    if (!selectedFile && !reactionText.trim()) {
      alert("Bitte Text oder ein Bild auswählen, bevor du postest.");
      return;
    }

    let finalImgUrl: string | null = null;

    if (selectedFile) {
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error("Upload fehlgeschlagen");
        const data = await res.json();
        finalImgUrl = data.url;
        console.log("Datei erfolgreich hochgeladen:", finalImgUrl);
      } catch (err) {
        console.error("Upload error:", err);
        alert("Fehler beim Hochladen der Datei.");
        return;
      }
    }

    const newComment: Comment = {
      id: `c_${Date.now()}`,
      author: "community_user",
      text: reactionText.trim() || undefined,
      imgUrl: finalImgUrl,
      avatarUrl: "community_user.jpeg",
      time: "soeben",
      removable: true,
    };

    setComments((prev) => [newComment, ...prev]);

    await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newComment),
    });

    cancelReactionFile();
    setReactionText("");
  }

  // Removes a comment.
  async function removeComment(id: string) {
    const commentToRemove = comments.find(c => c.id === id);
    setComments((prev) => prev.filter((c) => c.id !== id));

    const queryParams = new URLSearchParams({ id });
    if (commentToRemove && commentToRemove.imgUrl) {
      queryParams.append('imgUrl', commentToRemove.imgUrl);
    }

    await fetch(`/api/comments?${queryParams.toString()}`, { method: "DELETE" });
  }

  // ---EFFECTS ---

  useEffect(() => {
    if (loading) return;

    const cookieExists = document.cookie.includes("VICTIM_TOKEN_SIMULATED");
    if (cookieExists && !cookieStored) setCookieStored(true);

    let cancelled = false;

    async function scanCommentsForMaliciousSvg() {
      for (const c of comments) {
        const url = c.imgUrl;
        if (!url) continue;
        const lower = url.toLowerCase();
        if (!lower.endsWith(".svg") && !lower.includes("image/svg+xml")) continue;
        try {
          const absolute = new URL(url, window.location.href);
          if (absolute.origin !== window.location.origin) continue;

          const res = await fetch(absolute.href, { cache: "no-store" });
          if (!res.ok) continue;
          const text = await res.text();
          const malicious = await isSvgMaliciousText(text);
          if (malicious && !cancelled) {
            if (!document.cookie.includes("VICTIM_TOKEN_SIMULATED")) {
              setDemoCookie("VICTIM_TOKEN_SIMULATED", "CTF_COOKIE_svg_detected_in_feed");
              setCookieStored(true);
            }
            return;
          }
        } catch (e) {
          continue;
        }
      }

      if (!cancelled) {
        if (!maliciousPreviewActive) {
          if (document.cookie.includes("VICTIM_TOKEN_SIMULATED")) {
            deleteDemoCookie("VICTIM_TOKEN_SIMULATED");
            setCookieStored(false);
          }
        }
      }
    }

    scanCommentsForMaliciousSvg();

    return () => {
      cancelled = true;
    };
  }, [comments, loading, maliciousPreviewActive, cookieStored]);

  // --- RENDER ---

  if (loading)
    return <p style={{ padding: 20, color: '#d7dadc' }}>Kommentare werden geladen...</p>;

  return (
    <section style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
        <main style={{ flex: 1 }}>
          {/* --- Main Post --- */}
          <article className="card" style={{ padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 13, color: "#818384", marginBottom: 6 }}>
                  r/c00kie_m0nster
                </div>
                <h1 style={{ margin: 0, fontSize: 22, color: '#d7dadc' }}>
                  Seltsames Verhalten im neuen Reaktions-Feature
                </h1>
                <div style={{ marginTop: 8, color: "#818384", fontSize: 13 }}>
                  gepostet von <strong>dev_team</strong> • vor 13 Minuten
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#9aa3b2" }}>Votes</div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>4.5k</div>
              </div>
            </div>

            <div style={{ marginTop: 12, color: "#d7dadc", lineHeight: 1.45 }}>
              <p>
                Hey Leute, hier ist das Dev-Team :)
              </p>
              <p>
                Wir testen hier das neue Reaktions-Feature
                und haben aus internen Tests Hinweise
                erhalten, dass sich der Browser einiger
                Nutzer minimal verändert, sobald der
                Admin-Bot den Thread prüft. Wir konnten
                dieses Verhalten bisher nicht selbst auslösen
                und wissen nicht, welche Bedingungen
                genau dazu führen.              
              </p>
              <p>
                Wenn ihr uns unterstützen möchtet,
                probiert die Reaktionsfunktion gern aus.
                Text und Bilder sind möglich. Vielleicht
                entdeckt ihr etwas, das uns entgangen ist.
              </p>
              <p>
                Danke fürs Mithelfen!
              </p>
              <div style={{ marginTop: 16 }}>
                <img
                  src="screaming.jpg"
                  alt="please help..."
                  style={{
                    maxWidth: "55%",
                    borderRadius: 8,
                    border: "1px solid #3f4141",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.6)",
                  }}
                />
              </div>
            </div>
          </article>

          {/* --- Reaction Form --- */}
          <div className="card" style={{ marginTop: 20, padding: 20, background: "#272729", border: "1px solid #3f4141", boxShadow: "0 4px 12px rgba(0,0,0,0.6)" }}>
            <h3 style={{ marginTop: 0, marginBottom: 8, color: "#d7dadc", fontSize: 18, fontWeight: 700 }}>Reagiere auf den Post</h3>
            <p className="muted" style={{ color: "#818384", fontSize: 15, margin: "0 0 16px 0" }}>
              Schreibe etwas oder lade ein Bild hoch. Manche Inhalte werden vom Browser unterschiedlich verarbeitet.
            </p>

            <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 12 }}>
                  <button className="btn" onClick={handlePickFile} style={{ background: "#3f4141", color: "#d7dadc", border: "1px solid #464748", padding: "10px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 15, transition: "all 0.2s ease" }} onMouseEnter={(e) => e.currentTarget.style.background = "#464748"} onMouseLeave={(e) => e.currentTarget.style.background = "#3f4141"}>
                    Wähle Bild
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.svg"
                    style={{ display: "none" }}
                    onChange={handleFileInput}
                  />
                  <button
                    className="btn"
                    onClick={postReaction}
                    style={{ marginLeft: 8, background: "#ff4500", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 15, transition: "all 0.2s ease" }}
                    disabled={!selectedFile && !reactionText.trim()}
                    onMouseEnter={(e) => !(!selectedFile && !reactionText.trim()) && (e.currentTarget.style.background = "#ff5a1a")}
                    onMouseLeave={(e) => e.currentTarget.style.background = "#ff4500"}
                  >
                    Posten
                  </button>
                </div>

                <textarea
                  placeholder="Kommentar (optional)"
                  value={reactionText}
                  onChange={(e) => setReactionText(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 6,
                    border: "1px solid #3f4141",
                    minHeight: 96,
                    background: "#3f4141",
                    color: "#d7dadc",
                    fontSize: 15,
                    lineHeight: 1.5,
                    fontFamily: "inherit"
                  }}
                />

                {reactionFileName && (
                  <div style={{ marginTop: 10, fontSize: 13, color: "#818384" }}>
                    Gewählte Datei: <strong>{reactionFileName}</strong>
                  </div>
                )}

                {reactionPreview && (
                  <div style={{ marginTop: 10, position: 'relative', width: 'fit-content' }}>
                    <div style={{ fontSize: 13, color: "#818384", marginBottom: 6 }}>Vorschau:</div>
                    <img
                      src={reactionPreview}
                      alt="preview"
                      style={{ maxWidth: 240, display: "block", borderRadius: 4 }}
                    />
                    <button onClick={cancelReactionFile} style={{ position: 'absolute', top: 0, right: 0, background: 'rgba(0,0,0,0.7)', color: 'white', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', fontWeight: 'bold', lineHeight: '24px', textAlign: 'center', padding: 0 }}>
                      X
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* --- Comments --- */}
          <section style={{ marginTop: 18 }}>
            <h3 style={{ color: '#d7dadc' }}>Kommentare & Reaktionen</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
              {comments.map((c) => (
                <li key={c.id} className="card" style={{ padding: 12, background: "#272729", border: "1px solid #3f4141", boxShadow: "0 2px 8px rgba(0,0,0,0.4)", transition: "all 0.2s ease" }} onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 4px 16px rgba(255,69,0,0.2)"} onMouseLeave={(e) => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.4)"}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <img
                      src={`/${c.avatarUrl}`}
                      alt={`${c.author} avatar`}
                      style={{
                        width: 60,
                        height: 60,
                        borderRadius: 8,
                        objectFit: "cover",
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <strong style={{ color: '#d7dadc' }}>{c.author}</strong>
                        <div style={{ color: "#9aa3b2", fontSize: 12 }}>
                          {c.time ?? "soeben"}
                        </div>
                      </div>
                      {c.text && <div style={{ marginTop: 6, color: '#d7dadc' }}>{c.text}</div>}
                      {c.imgUrl && (
                        <div style={{ marginTop: 8 }}>
                          <img
                            src={c.imgUrl}
                            alt="reaction"
                            style={{ maxWidth: 320, borderRadius: 8, border: '1px solid #3f4141' }}
                          />
                        </div>
                      )}
                      {c.removable && (
                        <div style={{ marginTop: 8 }}>
                          <button
                            onClick={() => removeComment(c.id)}
                            style={{
                              border: "none",
                              background: "#2f3132",
                              color: '#d7dadc',
                              padding: "6px 8px",
                              borderRadius: 8,
                              cursor: "pointer",
                              fontSize: 13,
                            }}
                          >
                            Entfernen
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </main>

        {/* --- Sidebar --- */}
        <aside style={{ width: 300 }}>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, color: '#d7dadc' }}>Hinweis</div>
              <button
                onClick={() => setHintOpen((s) => !s)}
                aria-expanded={hintOpen}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontWeight: 700,
                  color: "#d7dadc",
                }}
              >
                {hintOpen ? "verstecken" : "anzeigen"}
              </button>
            </div>

            {hintOpen && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 14, color: "#818384" }}>
                  Der Admin-Bot schaut sich alles an, was
                  hier im Thread gepostet wird. Er klickt
                  allerdings auf keine Links, sondern verlässt
                  sich nur auf Inhalte, die direkt eingebettet
                  sind.
                </div>

                <button
                  onClick={() => setHintExpanded((s) => !s)}
                  style={{
                    marginTop: 10,
                    display: "inline-flex",
                    gap: 8,
                    alignItems: "center",
                    padding: "6px 8px",
                    borderRadius: 8,
                    border: "1px solid #3f4141",
                    background: "#272729",
                    cursor: "pointer",
                    fontWeight: 700,
                    color: '#d7dadc'
                  }}
                >
                  {hintExpanded
                    ? "Erweiterten Hinweis verbergen"
                    : "Erweiterten Hinweis anzeigen"}
                </button>

                {hintExpanded && (
                  <div style={{ marginTop: 10, fontSize: 13, color: "#818384" }}>
                    <p style={{ margin: 0 }}>
                      Nicht alle Dateien sind statisch. Manche
                      können Code enthalten, der im Browser des
                      Besuchers ausgeführt wird. Wie könnte man
                      den Bot dazu bringen, uns etwas zu verraten?
                      </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

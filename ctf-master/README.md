# CTF-Challenge: C00KIE-M0NSTER

## Hintergrundgeschichte

Willkommen zur Web-Challenge **C00KIE-M0NSTER**!

Die Plattform **c00kie_m0nster** führt derzeit ein neues Feature für Reaktionen ein. Um Testmissbrauch zu vermeiden, läuft im Hintergrund ein kleiner Admin-Bot, der automatisch alles überprüft, was in einem speziellen Thread gepostet wird. Eigentlich sollte er unauffällig im Hintergrund bleiben, aber es gibt Gerüchte, dass er sich manchmal merkwürdig verhält. Einige Tester berichten von einer minimalen Reaktion im Browser, andere haben beobachtet, dass der Bot etwas in seinem internen Status ändert, sobald bestimmte Inhalte auftauchen. Bisher konnte das Entwicklerteam den Fehler jedoch nicht gezielt reproduzieren.

Deine Aufgabe: Untersuche den Thread, experimentiere mit den verfügbaren Reaktionsmöglichkeiten und finde heraus, was den Bot aus der Reserve lockt. Wenn du es schaffst, enthüllt er möglicherweise etwas, das er eigentlich nicht preisgeben sollte.

## Tech-Stack

- **Frontend:** Next.js & React
- **Backend:** Next.js API Routes
- **Bot-Simulation:** Puppeteer

## Setup & Installation

Folge diesen Schritten, um das Projekt lokal zu starten:

1.  **Abhängigkeiten installieren:**

    ```bash
    npm install
    ```

2.  **Entwicklungsserver starten:**

    ```bash
    npm run dev
    ```

3.  **Anwendung öffnen:**
    Öffne deinen Browser und gehe zu `http://localhost:3000`.

## Spielanleitung

1.  **Zur Challenge-Seite:**
    Auf der Startseite findest du eine Beschreibung der Challenge. Klicke auf den Button, um zur eigentlichen Challenge-Seite (`/ctf`) zu gelangen.

2.  **Die Interaktion:**
    Auf der Challenge-Seite siehst du einen Post und eine Kommentar-Sektion. Du kannst auf den Post reagieren, indem du einen Text schreibst oder eine Bild-Datei hochlädst.

3.  **Der Admin-Bot:**
    Ein globaler Button mit einem Roboter-Icon schwebt unten rechts auf der Seite. Wenn du auf diesen Button klickst, wird ein simulierter "Admin-Bot" gerufen. Der Bot wird die **letzte von dir hochgeladene Datei** in seinem eigenen Browser besuchen.

4.  **Die Flagge einreichen:**
    Sobald du die Flagge (im Format `CTF{...}`) gefunden hast, kannst du sie auf der Startseite in das dafür vorgesehene Feld eingeben, um deine Lösung zu überprüfen.

---

Viel Erfolg bei der Erkundung!

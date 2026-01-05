import { NextResponse } from 'next/server';
import { exec } from 'child_process';

// Handles POST requests to call the bot to visit a URL.
export async function POST(request) {
    try {
        const body = await request.json();
        const urlToVisit = body.url;

        if (!urlToVisit) {
            return NextResponse.json({ error: 'Keine URL übergeben.' }, { status: 400 });
        }

        // Construct the command to execute the bot script with the URL.
        const command = `node bot.js "${urlToVisit}"`;
        console.log(`Starte Bot mit Befehl: ${command}`);

        // Execute the bot script as a child process.
        exec(command, (error, stdout, stderr) => {
            if (error) console.error(`Bot-Fehler: ${error.message}`);
            if (stderr) console.error(`Bot-Stderr: ${stderr}`);
            console.log(`Bot-Ausgabe: ${stdout}`);
        });

        // Immediately respond to the client.
        return NextResponse.json({ message: "Bot wurde gestartet und besucht deine Seite in Kürze!" });

    } catch (error) {
        console.error("Fehler in der call-bot API:", error);
        return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
    }
}

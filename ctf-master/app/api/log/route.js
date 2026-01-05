import { NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import path from 'path';

const FLAG_VALUE = 'CTF{SVG_ist_maechtiger_als_gedacht}';
const FLAG_FILE = path.join(process.cwd(), 'stolen_flag.json');

// Handles GET requests to log a stolen cookie.
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const stolenCookie = searchParams.get('cookie') || '';

  // Log the stolen cookie to the server console.
  console.log("\n\n" + "=".repeat(50));
  console.log("            [+] COOKIE GEKLAUT! [+] ");
  console.log(`            ${stolenCookie}`);
  console.log("=".repeat(50) + "\n\n");

  // If the stolen cookie contains the real flag, save it to a file.
  if (stolenCookie.includes(FLAG_VALUE)) {
    try {
      const data = JSON.stringify({ flag: FLAG_VALUE, timestamp: new Date().toISOString() });
      await writeFile(FLAG_FILE, data, 'utf-8');
      console.log('            [+] ECHTE FLAGGE GESPEICHERT! [+]');
    } catch (err) {
      console.error("Fehler beim Speichern der Flagge:", err);
    }
  }

  // Return a harmless response.
  return NextResponse.json({ status: 'ok' });
}

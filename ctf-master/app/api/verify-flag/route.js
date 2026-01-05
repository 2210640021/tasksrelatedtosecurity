import { NextResponse } from 'next/server';

const REAL_FLAG = 'CTF{SVG_ist_maechtiger_als_gedacht}';

// Handles POST requests to verify a submitted flag.
export async function POST(request) {
  try {
    const body = await request.json();
    const { submittedFlag } = body;

    if (!submittedFlag) {
      return NextResponse.json({ success: false, error: 'Keine Flagge übergeben.' }, { status: 400 });
    }

    if (submittedFlag.trim() === REAL_FLAG) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, error: 'Falsche Flagge.' });
    }

  } catch (error) {
    return NextResponse.json({ success: false, error: 'Ungültige Anfrage.' }, { status: 500 });
  }
}
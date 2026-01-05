import { NextResponse } from 'next/server';
import { readFile, unlink } from 'fs/promises';
import path from 'path';

const FLAG_FILE = path.join(process.cwd(), 'stolen_flag.json');

// Handles GET requests to retrieve the stolen flag.
export async function GET() {
  try {
    // Read the flag from the file.
    const data = await readFile(FLAG_FILE, 'utf-8');
    const flagData = JSON.parse(data);

    // Delete the file to ensure the flag can only be retrieved once.
    await unlink(FLAG_FILE);

    // Return the flag to the client.
    return NextResponse.json(flagData);
    
  } catch (error) {
    // If the file doesn't exist, it means the flag hasn't been stolen yet.
    return NextResponse.json({ flag: null }, { status: 404 });
  }
}
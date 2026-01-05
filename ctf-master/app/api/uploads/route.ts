import { readFile } from 'fs/promises';
import { NextResponse } from 'next/server';
import path from 'path';

// Handles GET requests to fetch the list of uploaded files.
export async function GET() {
  const uploadsFile = path.join(process.cwd(), 'uploads.json');
  try {
    const data = await readFile(uploadsFile, 'utf-8');
    const uploads = JSON.parse(data);
    return NextResponse.json(uploads);
  } catch {
    // If the file doesn't exist, return an empty array.
    return NextResponse.json([]);
  }
}
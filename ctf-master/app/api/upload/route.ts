import { writeFile, readFile } from "fs/promises";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

const UPLOADS_FILE = path.join(process.cwd(), "uploads.json");

// Saves the metadata of an uploaded file to the uploads.json file.
async function saveToUploadsList(fileUrl: string, fileName: string) {
  let uploads: any[] = [];
  try {
    const data = await readFile(UPLOADS_FILE, "utf-8");
    uploads = JSON.parse(data);
    if (!Array.isArray(uploads)) uploads = [];
  } catch {
    uploads = [];
  }

  uploads.unshift({ fileUrl, fileName, date: new Date().toISOString() });
  await writeFile(UPLOADS_FILE, JSON.stringify(uploads, null, 2), "utf-8");
}

// Handles POST requests to upload a file.
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei gefunden" }, { status: 400 });
    }

    // Create a safe filename to prevent directory traversal attacks.
    const timestamp = Date.now();
    const originalName = file.name || "upload";
    const safeName = `${timestamp}-${originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const uploadDir = path.join(process.cwd(), "public");
    const filePath = path.join(uploadDir, safeName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    const fileUrl = `/${safeName}`;
    await saveToUploadsList(fileUrl, safeName);

    return NextResponse.json({ success: true, url: fileUrl, fileName: safeName });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}
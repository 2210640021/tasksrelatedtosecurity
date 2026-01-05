import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { readFile, writeFile, unlink } from 'fs/promises';
import path from 'path';

// In-memory store for comments, reset on server restart.
let comments: Comment[] = [
  {
    id: "c1",
    author: "debugger_dan",
    text: "Ich habe einige Reaktionen ausprobiert und dabei den Bot ausgelöst. Er hat lediglich ein kurzesNope ausgegeben. Es wirkt so, als würde er nur reagieren, wenn ihm etwas Besonderes präsentiert wird. Bisher konnte ich das Verhalten nicht reproduzieren",
    avatarUrl: "fry.jpg",
    time: "vor 5 Minuten",
    removable: false,
  },
  {
    id: "c2",
    author: "cyber_nova",
    text: "Ich habe ein paar Uploads inspiziert. Einige verhalten sich exakt wie erwartet, andere lösen eine kurze Reaktion im Browser aus, die ich nicht erklären kann. Es sieht eigentlich nach Standarddaten aus, aber irgendetwas passiert im Hintergrund.",
    avatarUrl: "shego.jpg",
    time: "vor 11 Minuten",
    removable: false,
  },
];

type Comment = {
  id: string;
  author: string;
  text?: string;
  imgUrl?: string | null;
  avatarUrl?: string | null;
  time?: string;
  removable?: boolean;
};

// Handles GET requests to fetch all comments.
export async function GET() {
  return NextResponse.json(comments);
}

// Handles POST requests to add a new comment.
export async function POST(req: NextRequest) {
  const newComment = await req.json();
  comments.unshift(newComment); // Add new comment to the beginning
  return NextResponse.json({ success: true });
}

// Handles DELETE requests to remove a comment and its associated file.
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const imgUrl = searchParams.get("imgUrl");

  if (!id) {
    return NextResponse.json({ error: "Kein ID angegeben" }, { status: 400 });
  }

  // Remove comment from the in-memory array.
  const initialLength = comments.length;
  comments = comments.filter((c: Comment) => c.id !== id);
  if (comments.length === initialLength) {
    // Optionally, return an error if the comment was not found.
  }

  // If there is an associated image, delete it and its entry in uploads.json.
  if (imgUrl) {
    try {
      const uploadsJsonPath = path.join(process.cwd(), 'uploads.json');
      const uploadsData = await readFile(uploadsJsonPath, 'utf-8');
      let uploads = JSON.parse(uploadsData);

      const newUploads = uploads.filter((upload: any) => upload.fileUrl !== imgUrl);

      if (newUploads.length !== uploads.length) {
        await writeFile(uploadsJsonPath, JSON.stringify(newUploads, null, 2), 'utf-8');
        const filePath = path.join(process.cwd(), 'public', imgUrl);
        await unlink(filePath);
      }
    } catch (error) {
      console.error("Fehler beim Löschen der zugehörigen Datei:", error);
    }
  }

  return NextResponse.json({ success: true });
}

import RagFlashcardService from "../../services/rag-flashcards";
import Chunkies from "../../utils/database/chunkies";
import { embeddings } from "../../utils/llm/llm";
import { emitToAll } from "../../utils/chat/ws";
import { withTimeout } from "../../utils/quiz/promise";
import crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

const flashcardSessions = new Map<string, Set<any>>();
const flog = (...a: any) => console.log("[rag-flashcards]", ...a);

export function ragFlashcardRoutes(app: any) {
  // WebSocket for real-time streaming
  app.ws("/ws/rag-flashcards", (ws: any, req: any) => {
    const u = new URL(req.url, "http://localhost");
    const sessionId = u.searchParams.get("sessionId");
    if (!sessionId) return ws.close(1008, "sessionId required");

    let s = flashcardSessions.get(sessionId);
    if (!s) {
      s = new Set();
      flashcardSessions.set(sessionId, s);
    }
    s.add(ws);

    flog("ws open", sessionId, "clients:", s.size);
    ws.send(JSON.stringify({ type: "ready", sessionId }));

    ws.on("error", (e: any) => flog("ws err", sessionId, e?.message || e));
    ws.on("close", () => {
      s!.delete(ws);
      if (s!.size === 0) flashcardSessions.delete(sessionId);
      flog("ws close", sessionId, "left:", s!.size);
    });

    const iv = setInterval(() => {
      try {
        if (ws.readyState === 1)
          ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
      } catch {}
    }, 15000);
    ws.on("close", () => clearInterval(iv));
  });

  // POST: Generate flashcards from uploaded files
  app.post("/rag-flashcards/generate", async (req: any, res: any) => {
    try {
      const { topic, namespace, files, topK = 6, count = 10 } = req.body;

      if (!topic || !namespace) {
        return res.status(400).send({
          ok: false,
          error: "topic and namespace required"
        });
      }

      if (!files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).send({
          ok: false,
          error: "at least one file required"
        });
      }

      const sessionId = crypto.randomUUID();
      flog("start", sessionId, "topic:", topic, "files:", files.length);

      res.status(202).send({
        ok: true,
        sessionId,
        stream: `/ws/rag-flashcards?sessionId=${sessionId}`
      });

      setImmediate(async () => {
        try {
          const wsClients = flashcardSessions.get(sessionId);
          emitToAll(wsClients, { type: "phase", value: "indexing" });

          // Initialize services
          const chunkies = new Chunkies(embeddings);
          const service = new RagFlashcardService(chunkies);

          // Process and index files
          const documents = [];
          for (const file of files) {
            const text = Buffer.isBuffer(file.content)
              ? file.content.toString("utf-8")
              : String(file.content);

            documents.push({
              text,
              metadata: {
                source: file.name || "document",
                timestamp: Date.now()
              }
            });
          }

          await service.indexDocuments(documents, namespace);
          emitToAll(wsClients, { type: "phase", value: "generating" });

          // Generate flashcards
          const flashcards = await withTimeout(
            service.generateFlashcards({
              topic,
              namespace,
              topK,
              count
            }),
            60000,
            "generateFlashcards"
          );

          flog("generated", sessionId, "cards:", flashcards.length);
          emitToAll(wsClients, {
            type: "flashcards",
            flashcards,
            count: flashcards.length
          });
          emitToAll(wsClients, { type: "done" });
          flog("done", sessionId);
        } catch (e: any) {
          flog("error", sessionId, e?.message || e);
          emitToAll(flashcardSessions.get(sessionId), {
            type: "error",
            error: e?.message || "failed to generate flashcards"
          });
        }
      });
    } catch (e: any) {
      flog("500 route err", e?.message || e);
      res.status(500).send({
        ok: false,
        error: e?.message || "internal error"
      });
    }
  });

  // POST: Index documents for RAG
  app.post("/rag-flashcards/index", async (req: any, res: any) => {
    try {
      const { namespace, files } = req.body;

      if (!namespace || !files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).send({
          ok: false,
          error: "namespace and files required"
        });
      }

      flog("indexing", namespace, "files:", files.length);

      // Initialize services
      const chunkies = new Chunkies(embeddings);
      const service = new RagFlashcardService(chunkies);

      // Process files
      const documents = [];
      for (const file of files) {
        const text = Buffer.isBuffer(file.content)
          ? file.content.toString("utf-8")
          : String(file.content);

        documents.push({
          text,
          metadata: {
            source: file.name || "document",
            timestamp: Date.now()
          }
        });
      }

      const totalChunks = await service.indexDocuments(documents, namespace);

      res.send({
        ok: true,
        namespace,
        filesProcessed: files.length,
        chunksCreated: totalChunks
      });
    } catch (e: any) {
      flog("500 route err", e?.message || e);
      res.status(500).send({
        ok: false,
        error: e?.message || "internal error"
      });
    }
  });

  // GET: List indexed namespaces
  app.get("/rag-flashcards/namespaces", (req: any, res: any) => {
    try {
      const storagePath = path.join(process.cwd(), "storage", "chunkies");
      const namespaces: string[] = [];

      if (fs.existsSync(storagePath)) {
        const files = fs.readdirSync(storagePath);
        for (const file of files) {
          if (file.endsWith(".json")) {
            namespaces.push(file.replace(".json", ""));
          }
        }
      }

      res.send({
        ok: true,
        namespaces
      });
    } catch (e: any) {
      flog("500 route err", e?.message || e);
      res.status(500).send({
        ok: false,
        error: e?.message || "internal error"
      });
    }
  });
}

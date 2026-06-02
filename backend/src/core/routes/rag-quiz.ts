import RagQuizService from "../../services/rag-quiz";
import Chunkies from "../../utils/database/chunkies";
import { embeddings } from "../../utils/llm/llm";
import { emitToAll } from "../../utils/chat/ws";
import { withTimeout } from "../../utils/quiz/promise";
import crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

const quizSessions = new Map<string, Set<any>>();
const qlog = (...a: any) => console.log("[rag-quiz]", ...a);

export function ragQuizRoutes(app: any) {
  // WebSocket for real-time streaming
  app.ws("/ws/rag-quiz", (ws: any, req: any) => {
    const u = new URL(req.url, "http://localhost");
    const sessionId = u.searchParams.get("sessionId");
    if (!sessionId) return ws.close(1008, "sessionId required");

    let s = quizSessions.get(sessionId);
    if (!s) {
      s = new Set();
      quizSessions.set(sessionId, s);
    }
    s.add(ws);

    qlog("ws open", sessionId, "clients:", s.size);
    ws.send(JSON.stringify({ type: "ready", sessionId }));

    ws.on("error", (e: any) => qlog("ws err", sessionId, e?.message || e));
    ws.on("close", () => {
      s!.delete(ws);
      if (s!.size === 0) quizSessions.delete(sessionId);
      qlog("ws close", sessionId, "left:", s!.size);
    });

    const iv = setInterval(() => {
      try {
        if (ws.readyState === 1)
          ws.send(JSON.stringify({ type: "ping", t: Date.now() }));
      } catch {}
    }, 15000);
    ws.on("close", () => clearInterval(iv));
  });

  // POST: Generate quiz from uploaded files
  app.post("/rag-quiz/generate", async (req: any, res: any) => {
    try {
      const { topic, namespace, files, topK = 6 } = req.body;

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
      qlog("start", sessionId, "topic:", topic, "files:", files.length);

      res.status(202).send({
        ok: true,
        sessionId,
        stream: `/ws/rag-quiz?sessionId=${sessionId}`
      });

      setImmediate(async () => {
        try {
          const wsClients = quizSessions.get(sessionId);
          emitToAll(wsClients, { type: "phase", value: "indexing" });

          // Initialize services
          const chunkies = new Chunkies(embeddings);
          const service = new RagQuizService(chunkies);

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

          // Generate quiz
          const quiz = await withTimeout(
            service.generateQuiz({
              topic,
              namespace,
              topK,
              count: 5
            }),
            60000,
            "generateQuiz"
          );

          qlog("generated", sessionId, "questions:", quiz.length);
          emitToAll(wsClients, {
            type: "quiz",
            quiz,
            count: quiz.length
          });
          emitToAll(wsClients, { type: "done" });
          qlog("done", sessionId);
        } catch (e: any) {
          qlog("error", sessionId, e?.message || e);
          emitToAll(quizSessions.get(sessionId), {
            type: "error",
            error: e?.message || "failed to generate quiz"
          });
        }
      });
    } catch (e: any) {
      qlog("500 route err", e?.message || e);
      res.status(500).send({
        ok: false,
        error: e?.message || "internal error"
      });
    }
  });

  // POST: Index documents for RAG
  app.post("/rag-quiz/index", async (req: any, res: any) => {
    try {
      const { namespace, files } = req.body;

      if (!namespace || !files || !Array.isArray(files) || files.length === 0) {
        return res.status(400).send({
          ok: false,
          error: "namespace and files required"
        });
      }

      qlog("indexing", namespace, "files:", files.length);

      // Initialize services
      const chunkies = new Chunkies(embeddings);
      const service = new RagQuizService(chunkies);

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
      qlog("500 route err", e?.message || e);
      res.status(500).send({
        ok: false,
        error: e?.message || "internal error"
      });
    }
  });

  // GET: List indexed namespaces
  app.get("/rag-quiz/namespaces", (req: any, res: any) => {
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
      qlog("500 route err", e?.message || e);
      res.status(500).send({
        ok: false,
        error: e?.message || "internal error"
      });
    }
  });
}

-- Enable pgvector extension (must be run as superuser on Supabase dashboard first)
CREATE EXTENSION IF NOT EXISTS vector;

-- RAG Documents: uploaded document metadata
CREATE TABLE IF NOT EXISTS rag_documents (
  id            SERIAL PRIMARY KEY,
  category      TEXT NOT NULL DEFAULT 'misc'
                CHECK (category IN ('email_template', 'product_info', 'company_status', 'misc')),
  file_name     TEXT NOT NULL,
  file_type     TEXT NOT NULL,
  file_size     INT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'processing'
                CHECK (status IN ('processing', 'ready', 'error')),
  chunk_count   INT NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RAG Chunks: document chunks with embeddings
CREATE TABLE IF NOT EXISTS rag_chunks (
  id            SERIAL PRIMARY KEY,
  document_id   INT NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  embedding     vector(1536),
  chunk_index   INT NOT NULL DEFAULT 0,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding
  ON rag_chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_document_id
  ON rag_chunks(document_id);

-- Chat Conversations
CREATE TABLE IF NOT EXISTS chat_conversations (
  id          SERIAL PRIMARY KEY,
  title       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id                SERIAL PRIMARY KEY,
  conversation_id   INT NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role              TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content           TEXT NOT NULL,
  sources           JSONB DEFAULT '[]',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id
  ON chat_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
  ON chat_messages(created_at);

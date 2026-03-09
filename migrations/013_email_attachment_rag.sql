-- Link email attachments to RAG documents for auto-indexing
ALTER TABLE email_attachments ADD COLUMN IF NOT EXISTS rag_document_id INT REFERENCES rag_documents(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_email_attachments_rag ON email_attachments(rag_document_id) WHERE rag_document_id IS NOT NULL;

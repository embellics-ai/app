-- Migration: Rename tables for clarity
-- chat_messages → retell_transcript_messages (stores Retell's transcript from webhook)
-- widget_chat_messages → conversation_messages (stores real-time messages from all channels)

-- Rename chat_messages to retell_transcript_messages
ALTER TABLE chat_messages RENAME TO retell_transcript_messages;

-- Rename the index as well
ALTER INDEX chat_messages_chat_idx RENAME TO retell_transcript_messages_chat_idx;

-- Rename widget_chat_messages to conversation_messages
ALTER TABLE widget_chat_messages RENAME TO conversation_messages;

-- Note: Foreign key constraints automatically follow table renames in PostgreSQL
-- The constraint still points to chat_analytics correctly

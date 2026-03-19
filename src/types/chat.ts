export interface ChatConversation {
  id: string;
  subject: string;
  assignee: string;
  client: string | null;
  tags: string[];
  isVip: boolean;
  priority: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  url: string;
}

export interface ChatAttachment {
  url: string;
  name: string;
  contentType?: string;
  fileSize?: number;
}

export interface ChatMessage {
  id: string;
  author: string;
  authorType: "user" | "admin" | "bot";
  body: string; // HTML string from Intercom
  createdAt: string;
  isNote: boolean;
  attachments?: ChatAttachment[];
}

export interface ChatConversationDetail extends ChatConversation {
  messages: ChatMessage[];
  sourceType?: string; // "email" | "conversation" | "push" | etc.
}

import { ChatShell } from "./ChatShell";

export const metadata = {
  title: "Chat Proxy | Soporte 360",
};

export default function ChatPage() {
  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden">
      <ChatShell />
    </div>
  );
}

import { MessageSquare, Sparkles } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12">
      <div className="relative mb-6">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
          <MessageSquare className="h-10 w-10 text-primary" />
        </div>
        <div className="absolute -top-1 -right-1 h-8 w-8 rounded-full bg-primary flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
      </div>

      <h2 className="text-2xl font-semibold mb-2 text-center">Start a Conversation</h2>
      <p className="text-muted-foreground text-center max-w-md mb-6">
        Begin chatting with the AI assistant powered by Retell AI's Conversational Flow Agent. Ask
        questions, get help, or just have a conversation.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl w-full">
        <div className="rounded-lg border border-border bg-card p-4 hover-elevate cursor-pointer transition-all">
          <p className="text-sm font-medium mb-1">Ask a question</p>
          <p className="text-xs text-muted-foreground">Get instant answers to your queries</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 hover-elevate cursor-pointer transition-all">
          <p className="text-sm font-medium mb-1">Start a discussion</p>
          <p className="text-xs text-muted-foreground">Have a natural conversation with AI</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 hover-elevate cursor-pointer transition-all">
          <p className="text-sm font-medium mb-1">Get assistance</p>
          <p className="text-xs text-muted-foreground">Let the AI help you with tasks</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 hover-elevate cursor-pointer transition-all">
          <p className="text-sm font-medium mb-1">Explore features</p>
          <p className="text-xs text-muted-foreground">Discover what the AI can do</p>
        </div>
      </div>
    </div>
  );
}

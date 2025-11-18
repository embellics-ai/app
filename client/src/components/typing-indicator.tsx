export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex gap-1">
        <div
          className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: '0ms', animationDuration: '1s' }}
        />
        <div
          className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: '150ms', animationDuration: '1s' }}
        />
        <div
          className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: '300ms', animationDuration: '1s' }}
        />
      </div>
      <span className="ml-2 text-xs text-muted-foreground">AI is typing...</span>
    </div>
  );
}

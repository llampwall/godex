import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDictation } from "@/hooks/useDictation";
import { Mic, MicOff, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = "Type a message...",
  className,
}: MessageInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { isListening, transcript, isSupported, toggleListening, clearTranscript } =
    useDictation();

  // Append transcript to input when dictation produces results
  useEffect(() => {
    if (transcript) {
      setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      clearTranscript();
    }
  }, [transcript, clearTranscript]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || disabled) return;
    onSend(text);
    setInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1"
      />
      {isSupported && (
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleListening}
          disabled={disabled}
          className={cn("shrink-0", isListening && "text-destructive")}
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </Button>
      )}
      <Button
        onClick={handleSend}
        size="icon"
        disabled={disabled || !input.trim()}
        className="shrink-0"
      >
        {disabled ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Send className="w-4 h-4" />
        )}
      </Button>
    </div>
  );
}

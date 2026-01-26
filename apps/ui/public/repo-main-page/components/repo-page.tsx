"use client"

import React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  MoreVertical,
  FolderOpen,
  Code2,
  MessageSquare,
  Trash2,
  Bell,
  BellOff,
  BellRing,
  Send,
  Mic,
  GitBranch,
  GitCompare,
  TestTube2,
  Plus,
  ChevronDown,
  Star,
} from "lucide-react"

type NotifyMode = "never" | "input-needed" | "all"

interface Thread {
  id: string
  name: string
  date: string
  lastMessage: string
}

interface RepoPageProps {
  repoName: string
}

const notifyOptions: { value: NotifyMode; label: string; icon: typeof Bell }[] = [
  { value: "never", label: "Never", icon: BellOff },
  { value: "input-needed", label: "Input Needed", icon: Bell },
  { value: "all", label: "All", icon: BellRing },
]

const mockThreads: Thread[] = [
  {
    id: "1",
    name: "Auth Setup",
    date: "Jan 23",
    lastMessage: "Successfully configured JWT authentication with refresh tokens and secure cookie storage...",
  },
  {
    id: "2",
    name: "API Refactor",
    date: "Jan 22",
    lastMessage: "Migrated all endpoints to the new router pattern. Tests are passing, ready for review...",
  },
  {
    id: "3",
    name: "Database Migration",
    date: "Jan 20",
    lastMessage: "Created migration scripts for the new user preferences table. Rollback tested successfully...",
  },
]

const mockTerminalOutput = [
  { type: "system", content: "> Initializing repository..." },
  { type: "system", content: "> Installing dependencies..." },
  { type: "success", content: "✓ Dependencies installed successfully" },
  { type: "system", content: "> Running initial setup..." },
  { type: "agent", content: "I've set up the basic project structure with TypeScript and configured the build tools. What would you like me to work on first?" },
]

export function RepoPage({ repoName }: RepoPageProps) {
  const [notifyMode, setNotifyMode] = useState<NotifyMode>("input-needed")
  const [terminalInput, setTerminalInput] = useState("")
  const [threads, setThreads] = useState(mockThreads)
  const [isRecording, setIsRecording] = useState(false)
  const terminalEndRef = useRef<HTMLDivElement>(null)

  const repoPath = `P:\\software\\${repoName}`
  const currentNotify = notifyOptions.find((o) => o.value === notifyMode)!

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  const handleSend = () => {
    if (terminalInput.trim()) {
      console.log("Sending:", terminalInput)
      setTerminalInput("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleDeleteThread = (threadId: string) => {
    setThreads(threads.filter((t) => t.id !== threadId))
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex-1 min-w-0 mr-3">
          <p className="text-sm font-mono text-foreground truncate">{repoPath}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Notify Mode Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                <currentNotify.icon className="w-4 h-4" />
                <span className="text-xs hidden xs:inline">{currentNotify.label}</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border">
              {notifyOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setNotifyMode(option.value)}
                  className={cn(
                    "gap-2 cursor-pointer",
                    notifyMode === option.value && "bg-accent"
                  )}
                >
                  <option.icon className="w-4 h-4" />
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Menu Button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border">
              <DropdownMenuItem className="gap-2 cursor-pointer">
                <FolderOpen className="w-4 h-4" />
                Open folder
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer">
                <Code2 className="w-4 h-4" />
                Open in VS Code
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer">
                <MessageSquare className="w-4 h-4" />
                Open default thread
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                <Trash2 className="w-4 h-4" />
                Delete repo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
        {/* Main Thread - Terminal */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium text-foreground">Main Thread</span>
          </div>

          {/* Terminal Output */}
          <div className="bg-input border border-border rounded-lg h-48 overflow-y-auto p-3 font-mono text-sm">
            {mockTerminalOutput.map((line, i) => (
              <div
                key={i}
                className={cn(
                  "py-0.5",
                  line.type === "system" && "text-muted-foreground",
                  line.type === "success" && "text-green-500",
                  line.type === "agent" && "text-foreground mt-2"
                )}
              >
                {line.content}
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>

          {/* Terminal Input */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Input
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="bg-input border-border text-foreground placeholder:text-muted-foreground pr-10"
              />
              <button
                onClick={() => setIsRecording(!isRecording)}
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors",
                  isRecording
                    ? "text-red-500 bg-red-500/10"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
            <Button
              onClick={handleSend}
              disabled={!terminalInput.trim()}
              size="icon"
              className="bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-xs border-border text-muted-foreground hover:text-foreground hover:bg-secondary bg-transparent"
            >
              <GitBranch className="w-3.5 h-3.5" />
              git status
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-xs border-border text-muted-foreground hover:text-foreground hover:bg-secondary bg-transparent"
            >
              <GitCompare className="w-3.5 h-3.5" />
              git diff
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-xs border-border text-muted-foreground hover:text-foreground hover:bg-secondary bg-transparent"
            >
              <TestTube2 className="w-3.5 h-3.5" />
              run tests
            </Button>
          </div>
        </div>

        {/* Linked Threads Section */}
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Linked Threads</span>
            <span className="text-xs text-muted-foreground">{threads.length} threads</span>
          </div>

          {/* Scrollable Threads List */}
          <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px] max-h-[280px]">
            {threads.map((thread) => (
              <div
                key={thread.id}
                className="bg-input border border-border rounded-lg p-3 cursor-pointer hover:border-muted-foreground transition-colors group"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-foreground truncate">{thread.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{thread.date}</span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-1 rounded text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border-border">
                      <DropdownMenuItem className="gap-2 cursor-pointer">
                        <Star className="w-4 h-4" />
                        Make main thread
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteThread(thread.id)}
                        className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete thread
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{thread.lastMessage}</p>
              </div>
            ))}
          </div>

          {/* Link New Thread Button */}
          <Button
            variant="outline"
            className="w-full gap-2 border-dashed border-border text-muted-foreground hover:text-foreground hover:bg-secondary bg-transparent"
          >
            <Plus className="w-4 h-4" />
            Link new thread
          </Button>
        </div>
      </main>
    </div>
  )
}

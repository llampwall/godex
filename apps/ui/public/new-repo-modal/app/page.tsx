"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { NewRepoModal } from "@/components/new-repo-modal"
import { Plus } from "lucide-react"

export default function Page() {
  const [modalOpen, setModalOpen] = useState(true)

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-semibold text-foreground">Your Repositories</h1>
        <p className="text-muted-foreground max-w-md mx-auto">
          Create a new repository to get started with your next project
        </p>
        <Button
          onClick={() => setModalOpen(true)}
          className="bg-foreground text-background hover:bg-foreground/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Repository
        </Button>
      </div>

      <NewRepoModal open={modalOpen} onOpenChange={setModalOpen} />
    </main>
  )
}

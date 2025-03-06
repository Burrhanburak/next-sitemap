import { Progress } from "@/components/ui/progress"
import { Card } from "@/components/ui/card"

type Phase = {
  id: string
  label: string
  status: 'pending' | 'loading' | 'complete' | 'error'
}

interface CrawlerProgressProps {
  currentPhase: string
  phases: Phase[]
}

export function CrawlerProgress({ currentPhase, phases }: CrawlerProgressProps) {
  const currentIndex = phases.findIndex(p => p.id === currentPhase)
  const progress = ((currentIndex + 1) / phases.length) * 100

  return (
    <Card className="p-6">
      <Progress value={progress} className="mb-4" />
      <div className="space-y-2">
        {phases.map((phase) => {
          const isActive = phase.id === currentPhase
          const isComplete = phases.findIndex(p => p.id === currentPhase) > phases.findIndex(p => p.id === phase.id)
          
          return (
            <div
              key={phase.id}
              className={`flex items-center space-x-2 ${
                isActive ? 'text-primary' : isComplete ? 'text-muted-foreground' : 'text-muted'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${
                isComplete ? 'bg-primary' : isActive ? 'bg-primary animate-pulse' : 'bg-muted'
              }`} />
              <span>{phase.label}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
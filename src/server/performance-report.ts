import os from "node:os"
import type { EditingJob, RetouchStageMilliseconds } from "../shared/workflow.js"

const percentile = (values: number[], fraction: number): number | null => {
  if (values.length === 0) return null
  const sorted = values.toSorted((first, second) => first - second)
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]
}

export type PerformanceReport = {
  generatedAt: string
  hardware: { platform: string; release: string; cpu: string; logicalCores: number; memoryBytes: number }
  sampleSize: number
  representative: boolean
  previewMilliseconds: { p50: number | null; p95: number | null; maximum: number | null; target: number; passes: boolean | null }
  stageP95Milliseconds: RetouchStageMilliseconds & { development: number; export: number }
  routes: { cpu: number; gpu: number }
  openCl: "effective" | "inconclusive"
  bottleneck: string | null
}

export function performanceReport(jobs: EditingJob[]): PerformanceReport {
  const completed = jobs.filter((job) => job.metrics.previewMilliseconds !== null)
  const previewTimes = completed.map((job) => job.metrics.previewMilliseconds!)
  const stageNames = ["development", "analysis", "skin", "eyesTeeth", "facialLighting", "backdrop", "export"] as const
  const stages = Object.fromEntries(stageNames.map((stage) => [stage, percentile(completed.map((job) => job.metrics.stages[stage]), .95) ?? 0])) as PerformanceReport["stageP95Milliseconds"]
  const bottleneck = stageNames.toSorted((first, second) => stages[second] - stages[first])[0] ?? null
  const p95 = percentile(previewTimes, .95)
  return {
    generatedAt: new Date().toISOString(),
    hardware: { platform: os.platform(), release: os.release(), cpu: os.cpus()[0]?.model ?? "desconocida", logicalCores: os.cpus().length, memoryBytes: os.totalmem() },
    sampleSize: completed.length,
    representative: completed.length >= 20,
    previewMilliseconds: { p50: percentile(previewTimes, .5), p95, maximum: previewTimes.length ? Math.max(...previewTimes) : null, target: 30_000, passes: p95 === null ? null : p95 <= 30_000 },
    stageP95Milliseconds: stages,
    routes: { cpu: completed.filter((job) => job.metrics.processingRoute === "cpu").length, gpu: completed.filter((job) => job.metrics.processingRoute === "gpu").length },
    openCl: completed.some((job) => job.accelerationEvidence === "effective-opencl") ? "effective" : "inconclusive",
    bottleneck,
  }
}

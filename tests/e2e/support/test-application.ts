import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { FastifyInstance } from "fastify"
import type { Browser, BrowserContext, Page } from "@playwright/test"

import { createSmartStudioServer } from "../../../src/server/app.js"
import type { WorkflowState } from "../../../src/shared/workflow.js"
import type { PortraitFixture } from "../../../src/server/portrait-retoucher.js"
import type { SimulationProfile } from "../../../src/server/simulator.js"

type TestApplicationOptions = {
  testFeatures?: boolean
  path?: string
  editingProcessingDelayMilliseconds?: number
  editingDeliveryDelayMilliseconds?: number
  controlledPortraitFixture?: PortraitFixture
  simulatedCaptureProfile?: SimulationProfile
  controlledCleanPlatePersonDetected?: boolean
}

export class TestApplication {
  page!: Page
  private server!: FastifyInstance
  private context!: BrowserContext
  private address = ""

  private constructor(
    private readonly browser: Browser,
    private readonly dataDirectory: string,
    private readonly options: TestApplicationOptions,
  ) {}

  static async start(
    browser: Browser,
    temporaryPrefix: string,
    options: TestApplicationOptions = {},
  ): Promise<TestApplication> {
    const dataDirectory = await mkdtemp(path.join(tmpdir(), temporaryPrefix))
    const application = new TestApplication(browser, dataDirectory, options)
    await application.open()
    return application
  }

  async reopen(): Promise<void> {
    await this.context.close()
    await this.server.close()
    await this.open()
  }

  async close(): Promise<void> {
    await this.context.close().catch(() => undefined)
    await this.server.close().catch(() => undefined)
    await rm(this.dataDirectory, { recursive: true, force: true })
  }

  async state(): Promise<WorkflowState> {
    return this.page.evaluate(async () => {
      const response = await fetch("/api/state")
      return response.json()
    }) as Promise<WorkflowState>
  }

  async readDataFile(relativePath: string): Promise<Buffer> {
    return readFile(path.join(this.dataDirectory, relativePath))
  }

  async overwriteDataFile(relativePath: string, contents: Buffer): Promise<void> {
    await writeFile(path.join(this.dataDirectory, relativePath), contents)
  }

  async listDataFiles(): Promise<string[]> {
    const entries = await readdir(this.dataDirectory, { recursive: true, withFileTypes: true })
    return entries.filter((entry) => entry.isFile()).map((entry) => path.relative(this.dataDirectory, path.join(entry.parentPath, entry.name)))
  }

  private async open(): Promise<void> {
    this.server = await createSmartStudioServer({
      dataDirectory: this.dataDirectory,
      staticDirectory: path.resolve("dist/client"),
      testFeatures: this.options.testFeatures,
      editingProcessingDelayMilliseconds: this.options.editingProcessingDelayMilliseconds,
      editingDeliveryDelayMilliseconds: this.options.editingDeliveryDelayMilliseconds,
      controlledPortraitFixture: this.options.controlledPortraitFixture,
      simulatedCaptureProfile: this.options.simulatedCaptureProfile,
      controlledCleanPlatePersonDetected: this.options.controlledCleanPlatePersonDetected,
    })
    this.address = await this.server.listen({ host: "127.0.0.1", port: 0 })
    this.context = await this.browser.newContext()
    this.page = await this.context.newPage()
    const destination = new URL(this.options.path ?? "/", `${this.address}/`)
    destination.searchParams.set("simulated-controls", "1")
    await this.page.goto(destination.toString())
  }
}

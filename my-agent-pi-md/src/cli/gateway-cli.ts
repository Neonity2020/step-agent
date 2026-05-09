// ============================================================
// Gateway CLI - API 网关启动器
// ============================================================

import { GatewayServer, createAPIKey, listAPIKeys } from "../gateway"
import { color } from "../tui/colors"

interface GatewayOptions {
  port?: number
  host?: string
  logging?: boolean
}

async function main() {
  const args = Bun.argv.slice(2)

  // 解析参数
  const options: GatewayOptions = {}
  
  for (const arg of args) {
    if (arg.startsWith("--port=")) {
      options.port = parseInt(arg.split("=")[1], 10)
    } else if (arg.startsWith("--host=")) {
      options.host = arg.split("=")[1]
    } else if (arg === "--no-logging") {
      options.logging = false
    } else if (arg === "--help" || arg === "-h") {
      printHelp()
      return
    }
  }

  printBanner()

  // 创建默认 API Key（如果还没有）
  const existingKeys = listAPIKeys()
  if (existingKeys.length === 0) {
    console.log(color("\n🔑 Creating default API Key...", "yellow"))
    const key = createAPIKey("Default Key", [
      "chat:send",
      "chat:read",
      "session:create",
      "session:read",
      "session:list",
      "model:list",
      "stats:read",
    ])
    console.log(color("\n⚠️  Save your API Key (only shown once):", "yellow"))
    console.log(color(`\n   ${key.key}\n`, "cyan"))
    console.log(color("   You can create more keys with:", "dim"))
    console.log(color("   curl -X POST http://localhost:8080/api/keys \\\n", "dim"))
    console.log(color('     -H "Authorization: Bearer <admin-key>" \\\n', "dim"))
    console.log(color('     -H "Content-Type: application/json" \\\n', "dim"))
    console.log(color('     -d \'{"name": "my-app", "permissions": ["chat:send"]}\'\n', "dim"))
  }

  // 创建并启动网关
  const gateway = new GatewayServer({
    port: options.port || 8080,
    host: options.host || "localhost",
    logging: options.logging !== false,
  })

  gateway.start()

  // 打印 API 文档
  printAPIDocs()
}

function printBanner(): void {
  console.log(color(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   ██████╗ ██████╗ ███████╗██╗███████╗██╗ ██████╗ ███╗   ██╗  ║
║   ██╔══██╗██╔══██╗██╔════╝██║██╔════╝██║██╔═══██╗████╗  ██║  ║
║   ██████╔╝██████╔╝███████╗██║███████╗██║██║   ██║██╔██╗ ██║  ║
║   ██╔══██╗██║  ██║╚════██║██║╚════██║██║██║   ██║██║╚██╗██║  ║
║   ██████╔╝██║  ██║███████║██║███████║██║╚██████╔╝██║ ╚████║  ║
║   ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝  ║
║                                                           ║
║   API Gateway Server                                       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
`, "cyan"))
}

function printHelp(): void {
  console.log(`
${color("Usage:", "yellow")} gateway [options]

${color("Options:", "yellow")}
  --port=<port>     Set port (default: 8080)
  --host=<host>     Set host (default: localhost)
  --no-logging      Disable request logging
  --help, -h        Show this help

${color("Examples:", "yellow")}
  gateway --port=3000 --host=0.0.0.0
  gateway --no-logging

${color("API Endpoints:", "yellow")}
  POST /api/chat       Send a message
  GET  /api/chat/:id   Get chat history
  GET  /api/sessions    List sessions
  POST /api/sessions    Create session
  GET  /api/models      List models
  GET  /api/stats       Get statistics
  GET  /health         Health check

${color("Authentication:", "yellow")}
  Include API key in header:
    Authorization: Bearer <your-api-key>
  Or in header:
    X-API-Key: <your-api-key>
`)
}

function printAPIDocs(): void {
  console.log(color("\n📚 API Documentation\n", "yellow"))

  console.log(color("Endpoints:", "cyan"))
  console.log(color("─────────────────────────────────────────────────────────────", "dim"))

  const endpoints = [
    { method: "GET", path: "/health", desc: "Health check" },
    { method: "POST", path: "/api/chat", desc: "Send chat message" },
    { method: "GET", path: "/api/chat/:sessionId", desc: "Get chat history" },
    { method: "GET", path: "/api/sessions", desc: "List sessions" },
    { method: "POST", path: "/api/sessions", desc: "Create session" },
    { method: "DELETE", path: "/api/sessions/:sessionId", desc: "Delete session" },
    { method: "GET", path: "/api/models", desc: "List available models" },
    { method: "GET", path: "/api/stats", desc: "Get API statistics" },
  ]

  for (const ep of endpoints) {
    const method = color(ep.method.padEnd(8), "green")
    const path = ep.path.padEnd(35)
    console.log(`  ${method} ${path} ${ep.desc}`)
  }

  console.log(color("─────────────────────────────────────────────────────────────\n", "dim"))

  console.log(color("Example Request:", "yellow"))
  console.log(color(`
curl -X POST http://localhost:8080/api/chat \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <your-api-key>" \\
  -d '{"message": "Hello!", "sessionId": "sess_123"}'
`, "dim"))

  console.log(color("Response:", "yellow"))
  console.log(color(`
{
  "success": true,
  "data": {
    "sessionId": "sess_123",
    "messageId": "msg_xxx",
    "content": "Hello! How can I help you?"
  },
  "meta": {
    "requestId": "req_xxx",
    "timestamp": 1234567890
  }
}
`, "dim"))
}

main().catch(console.error)

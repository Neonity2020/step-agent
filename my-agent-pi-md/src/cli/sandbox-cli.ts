// ============================================================
// Sandbox CLI Commands - 沙箱命令处理器
// ============================================================

import { color } from "../tui/colors"
import { SandboxManager, listPolicies } from "../sandbox"
import { getCurrentModel, selectModelFull } from "../providers"

// 沙箱管理器（全局实例）
let sandboxManager: SandboxManager | null = null

// 获取或创建沙箱管理器
function getSandbox(): SandboxManager {
  if (!sandboxManager) {
    sandboxManager = new SandboxManager({
      enabled: true,
      defaultPolicy: "balanced",
      workspaceRoot: process.cwd(),
    })
  }
  return sandboxManager
}

// 设置沙箱管理器
export function setSandboxManager(manager: SandboxManager): void {
  sandboxManager = manager
}

// /sandbox 命令处理
export function handleSandboxCommand(args: string[]): void {
  const sandbox = getSandbox()
  const subcmd = args[0]?.toLowerCase()

  switch (subcmd) {
    case "status":
      printSandboxStatus(sandbox)
      break

    case "list":
    case "ls":
      listSandboxPolicies(sandbox)
      break

    case "set":
      setSandboxPolicy(sandbox, args[1])
      break

    case "enable":
      sandbox.enable()
      console.log(color("\n✅ Sandbox enabled", "green"))
      break

    case "disable":
      sandbox.disable()
      console.log(color("\n⚠️  Sandbox disabled - commands will run without protection!", "yellow"))
      break

    case "dryrun":
      sandbox.setDryRun(true)
      console.log(color("\n🔵 Dry run mode enabled - commands will be simulated", "blue"))
      break

    case "live":
      sandbox.setDryRun(false)
      console.log(color("\n⚫ Live mode - commands will actually execute", "green"))
      break

    case "report":
      sandbox.printReport()
      break

    case "clear":
      sandbox.clearLogs()
      console.log(color("\n✅ Logs cleared", "green"))
      break

    case "test":
      testSandbox(sandbox, args.slice(1).join(" "))
      break

    default:
      printSandboxHelp()
  }
}

// 打印沙箱状态
function printSandboxStatus(sandbox: SandboxManager): void {
  const policy = sandbox.getPolicy()
  const config = sandbox.getConfig()

  console.log(color("\n┌────────────────────────────────────────────────────────────┐", "cyan"))
  console.log(color("│", "cyan") + color(" Sandbox Status".padEnd(60) + "│", "cyan"))
  console.log(color("├────────────────────────────────────────────────────────────┤", "cyan"))
  console.log(color("│", "cyan") + color(` Status: ${sandbox.isEnabled() ? "🟢 Enabled" : "🔴 Disabled"}`.padEnd(60) + "│", "white"))
  console.log(color("│", "cyan") + color(` Policy: ${policy.name} (${policy.id})`.padEnd(60) + "│", "white"))
  console.log(color("│", "cyan") + color(` Mode: ${config.dryRun ? "🔵 Dry Run" : "⚫ Live"}`.padEnd(60) + "│", "white"))
  console.log(color("├────────────────────────────────────────────────────────────┤", "cyan"))
  console.log(color("│", "cyan") + color(" Security Level".padEnd(60) + "│", "white"))
  console.log(color("│", "cyan") + color(` • ${policy.description}`.padEnd(60) + "│", "dim"))
  
  if (policy.blockedCommands.length > 0) {
    console.log(color("│", "cyan") + color(` • ${policy.blockedCommands.length} blocked commands`.padEnd(60) + "│", "yellow"))
  }
  
  if (policy.maxExecutionTime) {
    console.log(color("│", "cyan") + color(` • Max execution: ${policy.maxExecutionTime / 1000}s`.padEnd(60) + "│", "dim"))
  }
  
  if (policy.maxFileSize) {
    console.log(color("│", "cyan") + color(` • Max file size: ${(policy.maxFileSize / 1024 / 1024).toFixed(1)}MB`.padEnd(60) + "│", "dim"))
  }

  console.log(color("├────────────────────────────────────────────────────────────┤", "cyan"))
  console.log(color("│", "cyan") + color(" Events".padEnd(60) + "│", "white"))
  
  const events = sandbox.getEvents()
  const blocked = events.filter(e => e.type === "blocked").length
  const warnings = events.filter(e => e.type === "warning").length
  
  console.log(color("│", "cyan") + color(` Total: ${events.length} | Blocked: ${blocked} | Warnings: ${warnings}`.padEnd(60) + "│", "white"))

  console.log(color("├────────────────────────────────────────────────────────────┤", "cyan"))
  console.log(color("│", "cyan") + color(" /sandbox set <policy> | /sandbox test <cmd>".padEnd(60) + "│", "dim"))
  console.log(color("└────────────────────────────────────────────────────────────┘", "cyan"))
}

// 列出策略
function listSandboxPolicies(sandbox: SandboxManager): void {
  const policies = listPolicies()
  const currentId = sandbox.getPolicy().id

  console.log(color("\n┌────────────────────────────────────────────────────────────┐", "cyan"))
  console.log(color("│", "cyan") + color(" Available Security Policies".padEnd(60) + "│", "cyan"))
  console.log(color("├────────────────────────────────────────────────────────────┤", "cyan"))

  for (const p of policies) {
    const marker = p.id === currentId ? color(" ◄", "green") : ""
    const selected = p.id === currentId ? color("●", "green") : color("○", "dim")

    console.log(color("│", "cyan") + color(` ${selected} ${p.id.padEnd(15)} ${p.name.padEnd(15)} ${marker}`.padEnd(60) + "│", "white"))
    console.log(color("│", "cyan") + color(`   ${p.description}`.padEnd(60) + "│", "dim"))
  }

  console.log(color("├────────────────────────────────────────────────────────────┤", "cyan"))
  console.log(color("│", "cyan") + color(" Usage: /sandbox set <policy-id>".padEnd(60) + "│", "dim"))
  console.log(color("└────────────────────────────────────────────────────────────┘", "cyan"))
}

// 设置策略
function setSandboxPolicy(sandbox: SandboxManager, policyId?: string): void {
  if (!policyId) {
    console.log(color("\n❌ Policy ID required", "red"))
    console.log(color("Usage: /sandbox set <policy-id>", "dim"))
    listSandboxPolicies(sandbox)
    return
  }

  const success = sandbox.setPolicy(policyId)

  if (success) {
    const policy = sandbox.getPolicy()
    console.log(color("\n✅ Sandbox policy changed to:", "green"))
    console.log(color(`   ${policy.name} - ${policy.description}`, "white"))
  } else {
    console.log(color(`\n❌ Unknown policy: ${policyId}`, "red"))
    listSandboxPolicies(sandbox)
  }
}

// 测试沙箱
async function testSandbox(sandbox: SandboxManager, command?: string): Promise<void> {
  if (!command) {
    console.log(color("\nUsage: /sandbox test <command>", "dim"))
    console.log(color("\nExample: /sandbox test ls -la", "dim"))
    return
  }

  console.log(color(`\n🔍 Testing command: ${command}`, "cyan"))
  console.log(color("─".repeat(50), "dim"))

  const result = await sandbox.executeCommand(command)

  if (result.blocked) {
    console.log(color("\n⛔ BLOCKED", "red"))
    console.log(color(`Reason: ${result.blockedReason}`, "yellow"))
  } else {
    console.log(color("\n✅ ALLOWED", "green"))
    console.log(`Exit code: ${result.exitCode}`)
    if (result.stdout) {
      console.log("\n--- STDOUT ---")
      console.log(result.stdout)
    }
    if (result.stderr) {
      console.log("\n--- STDERR ---")
      console.log(color(result.stderr, "yellow"))
    }
  }
}

// 打印帮助
function printSandboxHelp(): void {
  console.log(`
${color("┌────────────────────────────────────────────────────────────┐", "cyan")}
${color("│", "cyan")}  ${color("Sandbox Commands", "white")}                                             ${color("│", "cyan")}
${color("├────────────────────────────────────────────────────────────┤", "cyan")}
${color("│", "cyan")}  ${color("/sandbox status", "white").padEnd(20)} Show sandbox status and stats         ${color("│", "cyan")}
${color("│", "cyan")}  ${color("/sandbox list", "white").padEnd(20)} List available security policies     ${color("│", "cyan")}
${color("│", "cyan")}  ${color("/sandbox set <policy>", "white").padEnd(20)} Change security policy          ${color("│", "cyan")}
${color("│", "cyan")}  ${color("/sandbox enable", "white").padEnd(20)} Enable sandbox protection          ${color("│", "cyan")}
${color("│", "cyan")}  ${color("/sandbox disable", "white").padEnd(20)} Disable sandbox (DANGEROUS)       ${color("│", "cyan")}
${color("│", "cyan")}  ${color("/sandbox dryrun", "white").padEnd(20)} Simulate without executing       ${color("│", "cyan")}
${color("│", "cyan")}  ${color("/sandbox live", "white").padEnd(20)} Execute for real                  ${color("│", "cyan")}
${color("│", "cyan")}  ${color("/sandbox report", "white").padEnd(20)} Print security report            ${color("│", "cyan")}
${color("│", "cyan")}  ${color("/sandbox test <cmd>", "white").padEnd(20)} Test a command safely          ${color("│", "cyan")}
${color("│", "cyan")}  ${color("/sandbox clear", "white").padEnd(20)} Clear event logs                 ${color("│", "cyan")}
${color("└────────────────────────────────────────────────────────────┘", "cyan")}

${color("Security Policies:", "yellow")}
  strict      - Maximum security, minimal permissions
  balanced    - Good security with reasonable flexibility (default)
  development - For development - allows most operations
  admin       - Full access - use with caution
  readonly    - Cannot modify any files
  git         - Safe git operations only
`)
}

// 导出
export { getSandbox }

import { useState, useEffect } from "react";
import { Key, Copy, Check, Plus, Trash2, Bot, RefreshCw, Sparkles } from "lucide-react";
import { webrader } from "@/api/webraderClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import SectionCard from "@/components/common/SectionCard";
import { formatDate } from "@/lib/format";

export default function McpApiKeysPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userEmail = user?.email || "";

  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState("");

  useEffect(() => {
    loadKeys();
  }, [userEmail]);

  const loadKeys = async () => {
    if (!userEmail) return;
    setLoading(true);
    try {
      const res = await webrader.functions.invoke("apiKey", {
        action: "get_keys",
        email: userEmail,
      });

      if (res?.data?.ok) {
        setKeys(res.data.keys || []);
      }
    } catch (err) {
      console.warn("Failed to load API keys:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateKey = async (e) => {
    e.preventDefault();
    if (!userEmail) return;
    setGenerating(true);
    try {
      const res = await webrader.functions.invoke("apiKey", {
        action: "generate_key",
        email: userEmail,
        user_id: user?.id,
        name: keyName.trim() || "Data Board AI Key",
      });

      if (res?.data?.ok) {
        setNewlyCreatedKey(res.data.key);
        setKeyName("");
        toast({
          title: "API Key Created",
          description: "Copy your new API key now. It will not be shown in full again.",
        });
        await loadKeys();
      } else {
        throw new Error(res?.data?.error || "Failed to generate key.");
      }
    } catch (err) {
      toast({
        title: "Creation failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleRevokeKey = async (keyId) => {
    if (!confirm("Are you sure you want to revoke this API key? Any connected AI clients using it will lose access.")) {
      return;
    }

    try {
      const res = await webrader.functions.invoke("apiKey", {
        action: "revoke_key",
        key_id: keyId,
      });

      if (res?.data?.ok) {
        toast({
          title: "API key revoked",
          description: "The key has been deactivated.",
        });
        await loadKeys();
      } else {
        throw new Error(res?.data?.error || "Failed to revoke key.");
      }
    } catch (err) {
      toast({
        title: "Revocation failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedSnippet(label);
    toast({
      title: "Copied to clipboard",
      description: `${label} copied.`,
    });
    setTimeout(() => setCopiedSnippet(""), 2000);
  };

  // Active Key representation for config snippets (DataBull tokenized architecture)
  const activeRawKey = newlyCreatedKey || keys.find((k) => k.key)?.key || keys[0]?.key || "";
  const activeKeySample = activeRawKey || "dp_live_your_key_here";
  const origin = typeof window !== "undefined" ? window.location.origin : "https://gurukalyan.vercel.app";
  const hostedMcpUrl = `${origin}/mcp?key=${activeKeySample}`;

  const claudeConfigSnippet = JSON.stringify(
    {
      mcpServers: {
        databoard: {
          command: "npx",
          args: [
            "-y",
            "mcp-remote",
            hostedMcpUrl,
          ],
        },
      },
    },
    null,
    2
  );

  const cursorSnippet = `Name: databoard
Type: sse
URL: ${hostedMcpUrl}`;

  return (
    <div className="space-y-6">
      {/* 1. Lifetime Pro MCP Header */}
      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-heading text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Model Context Protocol (MCP) Integration
            </span>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px]">
              Lifetime Pro Feature
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
            Query your live visitor traffic, top referral sources, conversion goals, and monitor uptime directly inside Claude, Cursor, Windsurf, or ChatGPT using natural language.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-xs py-1 px-2.5">
            MCP Protocol v1.0
          </Badge>
        </div>
      </div>

      {/* 2. Hosted Cloud MCP Endpoint Card (DataBull Tokenized Architecture) */}
      <div className="rounded-xl border border-blue-500/30 bg-card p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            Your Hosted Cloud MCP Server URL
          </span>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
            Ready to Connect
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Use this personal tokenized URL to connect ChatGPT, Claude Desktop, or Cursor directly in seconds with <b>zero developer configuration</b>.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground select-all border border-border truncate">
            {hostedMcpUrl}
          </code>
          <Button
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(hostedMcpUrl);
              setCopiedKey(true);
              setTimeout(() => setCopiedKey(false), 2000);
              toast({ title: "Hosted MCP URL Copied!", description: "Paste this directly into ChatGPT or Claude Desktop." });
            }}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 gap-1.5 shrink-0"
          >
            {copiedKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedKey ? "Copied" : "Copy URL"}</span>
          </Button>
        </div>
      </div>

      {/* 3. Newly Created Key Notification */}
      {newlyCreatedKey && (
        <div className="rounded-xl border border-blue-500/30 bg-card p-4 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              Your New API Key (Save it now)
            </span>
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">
              Shown Only Once
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Copy this key and paste it into your Claude Desktop, Cursor, or ChatGPT configuration.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-muted px-3 py-1.5 font-mono text-xs text-foreground select-all border border-border">
              {newlyCreatedKey}
            </code>
            <Button
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(newlyCreatedKey);
                setCopiedKey(true);
                setTimeout(() => setCopiedKey(false), 2000);
                toast({ title: "API Key Copied!" });
              }}
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 gap-1.5 shrink-0"
            >
              {copiedKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedKey ? "Copied" : "Copy Key"}</span>
            </Button>
          </div>
        </div>
      )}

      {/* 3. API Keys Management Section */}
      <SectionCard
        title="API Keys"
        description="Personal authentication keys for your AI assistants and external integrations."
      >
        <form onSubmit={handleGenerateKey} className="flex flex-col sm:flex-row items-center gap-3 mb-5">
          <div className="relative flex-1 w-full">
            <Input
              type="text"
              placeholder="Key label (e.g. Claude Desktop, Cursor, Personal Bot)..."
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <Button
            type="submit"
            disabled={generating}
            className="w-full sm:w-auto h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 inline-flex items-center gap-1.5 shrink-0"
          >
            {generating ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            <span>Generate New API Key</span>
          </Button>
        </form>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-xs">Loading keys...</span>
          </div>
        ) : keys.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-border rounded-xl p-4">
            <Key className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1.5" />
            <p className="text-xs font-medium text-foreground">No API Keys Generated Yet</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Click &quot;Generate New API Key&quot; above to connect your AI coding tools and assistants.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Key Preview</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-xs">
                {keys.map((k) => (
                  <tr key={k.key_id} className="hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-foreground">{k.name}</td>
                    <td className="py-2.5 px-3 font-mono text-muted-foreground text-[11px]">
                      {k.masked_key}
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                      {formatDate(k.created_at)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevokeKey(k.key_id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Revoke key"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* 4. AI Assistant Setup Guides (Claude, Cursor, ChatGPT) */}
      <SectionCard
        title="Connect to Your AI Assistant"
        description="Choose your preferred AI client below for step-by-step 1-click configuration."
      >
        <Tabs defaultValue="chatgpt-mcp" className="space-y-4">
          <TabsList className="inline-flex h-9 items-center justify-start gap-1 rounded-lg bg-muted/60 border border-border p-1 text-muted-foreground">
            <TabsTrigger value="chatgpt-mcp" className="text-xs px-3 py-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              ChatGPT (10s Setup)
            </TabsTrigger>
            <TabsTrigger value="claude" className="text-xs px-3 py-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Claude Desktop
            </TabsTrigger>
            <TabsTrigger value="cursor" className="text-xs px-3 py-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Cursor / Windsurf
            </TabsTrigger>
            <TabsTrigger value="chatgpt" className="text-xs px-3 py-1 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Custom GPT (OAuth)
            </TabsTrigger>
          </TabsList>

          {/* Guide A: ChatGPT Direct (DataBull Method) */}
          <TabsContent value="chatgpt-mcp" className="space-y-3">
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 space-y-1.5 text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Zero-Config Connection (DataBull Tokenized Method)
              </span>
              <p className="text-muted-foreground leading-relaxed text-[11px]">
                No OAuth credentials or client secrets needed. Paste your hosted URL and select &ldquo;None&rdquo; for authentication.
              </p>
            </div>

            <ol className="list-decimal list-inside space-y-2 text-xs text-muted-foreground">
              <li>In ChatGPT, open <b>Add custom MCP server</b> (or Plugins).</li>
              <li>
                Under <b>Connection &gt; Server URL</b>, paste:
                <code className="block mt-1 p-2 rounded bg-muted text-[11px] font-mono text-foreground border border-border select-all">
                  {hostedMcpUrl}
                </code>
              </li>
              <li>Under <b>Authentication</b>, select <b>None</b> (No authentication).</li>
              <li>Check the confirmation checkbox and click <b>Create as a plugin</b>.</li>
            </ol>
          </TabsContent>

          {/* Guide A: Claude Desktop */}
          <TabsContent value="claude" className="space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add Data Board to Claude Desktop by opening <b>Settings → Developer → Edit Config</b> (or editing <code>claude_desktop_config.json</code>) and adding the configuration below. It uses <code>npx mcp-remote</code> to instantly connect Claude to your cloud data with <b>zero local setup</b>:
            </p>
            <div className="relative">
              <pre className="p-3.5 rounded-xl bg-muted/70 border border-border font-mono text-xs overflow-x-auto text-foreground">
                {claudeConfigSnippet}
              </pre>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(claudeConfigSnippet, "Claude Desktop configuration")}
                className="absolute top-2.5 right-2.5 h-7 text-[11px] gap-1 bg-background"
              >
                {copiedSnippet === "Claude Desktop configuration" ? <Check className="h-3 w-3 text-blue-600" /> : <Copy className="h-3 w-3" />}
                <span>{copiedSnippet === "Claude Desktop configuration" ? "Copied" : "Copy JSON"}</span>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tip: After saving <code>claude_desktop_config.json</code>, restart Claude Desktop. You will see a hammer icon 🔨 indicating Data Board tools are ready to query.
            </p>
          </TabsContent>

          {/* Guide B: Cursor / Windsurf */}
          <TabsContent value="cursor" className="space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              In <b>Cursor Settings → Features → MCP</b>, click <b>Add New MCP Server</b> and enter:
            </p>
            <div className="relative">
              <pre className="p-3.5 rounded-xl bg-muted/70 border border-border font-mono text-xs overflow-x-auto text-foreground">
                {cursorSnippet}
              </pre>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(cursorSnippet, "Cursor configuration")}
                className="absolute top-2.5 right-2.5 h-7 text-[11px] gap-1 bg-background"
              >
                {copiedSnippet === "Cursor configuration" ? <Check className="h-3 w-3 text-blue-600" /> : <Copy className="h-3 w-3" />}
                <span>{copiedSnippet === "Cursor configuration" ? "Copied" : "Copy Config"}</span>
              </Button>
            </div>
          </TabsContent>

          {/* Guide C: ChatGPT (Custom GPT) */}
          <TabsContent value="chatgpt" className="space-y-4">
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 space-y-1.5 text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                1-Click OAuth Login (No API Keys or Schemas Needed)
              </span>
              <p className="text-muted-foreground leading-relaxed text-[11px]">
                Users simply open your official Data Board GPT, click <b>&ldquo;Log in with Data Board&rdquo;</b>, enter their email, and ChatGPT is instantly authorized.
              </p>
            </div>

            <div className="rounded-xl border border-border p-3.5 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">OpenAPI Specification URL:</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard("https://gurukalyan.vercel.app/openapi.json", "OpenAPI URL")}
                  className="h-7 text-[11px] gap-1"
                >
                  {copiedSnippet === "OpenAPI URL" ? <Check className="h-3 w-3 text-blue-600" /> : <Copy className="h-3 w-3" />}
                  <span>{copiedSnippet === "OpenAPI URL" ? "Copied" : "Copy URL"}</span>
                </Button>
              </div>
              <code className="block p-2 rounded bg-muted text-[11px] font-mono text-foreground border border-border">
                https://gurukalyan.vercel.app/openapi.json
              </code>

              <div className="border-t border-border pt-2.5 space-y-1.5">
                <span className="font-semibold text-foreground block text-[11px]">1-Time Custom GPT OAuth Settings:</span>
                <div className="grid gap-2 text-[11px] sm:grid-cols-2">
                  <div className="p-2 rounded bg-muted/50 border border-border">
                    <span className="text-muted-foreground block text-[10px] uppercase">Auth URL</span>
                    <span className="font-mono text-foreground">https://gurukalyan.vercel.app/api/oauth/authorize</span>
                  </div>
                  <div className="p-2 rounded bg-muted/50 border border-border">
                    <span className="text-muted-foreground block text-[10px] uppercase">Token URL</span>
                    <span className="font-mono text-foreground">https://gurukalyan.vercel.app/api/oauth/token</span>
                  </div>
                  <div className="p-2 rounded bg-muted/50 border border-border">
                    <span className="text-muted-foreground block text-[10px] uppercase">Client ID</span>
                    <span className="font-mono text-foreground">databoard-chatgpt</span>
                  </div>
                  <div className="p-2 rounded bg-muted/50 border border-border">
                    <span className="text-muted-foreground block text-[10px] uppercase">Client Secret</span>
                    <span className="font-mono text-foreground">dp_sec_7f9b2a1c8e3d4f56a0b1c2d3e4f5a6b7</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SectionCard>

      {/* 5. Natural Language Prompt Examples */}
      <SectionCard
        title="Example Prompts to Try in Your AI Assistant"
        description="Once connected, you can ask Claude or Cursor questions in plain English:"
      >
        <div className="grid gap-2.5 sm:grid-cols-2">
          {[
            "How many visitors visited my website today?",
            "What were my top 5 traffic referral sources this week?",
            "Are there any live active visitors browsing my site right now?",
            "Check my website uptime and average response latency",
            "What were my top viewed landing pages in the last 7 days?",
            "Show my conversion goals and revenue generated this month",
          ].map((promptText, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors text-xs text-foreground group"
            >
              <span className="truncate mr-2">&ldquo;{promptText}&rdquo;</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(promptText, `Prompt ${i + 1}`)}
                className="h-6 w-6 p-0 opacity-60 group-hover:opacity-100"
                title="Copy prompt"
              >
                {copiedSnippet === `Prompt ${i + 1}` ? <Check className="h-3 w-3 text-blue-600" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

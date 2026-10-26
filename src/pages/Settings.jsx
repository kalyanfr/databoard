import PageHeader from "@/components/common/PageHeader";
import SectionCard from "@/components/common/SectionCard";
import ThemeToggle from "@/components/layout/ThemeToggle";
import NotificationPrefs from "@/components/settings/NotificationPrefs";
import TelegramAlertsPanel from "@/components/settings/TelegramAlertsPanel";
import McpApiKeysPanel from "@/components/settings/McpApiKeysPanel";
import ProfileForm from "@/components/settings/ProfileForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LogOut, Send, Bell, User, Palette, Bot } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useAppConfig } from "@/lib/appConfig";

export default function Settings() {
  const { user, logout } = useAuth();
  const { data: config } = useAppConfig();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your profile, AI & MCP integration for Claude and Cursor, Telegram alerts, and theme."
      />

      <Tabs defaultValue="profile" className="animate-fade-up space-y-4">
        <div className="border-b border-border/80 pb-2">
          <TabsList className="inline-flex h-10 items-center justify-start gap-1 rounded-xl bg-muted/60 border border-border p-1 text-muted-foreground">
            <TabsTrigger value="profile" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <User className="h-3.5 w-3.5" />
              <span>Profile</span>
            </TabsTrigger>
            <TabsTrigger value="ai-mcp" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Bot className="h-3.5 w-3.5" />
              <span>AI & MCP Integration</span>
            </TabsTrigger>
            <TabsTrigger value="telegram" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Send className="h-3.5 w-3.5" />
              <span>Telegram Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Bell className="h-3.5 w-3.5" />
              <span>Email Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              <Palette className="h-3.5 w-3.5" />
              <span>Appearance</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* 1. Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <SectionCard title="Your details">
            <ProfileForm />
          </SectionCard>
          <SectionCard title="Account">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Signed in as</dt>
                <dd className="mt-1 text-xs font-medium text-foreground">{user?.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Full name</dt>
                <dd className="mt-1 text-xs font-medium text-foreground">{user?.full_name || "Not set yet"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">License Tier</dt>
                <dd className="mt-1 text-xs font-semibold text-blue-600 dark:text-blue-400">Lifetime Pro (Unlimited)</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted-foreground">Support</dt>
                <dd className="mt-1 text-xs font-medium text-foreground">
                  {config?.support_email && !config.support_email.includes("edualgo") && !config.support_email.includes("datopin")
                    ? config.support_email
                    : "support@databoard.in"}
                </dd>
              </div>
            </dl>
            <div className="mt-5 border-t border-border/60 pt-4 flex justify-end">
              <Button
                variant="outline"
                className="gap-2 rounded-xl text-destructive hover:bg-destructive/10 hover:border-destructive/30"
                onClick={() => logout(true)}
              >
                <LogOut className="h-4 w-4" />
                Log out
              </Button>
            </div>
          </SectionCard>
        </TabsContent>

        {/* 2. AI & MCP Integration Tab */}
        <TabsContent value="ai-mcp" className="space-y-4">
          <McpApiKeysPanel />
        </TabsContent>

        {/* 3. Telegram Alerts Tab */}
        <TabsContent value="telegram" className="space-y-4">
          <SectionCard
            title="Telegram Real-time Alert Bot"
            description="Get notified instantly on Telegram when visitors convert, traffic spikes occur, or AI search engines cite your pages"
          >
            <TelegramAlertsPanel />
          </SectionCard>
        </TabsContent>

        {/* 3. Email Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <SectionCard title="Email Preferences">
            <NotificationPrefs />
          </SectionCard>
        </TabsContent>

        {/* 5. Appearance Tab */}
        <TabsContent value="appearance" className="space-y-4">
          <SectionCard title="Appearance">
            <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
              <div>
                <p className="text-sm font-semibold">Theme</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Switch between dark and light appearance
                </p>
              </div>
              <ThemeToggle />
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </>
  );
}

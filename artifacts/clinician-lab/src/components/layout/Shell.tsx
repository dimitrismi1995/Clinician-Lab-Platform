import { useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Activity, Beaker, FilePlus, Settings } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  return (
    <SidebarProvider>
      <div className="flex min-h-[100dvh] w-full">
        <Sidebar className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <SidebarHeader className="px-4 py-4 flex items-center gap-2">
            <Beaker className="w-6 h-6 text-sidebar-primary-foreground" />
            <span className="font-semibold tracking-wide text-sm">CLINICIAN LAB</span>
          </SidebarHeader>
          <SidebarContent className="px-2 py-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={location === "/"} 
                  onClick={() => setLocation("/")}
                  className="gap-3"
                >
                  <Activity className="w-4 h-4" />
                  <span>Overview</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={location === "/case/new"} 
                  onClick={() => setLocation("/case/new")}
                  className="gap-3"
                >
                  <FilePlus className="w-4 h-4" />
                  <span>New Case</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  isActive={location === "/presets"} 
                  onClick={() => setLocation("/presets")}
                  className="gap-3"
                >
                  <Settings className="w-4 h-4" />
                  <span>Presets</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="px-4 py-4 text-xs text-sidebar-foreground/50 font-mono">
            Platform v0.1.0
          </SidebarFooter>
        </Sidebar>
        <main className="flex-1 flex flex-col min-w-0 bg-background">
          <header className="h-14 border-b border-border flex items-center px-4 md:hidden">
            <SidebarTrigger />
            <span className="ml-4 font-semibold text-sm">CLINICIAN LAB</span>
          </header>
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

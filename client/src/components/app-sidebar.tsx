import { Link, useLocation } from 'wouter';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import {
  BarChart3,
  Settings,
  Key,
  MessageSquare,
  LogOut,
  Headphones,
  Shield,
  Users,
  Lock,
  Sparkles,
  ClipboardList,
  Palette,
  TestTube2,
  Boxes,
  Plug,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/auth-context';

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const getMenuItems = () => {
    if (!user) return [];

    // Platform Admin menu
    if (user.isPlatformAdmin) {
      return [
        {
          title: 'Analytics',
          url: '/analytics',
          icon: BarChart3,
        },
        {
          title: 'Platform Admin',
          url: '/platform-admin',
          icon: Shield,
        },
        {
          title: 'Integration Documentation',
          url: '/integrations',
          icon: Plug,
        },
        {
          title: 'Widget Test',
          url: '/widget-test',
          icon: TestTube2,
        },
      ];
    }

    // Client Admin menu
    if (user.role === 'client_admin') {
      return [
        {
          title: 'Analytics',
          url: '/analytics',
          icon: BarChart3,
        },
        {
          title: 'Agent Dashboard',
          url: '/agent-dashboard',
          icon: Headphones,
        },
        {
          title: 'Agent Queue',
          url: '/agent-queue',
          icon: ClipboardList,
        },
        {
          title: 'Team Management',
          url: '/team-management',
          icon: Users,
        },
        {
          title: 'API Keys',
          url: '/api-keys',
          icon: Key,
        },
        {
          title: 'Widget Config',
          url: '/widget-config',
          icon: Palette,
        },
      ];
    }

    // Support Staff menu - Agent Queue for handling live chats
    if (user.role === 'support_staff') {
      return [
        {
          title: 'Agent Queue',
          url: '/agent-queue',
          icon: Headphones,
        },
        {
          title: 'Analytics',
          url: '/analytics',
          icon: BarChart3,
        },
      ];
    }

    // Default fallback menu
    return [
      {
        title: 'Analytics',
        url: '/analytics',
        icon: BarChart3,
      },
    ];
  };

  const menuItems = getMenuItems();

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <img src="/favicon.png" alt="Embellics Logo" className="h-8 w-8 rounded-md" />
            <div className="flex flex-col flex-1">
              <span className="font-semibold text-sm">Embellics</span>
              <span className="text-xs text-muted-foreground truncate">{user?.email}</span>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <Badge variant={user.isPlatformAdmin ? 'default' : 'secondary'} className="text-xs">
                {user.isPlatformAdmin ? 'Platform Admin' : user.role.replace('_', ' ')}
              </Badge>
              {user.firstName && (
                <span className="text-xs text-muted-foreground">
                  {user.firstName} {user.lastName}
                </span>
              )}
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link
                        href={item.url}
                        data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="space-y-1">
          <Link href="/change-password">
            <Button
              variant="ghost"
              className="w-full justify-start"
              data-testid="button-change-password"
            >
              <Lock className="h-4 w-4 mr-2" />
              Change Password
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

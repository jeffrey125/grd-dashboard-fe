import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CloseIcon from '@mui/icons-material/Close';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import LockResetOutlinedIcon from '@mui/icons-material/LockResetOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutlineOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { useMediaQuery, useTheme } from '@mui/material';
import Alert from '@mui/material/Alert';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { Link, useLocation } from '@tanstack/react-router';
import { ThemeModeControl } from '@theme/theme-mode-control';
import { type ReactNode, useEffect, useState } from 'react';

import { BrandLogo } from './brand-logo';

const drawerWidth = 272;

const primaryNavigation = [{ href: '/', label: 'Overview', Icon: DashboardOutlinedIcon }] as const;
const shipmentNavigation = [
  { href: '/shipments', label: 'Monitoring', Icon: VisibilityOutlinedIcon },
  { href: '/quotes', label: 'Quote Compare', Icon: RequestQuoteOutlinedIcon },
] as const;

const adminNavigation = [
  { href: '/admin/shipping-providers', label: 'Quote providers', Icon: LocalShippingOutlinedIcon },
  { href: '/admin/accounts', label: 'Accounts', Icon: PeopleOutlineIcon },
  { href: '/admin/carriers', label: 'Carriers', Icon: Inventory2OutlinedIcon },
  { href: '/admin/sales-reps', label: 'Sales Reps', Icon: BadgeOutlinedIcon },
] as const;

export type AppShellUser = {
  displayName: string;
  role: 'staff' | 'admin';
};

export function AppShell({
  children,
  user,
  onSignOut,
  signOutPending = false,
  signOutError,
}: {
  children: ReactNode;
  user?: AppShellUser;
  onSignOut?: () => void;
  signOutPending?: boolean;
  signOutError?: string | null;
}) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shipmentsOpen, setShipmentsOpen] = useState(true);
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));

  useEffect(() => {
    if (desktop) setMobileOpen(false);
  }, [desktop]);
  useEffect(() => {
    if (shipmentNavigation.some(({ href }) => pathname.startsWith(href))) setShipmentsOpen(true);
  }, [pathname]);

  const navigation = (
    <>
      <List component="nav" aria-label="Main navigation" disablePadding>
        {primaryNavigation.map(({ href, label, Icon }) => {
          const selected = href === '/' ? pathname === href : pathname.startsWith(href);
          return (
            <ListItem key={href} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                to={href}
                selected={selected}
                onClick={() => setMobileOpen(false)}
                sx={{ borderRadius: 1.5, minHeight: 44 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={label} />
              </ListItemButton>
            </ListItem>
          );
        })}
        <ListItem disablePadding sx={{ mb: 0.5 }}>
          <ListItemButton
            aria-expanded={shipmentsOpen}
            selected={shipmentNavigation.some(({ href }) => pathname.startsWith(href))}
            onClick={() => setShipmentsOpen((open) => !open)}
            sx={{ borderRadius: 1.5, minHeight: 44 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <LocalShippingOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Shipments" />
            {shipmentsOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
        </ListItem>
        <Collapse in={shipmentsOpen} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {shipmentNavigation.map(({ href, label, Icon }) => (
              <ListItem key={href} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  component={Link}
                  to={href}
                  selected={pathname.startsWith(href)}
                  onClick={() => setMobileOpen(false)}
                  sx={{ borderRadius: 1.5, minHeight: 40, pl: 4 }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Collapse>
      </List>
      {user?.role === 'admin' ? (
        <>
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', px: 2, pb: 1 }}>
            <AdminPanelSettingsOutlinedIcon color="action" fontSize="small" />
            <Typography color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 700 }}>
              ADMINISTRATION
            </Typography>
          </Stack>
          <List component="nav" aria-label="Administration" disablePadding>
            {adminNavigation.map(({ href, label, Icon }) => (
              <ListItem key={href} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  component="a"
                  href={href}
                  selected={pathname.startsWith(href)}
                  onClick={() => setMobileOpen(false)}
                  sx={{ borderRadius: 1.5, minHeight: 44 }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Icon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText primary={label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </>
      ) : null}
    </>
  );

  const account = user ? (
    <Stack spacing={1.25}>
      <Box>
        <Typography noWrap sx={{ fontWeight: 700 }}>
          {user.displayName}
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ fontSize: '0.75rem', textTransform: 'capitalize' }}
        >
          {user.role}
        </Typography>
      </Box>
      <Button
        component="a"
        href="/change-password"
        variant="text"
        color="inherit"
        startIcon={<LockResetOutlinedIcon />}
        sx={{ justifyContent: 'flex-start' }}
      >
        Change password
      </Button>
      {onSignOut ? (
        <Button
          variant="outlined"
          color="inherit"
          startIcon={<LogoutOutlinedIcon />}
          disabled={signOutPending}
          onClick={onSignOut}
        >
          {signOutPending ? 'Signing out…' : 'Sign out'}
        </Button>
      ) : null}
    </Stack>
  ) : null;

  const drawerContents = (
    <Stack sx={{ height: '100%' }}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', px: 2.5, pb: 3, pt: 2.5 }}
      >
        <BrandLogo />
        <IconButton
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          sx={{ display: { md: 'none' }, ml: 1 }}
        >
          <CloseIcon />
        </IconButton>
      </Stack>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5 }}>{navigation}</Box>
      <Divider />
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', p: 1.5 }}>
        <Typography color="text.secondary" sx={{ fontSize: '0.75rem' }}>
          Appearance
        </Typography>
        <ThemeModeControl />
      </Stack>
      {account ? (
        <>
          <Divider />
          <Box sx={{ p: 2 }}>{account}</Box>
        </>
      ) : null}
    </Stack>
  );

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider', display: { md: 'none' } }}
      >
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <BrandLogo />
          <Stack direction="row" spacing={0.5}>
            <ThemeModeControl />
            <IconButton
              color="inherit"
              aria-label="Open navigation"
              aria-controls={mobileOpen ? 'mobile-navigation' : undefined}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon />
            </IconButton>
          </Stack>
        </Toolbar>
      </AppBar>

      <Drawer
        id="mobile-navigation"
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        slotProps={{ paper: { sx: { width: `min(88vw, ${drawerWidth}px)` } } }}
        sx={{ display: { xs: 'block', md: 'none' } }}
      >
        {drawerContents}
      </Drawer>

      <Drawer
        variant="permanent"
        open
        slotProps={{
          paper: {
            sx: {
              borderRightColor: 'divider',
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          },
        }}
        sx={{ display: { xs: 'none', md: 'block' }, width: drawerWidth }}
      >
        {drawerContents}
      </Drawer>

      <Box
        component="main"
        sx={{
          minHeight: '100vh',
          ml: { md: `${drawerWidth}px` },
          px: { xs: 2, sm: 3, lg: 4 },
          pb: 4,
          pt: { xs: 12, md: 4 },
        }}
      >
        {signOutError ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {signOutError}
          </Alert>
        ) : null}
        {children}
      </Box>
    </Box>
  );
}

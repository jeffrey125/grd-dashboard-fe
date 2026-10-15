import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { useColorScheme } from '@mui/material/styles';
import Tooltip from '@mui/material/Tooltip';
import { useState } from 'react';

const themeOptions = [
  { value: 'system', label: 'System', Icon: SettingsBrightnessOutlinedIcon },
  { value: 'light', label: 'Light', Icon: LightModeOutlinedIcon },
  { value: 'dark', label: 'Dark', Icon: DarkModeOutlinedIcon },
] as const;

export function ThemeModeControl() {
  const { mode, setMode } = useColorScheme();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const selectedMode = mode ?? 'system';
  const SelectedIcon =
    themeOptions.find((option) => option.value === selectedMode)?.Icon ??
    SettingsBrightnessOutlinedIcon;

  return (
    <>
      <Tooltip title={`Theme: ${selectedMode}`}>
        <IconButton
          aria-label={`Choose theme. Current theme: ${selectedMode}`}
          aria-controls={anchor ? 'theme-menu' : undefined}
          aria-expanded={anchor ? 'true' : undefined}
          aria-haspopup="menu"
          color="inherit"
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          <SelectedIcon />
        </IconButton>
      </Tooltip>
      <Menu
        id="theme-menu"
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ list: { 'aria-label': 'Theme preference' } }}
      >
        {themeOptions.map(({ value, label, Icon }) => (
          <MenuItem
            key={value}
            selected={selectedMode === value}
            onClick={() => {
              setMode(value);
              setAnchor(null);
            }}
          >
            <ListItemIcon>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

import Box from '@mui/material/Box';
import { Link } from '@tanstack/react-router';

export function BrandLogo({ linked = true }: { linked?: boolean }) {
  const logo = (
    <Box
      sx={{
        alignItems: 'center',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        display: 'flex',
        maxWidth: '100%',
        px: 1.5,
        py: 1,
        width: 212,
      }}
    >
      <Box
        component="img"
        src="/brand/grd-logo.svg"
        alt="Global Resources Direct"
        width={316}
        height={94}
        sx={(theme) => ({
          display: 'block',
          height: 'auto',
          width: '100%',
          ...theme.applyStyles('dark', {
            content: 'url(/brand/grd-logo-dark.svg)',
          }),
        })}
      />
    </Box>
  );

  return linked ? (
    <Link to="/" aria-label="GRD dashboard overview">
      {logo}
    </Link>
  ) : (
    logo
  );
}
